#!/usr/bin/env python3
"""Record reviewed replacement/repeal evidence without rewriting the April inventory."""
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import fitz

OUT = Path(__file__).resolve().parents[1] / 'data/official-forms'


def read(path):
    return json.loads(path.read_text())


def main():
    baseline = read(OUT / 'procedures.json')['procedures']
    current = read(OUT / 'current-ward-procedures.json')['procedures']
    known = {row['procedure_code']: row for row in baseline + current}
    sources = {
        'byt3033': {'name': 'Quyết định 3033/QĐ-BYT ngày 29/9/2026', 'scope': 'national',
                    'url': read(OUT / 'evidence/lifecycle/byt3033-links.json')[0]['url']},
        'bgddt2855': {'name': 'Quyết định 2855/QĐ-BGDĐT ngày 30/9/2026', 'scope': 'national',
                      'url': read(OUT / 'evidence/lifecycle/bgddt2855-links.json')[0]['url']},
        'hanoi762': {'name': 'Quyết định 762/QĐ-TTPVHCC Hà Nội ngày 21/5/2026', 'scope': 'hanoi',
                     'url': 'https://datafiles.hanoi.gov.vn/gov-hni/6244/VanBan/2026/5/21/QDPVHCC-762-2026.pdf'},
        'hanoi821': {'name': 'Quyết định 821/QĐ-TTPVHCC Hà Nội ngày 08/6/2026', 'scope': 'hanoi',
                     'url': 'https://datafiles.hanoi.gov.vn/gov-hni/8180/VanBan/2026/6/16/QD%20821.pdf'},
        'hanoi826': {'name': 'Quyết định 826/QĐ-TTPVHCC Hà Nội ngày 11/6/2026', 'scope': 'hanoi',
                     'url': 'https://datafiles.hanoi.gov.vn/gov-hni/8180/VanBan/2026/6/16/QD%20826.pdf'},
    }
    pages = {}
    bundles = {r['local_path']: r for r in read(OUT / 'source-bundles.json')}
    for key, source in sources.items():
        source['local_path'] = f'originals/{key}-2026.pdf'
        path = OUT / source['local_path']
        with fitz.open(path) as doc:
            pages[key] = [page.get_text() for page in doc]
        source['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        bundles[source['local_path']] = {
            'name': source['name'], 'version': source['name'], 'local_path': source['local_path'],
            'source_url': source['url'], 'sha256': source['sha256'],
            'note': 'Văn bản gốc dùng đối chiếu thay thế/bãi bỏ. Trang áp dụng cho từng mã nằm trong lifecycle.json; giữ nguyên danh mục tháng 4.'}

    records = {}

    def add(code, key, page, status, label, note, successor=None, effective_from=None, effective_until=None):
        if code not in known:
            return
        assert code in pages[key][page - 1], (key, page, code)
        source = sources[key]
        row = {'procedure_code': code, 'name': known[code]['name'], 'status': status, 'label': label,
               'note': note, 'evidence': [{**source, 'page': page}],
               'effective_from': effective_from, 'effective_until': effective_until,
               'reviewed_on': datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).date().isoformat(),
               'use_old_form_for_synthetic_data': False, 'related_current_procedures': []}
        if successor:
            match = next(r for r in current if r['procedure_code'] == successor)
            row['related_current_procedures'].append({
                'code': successor, 'name': match['name'], 'id': match['details'][0]['id'],
                'source_url': match['details'][0]['source_url'],
                'mapping_basis': 'Đối chiếu tên thủ tục thay thế trong quyết định với tên và căn cứ pháp lý trên DVC; mã mới lấy từ DVC, không sửa mã gốc.'})
        records[code] = row

    # These page ranges were reviewed as repeal appendices, not arbitrary code mentions.
    for key, first in [('hanoi762', 3), ('hanoi821', 25)]:
        for page in range(first, len(pages[key]) + 1):
            for code in re.findall(r'\b[123]\.\d{6}\b', pages[key][page - 1]):
                add(code, key, page, 'repealed', 'Đã có quyết định bãi bỏ',
                    'Mã có trong phụ lục bãi bỏ của Hà Nội. Giữ bản ghi lịch sử; không dùng mẫu cũ làm mẫu hiện hành.')
    for page in range(14, 18):
        for code in re.findall(r'\b[123]\.\d{6}\b', pages['hanoi826'][page - 1]):
            from_date = '2026-07-01' if code in {'1.001029', '1.000963', '1.014475'} else '2026-05-20'
            add(code, 'hanoi826', page, 'repealed_for_period', 'Bãi bỏ trong thời hạn công bố',
                'Phụ lục 03 quy định bãi bỏ có thời hạn đến 28/02/2027. Cần kiểm tra lại sau mốc này.',
                effective_from=from_date, effective_until='2027-02-28')
    for old, page, new in [('2.000286', 4, '1.116907'), ('2.000282', 4, '1.116908'),
                           ('2.000477', 4, None), ('1.001776', 5, '1.116909'), ('1.001731', 5, '1.116910')]:
        add(old, 'byt3033', page, 'repealed', 'Mã cũ đã bị bãi bỏ',
            'Quyết định của Bộ Y tế bãi bỏ mã cũ từ 05/10/2026. Thủ tục mới cùng nghiệp vụ được liên kết riêng nếu tìm thấy.',
            new, effective_from='2026-10-05')
    replacements = [
        ('1.012971', 12, '1.116839'), ('1.012973', 12, '1.116840'), ('1.012974', 12, '1.116841'),
        ('1.012963', 12, '1.116842'), ('1.012964', 12, '1.116842'),
        ('2.001842', 13, '1.116843'), ('1.012965', 13, '1.116843'),
        ('1.004563', 13, '1.116844'), ('1.012967', 13, '1.116844'),
        ('1.001639', 13, '1.116845'), ('1.012968', 13, '1.116845'),
        ('1.012975', 14, '1.116846'), ('1.012969', 14, '1.116847'),
        ('3.000307', 14, '1.116848'), ('3.000308', 14, '1.116849'),
    ]
    for old, page, new in replacements:
        add(old, 'bgddt2855', page, 'replaced', 'Đã có thủ tục thay thế',
            'Bảng thủ tục thay thế của Bộ GDĐT nêu mã cũ và tên thủ tục mới. Phạm vi một số thủ tục được gộp hoặc thay đổi.', new)
    add('3.000315', 'bgddt2855', 10, 'replaced', 'Đã có thủ tục thay thế',
        'Nội dung công bố cũ được thay thế; thủ tục mới gộp nhiều loại trung tâm. Chưa gán mã mới tự động.')

    (OUT / 'lifecycle.json').write_text(json.dumps(list(records.values()), ensure_ascii=False, indent=2))
    (OUT / 'source-bundles.json').write_text(json.dumps(list(bundles.values()), ensure_ascii=False, indent=2))
    missing = [r for r in baseline if not r['details']]
    summary = {'reviewed_records': len(records), 'baseline_without_detail': len(missing),
               'baseline_missing_with_change_evidence': sum(r['procedure_code'] in records for r in missing),
               'baseline_missing_still_unexplained': sum(r['procedure_code'] not in records for r in missing)}
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
