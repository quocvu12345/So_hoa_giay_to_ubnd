#!/usr/bin/env python3
"""Import the complete 850-packet fixture into local PostgreSQL, without OCR labels.

Default: validate and report only. --apply backs up the database, copies verified
PDFs into LocalFileStorage and inserts all rows in one transaction. Stable UUIDs
make retries safe; existing business data is never updated or deleted.
Requires psycopg[binary] and PyMuPDF (scripts/requirements-import.txt).
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import uuid
from zoneinfo import ZoneInfo

import pymupdf
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[2]
DATASET = "tuliem-dossiers-full-v2"
NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "hoso.local/fixtures/" + DATASET)
PREFIX = "TEST-TL-"


def identity(kind, key):
    return uuid.uuid5(NAMESPACE, f"{kind}/{key}")


def require(ok, message):
    if not ok:
        raise ValueError(message)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def default_storage():
    api = ROOT / "backend/src/HoSoSo.Api"
    settings = read_json(api / "appsettings.Development.json")
    return (api / settings["Storage"]["Root"]).resolve()


def load_packets(source):
    data = read_json(source / "packets.json")
    manifest = read_json(source / "manifest.json")
    require(data["dataset"] == manifest["dataset"] == DATASET, "Sai dataset")
    packets = data["packets"]
    require(len(packets) == 850, "Cần đủ 850 bộ")
    require(len({p['id'] for p in packets}) == 850, "Trùng mã bộ")
    require(set(Counter(p['blueprint_id'] for p in packets).values()) == {2}, "Mỗi thủ tục phải có 2 bộ")
    require(sum(len(p['documents']) for p in packets) == 3560, "Cần đủ 3560 giấy tờ")
    expected = {p['packet_id']: p for p in manifest['documents']}
    require(set(expected) == {p['id'] for p in packets}, "Manifest thiếu/thừa bộ")
    seen = set()
    for packet in packets:
        require(packet['dataset'] == DATASET and packet['test_complete'], "Bộ chưa hoàn tất")
        require(packet['legally_complete'] is False, "Chỉ nhận dữ liệu giả lập")
        combined = packet['combined_pdf']
        for key in ('local_path', 'sha256', 'byte_size', 'page_count'):
            require(combined[key] == expected[packet['id']][key], f"Manifest lệch: {packet['id']}/{key}")
        ranges = combined['page_ranges']
        require([r['document_id'] for r in ranges] == [d['id'] for d in packet['documents']], "Dải trang sai giấy tờ")
        page = 1
        for doc, span in zip(packet['documents'], ranges):
            require(doc['id'] not in seen, f"Trùng giấy tờ: {doc['id']}")
            seen.add(doc['id'])
            require(span['start_page'] == page and span['end_page'] == page + doc['page_count'] - 1, "Dải trang không liên tục")
            page = span['end_page'] + 1
        require(page - 1 == combined['page_count'], "Sai số trang PDF gộp")
    return packets


def artifacts(packet):
    for position, doc in enumerate(packet['documents'], 1):
        yield doc['id'], doc['title'], 'component', position, doc
    yield 'full-' + packet['id'], 'PDF gộp · ' + packet['procedure_name'], 'reference', len(packet['documents']) + 1, packet['combined_pdf']


def check_pdf(artifact, source):
    path = (ROOT / artifact['local_path']).resolve()
    require(path.is_relative_to(source), f"PDF nằm ngoài bộ dữ liệu: {path}")
    content = path.read_bytes()
    require(content.startswith(b'%PDF-'), f"Không phải PDF: {path}")
    require(len(content) == artifact['byte_size'], f"Sai kích thước: {path}")
    sha = hashlib.sha256(content).hexdigest()
    require(sha == artifact['sha256'], f"Sai SHA-256: {path}")
    with pymupdf.open(stream=content, filetype='pdf') as pdf:
        require(not pdf.is_encrypted and pdf.page_count == artifact['page_count'], f"Sai số trang hoặc PDF mã hóa: {path}")
    return path, f"blobs/{sha[:2]}/{sha[2:4]}/{sha}"


def copy_blob(path, target, sha):
    if target.exists():
        require(hashlib.sha256(target.read_bytes()).hexdigest() == sha, f"Blob hiện có bị sai: {target}")
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix='.import-', dir=target.parent)
    try:
        with os.fdopen(fd, 'wb') as stream, path.open('rb') as src:
            shutil.copyfileobj(src, stream)
        require(hashlib.sha256(Path(temp).read_bytes()).hexdigest() == sha, "Tệp nguồn thay đổi khi chép")
        # Atomic, never replace a file created concurrently by the backend.
        try:
            os.link(temp, target)
        except FileExistsError:
            require(hashlib.sha256(target.read_bytes()).hexdigest() == sha, "Blob đồng thời bị sai")
        return True
    finally:
        Path(temp).unlink(missing_ok=True)


def backup(conninfo, directory):
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).strftime('%Y%m%d-%H%M%S-%f')
    path = directory / f'before-tuliem-import-{stamp}.dump'
    # Full database dump includes extensions, unlike a schema-filtered dump.
    env = os.environ.copy()
    for key, value in conninfo.items():
        if key in ('host', 'port', 'user', 'password', 'dbname'):
            env[{'dbname': 'PGDATABASE'}.get(key, 'PG' + key.upper())] = value
    subprocess.run(['pg_dump', '-w', '-Fc', '-f', str(path)], env=env, check=True)
    os.chmod(path, 0o600)
    subprocess.run(['pg_restore', '--list', str(path)], check=True, stdout=subprocess.DEVNULL)
    return str(path)


def insert(cur, table, values, immutable, counts):
    # Identifiers are fixed internal dictionaries, values always bound parameters.
    keys = list(values)
    cur.execute(f"INSERT INTO hoso.{table} ({','.join(keys)}) VALUES ({','.join(['%s'] * len(keys))}) ON CONFLICT DO NOTHING RETURNING 1", list(values.values()))
    if cur.fetchone():
        counts[table + '_inserted'] += 1
        return
    where = {'id': values['id']} if 'id' in values else {k: values[k] for k in ('dossier_id', 'document_id')}
    cur.execute(f"SELECT * FROM hoso.{table} WHERE " + ' AND '.join(k + '=%s' for k in where), list(where.values()))
    row = cur.fetchone()
    require(row is not None and all(row[k] == values[k] for k in immutable), f"Xung đột với dữ liệu có sẵn: {table}/{where}")
    counts[table + '_existing'] += 1


def run(args):
    source = args.source.resolve()
    storage = args.storage_root.resolve()
    packets = load_packets(source)
    files = {}
    for packet in packets:
        for key, _, _, _, artifact in artifacts(packet):
            files[key] = check_pdf(artifact, source)
    print(f'Đã kiểm SHA-256, kích thước và số trang của {len(files)} PDF.', flush=True)
    stats = Counter()
    report = {'dataset': DATASET, 'mode': 'apply' if args.apply else 'validate', 'packets': len(packets), 'component_pdfs': 3560, 'reference_pdfs': 850, 'storage_root': str(storage)}
    with psycopg.connect(args.dsn, row_factory=dict_row) as conn:
        info = conn.info.get_parameters()
        require(info['host'] in ('127.0.0.1', 'localhost', '::1'), 'Chỉ dùng PostgreSQL local')
        require(info['dbname'] == 'hoso_dev' or info['dbname'].startswith('hoso_import_test_'), 'Chỉ dùng database dev hoặc test')
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (DATASET,))
            cur.execute("SELECT id FROM hoso.users WHERE username=%s AND is_demo AND active", (args.actor,))
            actor = cur.fetchone()
            require(actor is not None, 'Cần tài khoản dev đang hoạt động')
            actor_id = actor['id']
            cur.execute("SELECT department_code,organization_code FROM hoso.work_groups WHERE code='U27'")
            group = cur.fetchone()
            require(group is not None, 'Thiếu nhóm tiếp nhận U27')
            cur.execute("SELECT id,procedure_code,lifecycle_status FROM hoso.procedures")
            procedures = {r['id']: r for r in cur.fetchall()}
            for p in packets:
                procedure = procedures.get(p['blueprint_id'])
                require(procedure and procedure['procedure_code'] == p['procedure_code'], f"Sai tham chiếu thủ tục: {p['id']}")
            report['historical_packets'] = sum(p['historical_mock_only'] for p in packets)
            if args.apply:
                report['backup'] = backup(info, ROOT / 'data/db-backups')
                print('Đã sao lưu: ' + report['backup'], flush=True)
                for p in packets:
                    for key, _, _, _, a in artifacts(p):
                        path, storage_key = files[key]
                        stats['blobs_copied'] += copy_blob(path, storage / storage_key, a['sha256'])
            cur.execute("SELECT set_config('hoso.actor_subject',%s,true)", (str(actor_id),))
            for p in packets:
                did = identity('dossier', p['id'])
                code = PREFIX + p['id'].removeprefix('hs-').upper()
                historical = p['historical_mock_only'] or procedures[p['blueprint_id']]['lifecycle_status'] in ('repealed', 'replaced')
                # A retired procedure cannot be selected for a new dossier through
                # DossierCommands either. Keep its source ID in notes/metadata only.
                procedure_id = None if historical else p['blueprint_id']
                note = f"GIẢ LẬP · {DATASET} · {p['id']}\nNguồn thủ tục: {p['blueprint_id']} / {p['procedure_code']}; đơn vị nguồn: {p['department_id']}.\nXếp nhóm U27 để kiểm thử tiếp nhận; chưa xác nhận phân phòng hoặc đủ điều kiện hành chính. Dữ liệu trường chưa OCR/đối chiếu."
                if historical:
                    note += '\nMÔ PHỎNG LỊCH SỬ: thủ tục đã thay đổi; không gán thành thủ tục hiện hành.'
                insert(cur, 'dossiers', dict(id=did, code=code, origin='demo', title='GIẢ LẬP · ' + p['procedure_name'] + f" · bộ {p['copy']}", year=2026,
                    organization_code=group['organization_code'], department_code=group['department_code'], work_group_code='U27', created_by=actor_id,
                    status='draft', workflow_code='in_progress', access_level='internal', procedure_id=procedure_id, notes=note), ['code', 'origin'], stats)
                for key, title, relation, position, a in artifacts(p):
                    docid = identity('document', key)
                    meta = {'dataset': DATASET, 'packet_id': p['id'], 'source_artifact_id': key, 'source_path': a['local_path'],
                            'procedure_source_id': p['blueprint_id'], 'procedure_code': p['procedure_code'], 'source_department_id': p['department_id'],
                            'historical_mock_only': historical, 'artifact_kind': a.get('artifact_kind', 'synthetic_complete_packet'),
                            'requires_review': True, 'legally_complete': False}
                    insert(cur, 'documents', dict(id=docid, external_key=DATASET + ':' + key, origin='demo', title='GIẢ LẬP · ' + title,
                        document_form=title if relation == 'component' else 'Bộ PDF gộp tham chiếu', metadata_status='needs_review',
                        verification_note='Dữ liệu giả lập nhập từ bộ kiểm thử; chưa OCR hoặc đối chiếu.', source_observations=Jsonb(meta),
                        data_review_status='pending', intake_status='filed', uploaded_by=actor_id), ['external_key', 'origin'], stats)
                    insert(cur, 'files', dict(id=identity('file', key), document_id=docid, component_key='main', version_no=1, file_role='scan',
                        original_name=Path(a['local_path']).name, media_type='application/pdf', byte_size=a['byte_size'], sha256=a['sha256'],
                        page_count=a['page_count'], storage_key=files[key][1], uploaded_by=actor_id), ['document_id', 'sha256', 'byte_size', 'page_count', 'storage_key'], stats)
                    insert(cur, 'dossier_documents', dict(dossier_id=did, document_id=docid, position=position, direction='incoming', relation_kind=relation,
                        added_by=actor_id), ['dossier_id', 'document_id', 'relation_kind'], stats)
            report['counts'] = dict(stats)
            # Validate mode executes constraints/triggers too, then rolls back.
            if not args.apply:
                conn.rollback()
            else:
                conn.commit()
    report['completed_at'] = datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).isoformat()
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dsn', default=os.environ.get('HOSO_IMPORT_DSN', 'host=127.0.0.1 port=5432 dbname=hoso_dev'))
    parser.add_argument('--source', type=Path, default=ROOT / 'data/tuliem-dossiers-full')
    parser.add_argument('--storage-root', type=Path, default=default_storage())
    parser.add_argument('--actor', default='dev_admin')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--report', type=Path)
    run(parser.parse_args())
