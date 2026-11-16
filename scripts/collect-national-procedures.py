#!/usr/bin/env python3
"""Snapshot the public DVC catalogue, keeping internal procedures separate.

Publication IDs, full codes and base codes have different denominators. Do not
report local variations or internal administrative work as citizen procedures.
Only public search/detail endpoints are read; no login or submissions.
"""
import argparse
import collections
import concurrent.futures
import hashlib
import json
from pathlib import Path
import time
from datetime import datetime, timezone

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/national-procedures'
API = 'https://dichvucong.gov.vn/api/v1'
SEARCH = '/submitting/formality/list-all-public-formality-by-citizen'
DETAIL = '/configuring/formality/get-formality-by-citizen'


def now():
    return datetime.now(timezone.utc).isoformat()


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(path)


def read_api(endpoint, body):
    for attempt in range(4):
        try:
            r = requests.post(API + endpoint, json=body, timeout=50)
            r.raise_for_status()
            result = r.json()
            if result.get('code') != 'OK':
                raise ValueError(str(result.get('message'))[:300])
            return result
        except (requests.RequestException, ValueError):
            if attempt == 3:
                raise
            time.sleep(1 + attempt * 2)


def public(row):
    # UPDATED is how the live public portal exposes many amended procedures,
    # including birth registration. It must not be mistaken for a repeal.
    return row.get('state') in {'ACTIVE','UPDATED'} and 'INTERNAL' not in str(row.get('type',''))


def catalogue(resume=True):
    start, entries, last, page, totals = now(), [], '', 1, []
    cursors = set()
    while True:
        body = {'q': '', 'limit': 100, 'lastId': last}
        cache = OUT / 'evidence' / f'all-page-{page:04}.json'
        if resume and cache.is_file():
            saved = json.loads(cache.read_text())
            if saved.get('request') != body:
                raise ValueError(f'Cursor mismatch at {cache}; preserve old snapshot and use a new directory.')
        else:
            saved = {'request': body, 'retrieved_at': now(), 'response': read_api(SEARCH, body)}
            write(cache, saved)
            time.sleep(.12)
        data = saved['response']['data']
        entries.extend(data.get('items', []))
        totals.append(data.get('total'))
        next_id = data.get('lastId')
        if page % 10 == 0:
            print(f'catalogue page {page}; {len(entries)} rows; source total {data.get("total")}', flush=True)
        if not data.get('items') or not next_id:
            break
        if next_id == last or next_id in cursors:
            raise ValueError('Repeated cursor; cannot certify a complete traversal.')
        cursors.add(next_id)
        last, page = next_id, page + 1
        if len(entries) >= data.get('total', 10**9):
            break
    by_id = {r['id']: r for r in entries}
    selected = [r for r in by_id.values() if public(r)]
    stats = {'publication_rows_returned': len(entries), 'unique_publication_ids': len(by_id),
             'source_reported_totals': sorted(set(x for x in totals if x is not None)),
             'catalogue_pages': page, 'public_publications': len(selected),
             'public_full_codes': len({r['code'] for r in selected}),
             'public_base_codes': len({r['code'].split('.H')[0].split('.G')[0] for r in selected}),
             'internal_publications': sum('INTERNAL' in str(r.get('type')) for r in by_id.values()),
             'by_type': dict(collections.Counter(r.get('type') for r in by_id.values())),
             'by_state': dict(collections.Counter(r.get('state') for r in by_id.values())),
             'public_by_publisher': dict(collections.Counter(r.get('departmentPromulgate') for r in selected))}
    output = {'source_endpoint': API + SEARCH, 'request_filter': {'q': '', 'limit': 100},
              'started_at': start, 'finished_at': now(), 'stats': stats,
              'counting_notes': [
                  'Số total của endpoint bao gồm thủ tục nội bộ; không đồng nhất với tổng TTHC phục vụ người dân/doanh nghiệp.',
                  'Một mã có thể có nhiều công bố, cơ quan công bố hoặc phiên bản. Giữ riêng ID và mã đầy đủ.',
                  'Mã cơ sở chỉ là phép nhóm kỹ thuật, không phải xác nhận pháp lý rằng các công bố có thể thay thế nhau.',
                  'ACTIVE và UPDATED là trạng thái cổng tại lúc lấy dữ liệu; giữ nguyên cả hai, không tự suy ra hiệu lực pháp lý hay áp dụng tại từng địa phương.'],
              'publications': sorted(by_id.values(), key=lambda r: (r['code'],r['id']))}
    write(OUT / 'catalogue.json', output)
    write(OUT / 'summary.json', stats)
    print(json.dumps(stats, ensure_ascii=False, indent=2), flush=True)
    return output


def retrieve_detail(row):
    destination = OUT / 'details' / f"{row['id']}.json"
    if destination.is_file():
        return {'id': row['id'], 'status': 'downloaded', 'reused': True}
    shared = ROOT / 'data/official-forms/evidence/dvc/details' / f"{row['id']}.json"
    if shared.is_file():
        d = json.loads(shared.read_text())
        if d.get('code') == 'OK':
            write(destination, d)
            return {'id': row['id'], 'status': 'downloaded', 'reused': True}
    try:
        data = read_api(DETAIL, {'id':row['id']})
        write(destination, data)
        time.sleep(.18)
        return {'id': row['id'], 'status': 'downloaded', 'reused': False}
    except Exception as exc:
        return {'id': row['id'], 'status': 'failed', 'error': str(exc)[:500]}


def details(catalogue_data, jobs):
    rows = [r for r in catalogue_data['publications'] if public(r)]
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as pool:
        futures = [pool.submit(retrieve_detail, r) for r in rows]
        for i,f in enumerate(concurrent.futures.as_completed(futures),1):
            results.append(f.result())
            if i%100 == 0 or i == len(rows):
                failures = sum(r['status']=='failed' for r in results)
                print(f'details {i}/{len(rows)}; failures {failures}', flush=True)
                write(OUT/'progress.json',{'stage':'details','completed':i,'target':len(rows),'failures':failures})
    write(OUT/'detail-acquisition.json', {'finished_at':now(),'rows':results,'total':len(rows),
          'downloaded':sum(r['status']=='downloaded' for r in results), 'failed':sum(r['status']=='failed' for r in results)})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--phase', choices=['catalogue','details','all'], default='all')
    parser.add_argument('--jobs', type=int, default=4)
    args = parser.parse_args()
    data = catalogue() if args.phase in {'catalogue','all'} else json.loads((OUT/'catalogue.json').read_text())
    if args.phase in {'details','all'}:
        details(data,args.jobs)


if __name__=='__main__':
    main()
