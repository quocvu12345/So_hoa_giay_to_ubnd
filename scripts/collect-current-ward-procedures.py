#!/usr/bin/env python3
"""Retain the current public commune list separately from Hanoi's dated notice."""
import concurrent.futures
import importlib.util
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

spec = importlib.util.spec_from_file_location('collector', Path(__file__).with_name('collect-official-procedures.py'))
c = importlib.util.module_from_spec(spec); spec.loader.exec_module(c)


def collect(entry):
    detail = c.api(c.DETAIL, {'id': entry['id']}, c.OUT / f'evidence/dvc/details/{entry["id"]}.json')
    row = {'id': 'dvc-' + entry['id'], 'procedure_code': entry['code'], 'name': entry['name'],
           'domain': '; '.join(entry.get('categories', [])), 'managing_agency': entry['departmentPromulgate'],
           'inventory_date': None, 'scope': 'hanoi' if 'Hà Nội' in entry['departmentPromulgate'] else 'national_commune',
           'lookup_status': 'retrieved', 'currency_status': 'published_on_dvc_not_local_applicability_certificate',
           'checked_at': datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).isoformat(),
           'is_internal': detail.get('isInternal'), 'details': [{
               'id': detail['id'], 'code': detail['code'], 'name': detail['name'], 'state': detail.get('state'),
               'type': detail.get('type'), 'is_ward': detail.get('isWard'),
               'updated_at_source': detail.get('updatedAt'),
               'source_url': 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/' + detail['id'],
               'raw_path': f'evidence/dvc/details/{detail["id"]}.json', 'components': c.components(detail),
               'results': detail.get('resultsDetails') or [], 'legal_bases': detail.get('legalBasisesDetails') or []}]}
    c.write(c.OUT / f'supplemental-procedures/{entry["id"]}.json', row)
    return row


def main():
    discovery_path = c.OUT / 'evidence/dvc/commune-discovery.json'
    if not discovery_path.is_file():
        candidates = []; last = ''; index = 1
        while True:
            result = c.api(c.SEARCH, {'q': '', 'limit': 100, 'lastId': last, 'level': 'COMMUNE'},
                           c.OUT / f'evidence/dvc/global-commune-{index}.json')
            candidates.extend(result.get('items', []))
            next_id = result.get('lastId')
            if not next_id or next_id == last or len(candidates) >= result.get('total', 0):
                break
            last = next_id; index += 1
        c.write(discovery_path, candidates)
    candidates = json.loads(discovery_path.read_text())
    entries = [r for r in candidates if r['type'] not in {'STANDARD_INTERNAL', 'SPECIFIC_INTERNAL'}
               and (r['departmentPromulgate'].startswith('Bộ ') or r['departmentPromulgate'] in {
                   'UBND Thành phố Hà Nội', 'Trung tâm phục vụ hành chính công Thành phố Hà Nội'})]
    result = []; errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        future_map = {pool.submit(collect, e): e for e in entries}
        for f in concurrent.futures.as_completed(future_map):
            try:
                result.append(f.result())
            except Exception as exc:
                errors.append({'id': future_map[f]['id'], 'code': future_map[f]['code'], 'error': str(exc)})
            if (len(result) + len(errors)) % 50 == 0:
                print(f'{len(result)}/{len(entries)} current commune entries; {len(errors)} errors', flush=True)
    c.write(c.OUT / 'current-ward-procedures.json', {'source_endpoint': c.API + c.SEARCH,
            'source_filter': {'level': 'COMMUNE', 'q': ''}, 'total_returned': len(candidates),
            'selection': 'Công bố cấp xã từ bộ/ngành và UBND Thành phố Hà Nội, loại trừ type nội bộ. Đây là phạm vi tra cứu, không tự xác nhận toàn bộ thuộc thẩm quyền UBND phường Từ Liêm.',
            'selected_count': len(entries), 'errors': errors,
            'procedures': sorted(result, key=lambda r: r['procedure_code'])})
    # Four entries in TB 87 have a dash instead of a code. A unique identical
    # title published by Hanoi can supply a cross-reference without rewriting
    # the original inventory or assuming a replacement for an existing code.
    def normalized(value):
        return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', value.lower()).replace('đ', 'd'))
    baseline_path = c.OUT / 'procedures.json'
    if baseline_path.is_file():
        baseline = json.loads(baseline_path.read_text())
        for row in baseline['procedures']:
            if row['procedure_code'] != '-':
                continue
            matches = [r for r in result if r['scope'] == 'hanoi' and normalized(r['name']) == normalized(row['name'])]
            if len(matches) == 1:
                row.update(details=matches[0]['details'], lookup_status='retrieved_by_exact_title',
                           matched_current_code=matches[0]['procedure_code'],
                           match_method='Tên trùng duy nhất với công bố của Trung tâm PVHCC Hà Nội; giữ nguyên dấu gạch ở mã nguồn cũ.')
                c.write(c.OUT / f'procedures/{row["id"]}.json', row)
        c.write(baseline_path, baseline)
    print('Complete', len(result), 'errors', len(errors))


if __name__ == '__main__':
    main()
