#!/usr/bin/env python3
"""Collect published Hanoi ward procedures and public dossier components.

Only public search/detail/download endpoints used by dichvucong.gov.vn are read.
No login, submission, invented forms, or synthetic personal data.
"""
import argparse
import concurrent.futures
import csv
import hashlib
import json
import re
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/official-forms'
API = 'https://dichvucong.gov.vn/api/v1'
SOURCE = 'https://datafiles.hanoi.gov.vn/gov-hni/7034/VanBan/2026/4/28_1/DANH%20M%E1%BB%A4C%20TTHC%20C%E1%BA%A4P%20X%C3%83%20%28FINAL%2024.4.26%29_1.pdf'
SEARCH = '/submitting/formality/list-all-public-formality-by-citizen'
DETAIL = '/configuring/formality/get-formality-by-citizen'


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    temp.replace(path)


def clean(value):
    return ' '.join(str(value or '').split())


def api(endpoint, payload, cache):
    if cache.is_file():
        saved = json.loads(cache.read_text())
        if saved.get('code') == 'OK':
            return saved['data']
    for attempt in range(3):
        try:
            response = requests.post(API + endpoint, json=payload, timeout=45)
            response.raise_for_status()
            data = response.json()
            if data.get('code') != 'OK':
                raise ValueError(data.get('message', 'Unknown response'))
            write(cache, data)
            time.sleep(.15)
            return data['data']
        except (requests.RequestException, ValueError):
            if attempt == 2:
                raise
            time.sleep(1 + attempt)


def baseline():
    source = OUT / 'evidence/hanoi-425-rows.json'
    if not source.is_file():
        import fitz
        pdf = OUT / 'originals/hanoi-425-procedures-2026.pdf'
        if not pdf.is_file():
            response = requests.get(SOURCE, timeout=60); response.raise_for_status()
            pdf.parent.mkdir(parents=True, exist_ok=True); pdf.write_bytes(response.content)
        rows = []
        with fitz.open(pdf) as doc:
            for index, page in enumerate(doc):
                for table in page.find_tables().tables:
                    rows.extend({'page': index + 1, 'cells': r} for r in table.extract()
                                if r and r[0] and r[0].strip().isdigit())
        write(source, rows)
    rows = json.loads(source.read_text())
    assert len(rows) == 425 and {int(r['cells'][0]) for r in rows} == set(range(1, 426)), 'Incomplete official inventory'
    keys = ['ordinal', 'managing_agency', 'procedure_code', 'name', 'domain', 'ministry_decision',
            'hanoi_decision', 'workflow_decision', 'fees', 'execution_level', 'competent_authority',
            'delegation_decision', 'delegation_expiry', 'receiving_location']
    return [{**dict(zip(keys, map(clean, row['cells']))), 'id': f"hn87-{int(row['cells'][0]):03d}", 'source_page': row['page'],
             'inventory_source_url': SOURCE, 'inventory_date': '2026-04-27'} for row in rows]


def components(detail):
    result = []
    groups = [{'name': 'Thành phần hồ sơ', 'profileComponents': detail.get('profileComponents') or []}]
    groups += detail.get('executionCases') or []
    for group in groups:
        for index, item in enumerate(group.get('profileComponents') or []):
            nested = item.get('detail') or {}
            result.append({'section': group.get('name', ''), 'position': index + 1,
                           'name': nested.get('name') or item.get('name', ''),
                           'component_code': item.get('code', ''),
                           'original_quantity': item.get('originalQty'), 'copy_quantity': item.get('copyQty'),
                           'required_as_published': item.get('required'),
                           'has_electronic_form': item.get('hasElectronicForm', False),
                           'attachments': (nested.get('data') or {}).get('attachments') or item.get('attachments') or []})
    return result


def collect(row):
    code = row['procedure_code']
    now = datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).isoformat()
    result = {**row, 'checked_at': now, 'details': [], 'lookup_status': 'not_found',
              'currency_status': 'snapshot_requires_later_amendment_check', 'errors': []}
    try:
        if not re.fullmatch(r'\d\.\d{6}', code):
            found = {'items': []}
            result['lookup_status'] = 'no_code_in_source'
        else:
            found = api(SEARCH, {'q': code, 'limit': 100}, OUT / f'evidence/dvc/search/{code}.json')
        exact = [r for r in found.get('items', []) if r.get('code', '').split('.H')[0] == code]
        for entry in exact:
            detail = api(DETAIL, {'id': entry['id']}, OUT / f'evidence/dvc/details/{entry["id"]}.json')
            result['details'].append({'id': detail['id'], 'code': detail.get('code'), 'name': detail.get('name'),
                                      'state': detail.get('state'), 'type': detail.get('type'),
                                      'is_ward': detail.get('isWard'), 'updated_at_source': detail.get('updatedAt'),
                                      'source_url': 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/' + detail['id'],
                                      'raw_path': f'evidence/dvc/details/{detail["id"]}.json',
                                      'components': components(detail),
                                      'results': detail.get('resultsDetails') or [],
                                      'legal_bases': detail.get('legalBasisesDetails') or []})
        if result['details']:
            result['lookup_status'] = 'retrieved'
    except Exception as error:
        result['lookup_status'] = 'error'; result['errors'].append(str(error)[:500])
    write(OUT / f'procedures/{row["id"]}.json', result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit', type=int)
    args = parser.parse_args()
    rows = baseline()
    if args.limit:
        rows = rows[:args.limit]
    result = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for index, item in enumerate(pool.map(collect, rows), 1):
            result.append(item)
            if index % 25 == 0 or index == len(rows):
                print(f'{index}/{len(rows)} procedures; {sum(r["lookup_status"] == "retrieved" for r in result)} found', flush=True)
    component_rows = []
    for row in result:
        for detail in row['details']:
            for component in detail['components']:
                component_rows.append({'procedure_code': row['procedure_code'], 'procedure_name': row['name'],
                                       'domain': row['domain'], 'source_url': detail['source_url'], **component})
    info = {'locality': 'Phường Từ Liêm, thành phố Hà Nội', 'ward_department_code': 'H26.139',
            'ward_code': '00592', 'inventory_date': '2026-04-27',
            'collected_at': datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).isoformat(),
            'notice': '425 thủ tục theo TB 87 ngày 27/4/2026; dữ liệu chi tiết tra từ Cổng DVC Quốc gia. Không coi ngày tải là xác nhận hiệu lực toàn bộ danh mục. Không tự tạo mẫu thiếu.',
            'procedures': result}
    write(OUT / 'procedures.json', info)
    write(OUT / 'components.json', component_rows)
    for filename, items in [('procedures.csv', [{k: v for k, v in row.items() if k != 'details'} for row in result]),
                            ('components.csv', component_rows)]:
        if not items:
            continue
        with (OUT / filename).open('w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=list(items[0])); writer.writeheader()
            writer.writerows({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v for k, v in row.items()} for row in items)
    print(json.dumps({'procedures': len(result), 'details_found': sum(r['lookup_status'] == 'retrieved' for r in result),
                      'component_rows': len(component_rows), 'attachments': sum(len(c['attachments']) for c in component_rows)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
