#!/usr/bin/env python3
"""Build a reviewable offline inventory, Excel workbook and file manifest."""
import collections
import csv
import hashlib
import html
import json
import re
import unicodedata
import zipfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/official-forms'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def text(value):
    return '' if value is None else str(value)


def file_summary(record):
    return {k: record[k] for k in ['id', 'kind', 'filename', 'status', 'local_path', 'bytes', 'sha256', 'media_type', 'error', 'alternatives'] if k in record}


def sheet(book, title, headers, rows, widths=None):
    ws = book.create_sheet(title)
    ws.append(headers)
    for row in rows:
        ws.append([text(x)[:32760] for x in row])
    for row in ws:
        for cell in row:
            cell.data_type = 's'
            cell.alignment = Alignment(vertical='top', wrap_text=True)
    for cell in ws[1]:
        cell.fill = PatternFill('solid', fgColor='174C40'); cell.font = Font(color='FFFFFF', bold=True)
    ws.freeze_panes = 'A2'; ws.auto_filter.ref = ws.dimensions
    from openpyxl.utils import get_column_letter
    for index in range(1, len(headers) + 1):
        ws.column_dimensions[get_column_letter(index)].width = (widths or {}).get(index, 24)
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            if cell.value.startswith(('https://', 'templates/', 'procedure-pdf/', 'electronic-forms/', 'originals/')) and '\n' not in cell.value:
                cell.hyperlink = cell.value; cell.font = Font(color='126E63', underline='single')
    return ws


def main():
    baseline = read(OUT / 'procedures.json')
    current = read(OUT / 'current-ward-procedures.json')
    files = read(OUT / 'files.json')
    reconciliation = read(OUT / 'reconciliation.json') if (OUT / 'reconciliation.json').is_file() else []
    supplemental_sources = read(OUT / 'source-bundles.json') if (OUT / 'source-bundles.json').is_file() else []
    alternatives = read(OUT / 'template-alternatives.json') if (OUT / 'template-alternatives.json').is_file() else []
    lifecycle = read(OUT / 'lifecycle.json') if (OUT / 'lifecycle.json').is_file() else []
    lifecycle_by_code = {r['procedure_code']: r for r in lifecycle}
    for record in files:
        if record['kind'] == 'blank_form':
            record['alternatives'] = [r for r in alternatives if r['attachment_id'] == record['id']]
    file_index = {(f['kind'], f['id']): f for f in files}
    entries = []
    by_detail = {}
    for row in baseline['procedures']:
        entry = {**row, 'baseline': True, 'current': False, 'scope': 'hanoi_notice', 'baseline_ordinal': int(row['ordinal'])}
        entry['references'] = [row['id']]
        entries.append(entry)
        for detail in row['details']:
            by_detail[detail['id']] = entry
    for row in current['procedures']:
        detail = row['details'][0]
        entry = by_detail.get(detail['id'])
        if entry:
            entry.update(current=True, current_scope=row['scope'], current_code=row['procedure_code'])
            entry['references'].append(row['id'])
        else:
            entry = {**row, 'baseline': False, 'current': True, 'current_scope': row['scope'], 'references': [row['id']]}
            entries.append(entry); by_detail[detail['id']] = entry
    components = []
    gaps = []
    for entry in entries:
        entry['lifecycle'] = lifecycle_by_code.get(entry['procedure_code'])
        entry['name_lookup'] = next((r for r in reconciliation if r['id'] == entry['id']), None)
        entry['file_ids'] = []
        entry['blank_files'] = []
        entry['procedure_pdfs'] = []
        entry['eforms'] = []
        entry['component_count'] = 0
        if not entry['details']:
            change = entry['lifecycle']
            issue = change['label'] + ': ' + change['note'] if change else 'Chưa tìm thấy chi tiết theo mã trong danh mục 27/4/2026; chưa xác minh nguyên nhân'
            gaps.append({'procedure_code': entry['procedure_code'], 'name': entry['name'], 'issue': issue, 'source_url': entry.get('inventory_source_url', ''), 'local_path': ''})
        for detail in entry['details']:
            for kind, key in [('procedure_pdf', 'procedure_pdfs'), ('electronic_form', 'eforms')]:
                record = file_index.get((kind, detail['id']))
                if record and record['status'] == 'downloaded':
                    entry[key].append(file_summary(record))
            for component in detail['components']:
                entry['component_count'] += 1
                attachments = []
                for attachment in component['attachments']:
                    record = file_index.get(('blank_form', attachment.get('id')))
                    if record:
                        attachments.append(file_summary(record))
                        if record['id'] not in entry['file_ids']:
                            entry['file_ids'].append(record['id'])
                            if record['status'] == 'downloaded':
                                entry['blank_files'].append(file_summary(record))
                component['download_files'] = attachments
                components.append({'procedure_id': entry['id'], 'procedure_code': entry['procedure_code'],
                                   'procedure_name': entry['name'], 'domain': entry['domain'],
                                   'source_url': detail['source_url'], **component})
        entry['status'] = 'has_files' if entry['blank_files'] else 'no_attachment' if entry['details'] else 'missing_detail'
        if entry['details'] and not entry['blank_files']:
            gaps.append({'procedure_code': entry['procedure_code'], 'name': entry['name'],
                         'issue': 'Nguồn chi tiết không cung cấp tệp mẫu tải được; không suy ra rằng thủ tục không cần giấy tờ',
                         'source_url': entry['details'][0]['source_url'], 'local_path': ''})
    for f in files:
        if f['status'] == 'failed':
            issue = f.get('error', 'Tải thất bại')
            if f.get('alternatives'):
                issue += '; đã có PDF trích nguyên trang từ văn bản chính thức, xem sheet Ban PDF trich tu nguon'
            gaps.append({'procedure_code': '', 'name': f['filename'], 'issue': issue,
                         'source_url': f['source_endpoint'], 'local_path': f.get('local_path', '')})

    papers = {}
    for component in components:
        key = component['component_code'] or 'text-' + hashlib.sha256(component['name'].encode()).hexdigest()[:16]
        paper = papers.setdefault(key, {'code': key, 'names': set(), 'procedure_codes': set(), 'source_urls': set(), 'files': set()})
        paper['names'].add(component['name']); paper['procedure_codes'].add(component['procedure_code'])
        paper['source_urls'].add(component['source_url'])
        paper['files'].update(f['local_path'] for f in component['download_files'] if f['status'] == 'downloaded')
        paper['files'].update(a['local_path'] for f in component['download_files'] for a in f.get('alternatives', []))
    papers = [{k: sorted(v) if isinstance(v, set) else v for k, v in item.items()} for item in papers.values()]
    (OUT / 'papers.json').write_text(json.dumps(papers, ensure_ascii=False, indent=2))

    now = datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).isoformat()
    stats = {'baseline_procedures': len(baseline['procedures']), 'current_commune_procedures': len(current['procedures']),
             'merged_entries': len(entries), 'retrieved_details': len(by_detail),
             'baseline_details_found': sum(bool(r['details']) for r in baseline['procedures']),
             'component_rows': len(components), 'domains_baseline': len({r['domain'] for r in baseline['procedures']}),
             'distinct_component_codes_or_texts': len(papers),
             'official_pdf_template_extracts': len(alternatives),
             'baseline_missing_with_change_evidence': sum(r['baseline'] and not r['details'] and bool(r['lifecycle']) for r in entries),
             'baseline_missing_still_unexplained': sum(r['baseline'] and not r['details'] and not r['lifecycle'] for r in entries),
             'files_by_kind_status': dict(collections.Counter(f"{f['kind']}:{f['status']}" for f in files)),
             'entries_with_blank_files': sum(bool(r['blank_files']) for r in entries),
             'baseline_with_blank_files': sum(bool(r['blank_files']) for r in entries if r['baseline']),
             'distinct_downloaded_template_hashes': len({f['sha256'] for f in files if f['kind'] == 'blank_form' and f['status'] == 'downloaded'}),
             'downloaded_bytes': sum(f.get('bytes', 0) for f in files if f['status'] == 'downloaded')}
    payload = {'title': 'Hồ sơ, giấy tờ và thủ tục cấp phường · Từ Liêm, Hà Nội', 'generated_at': now,
               'stage': 'inventory_and_source_collection', 'synthetic_data_created_this_stage': False,
               'stats': stats, 'entries': entries, 'files': files, 'gaps': gaps, 'source_bundles': supplemental_sources,
               'template_alternatives': alternatives,
               'lifecycle': lifecycle,
               'notes': [
                   '425 mục được chép đủ theo TB 87/TB-TTPVHCC ngày 27/4/2026; không tự sửa lỗi đánh máy của nguồn.',
                   'Danh sách DVC là các thủ tục công khai có cấp thực hiện COMMUNE, do bộ/ngành hoặc cơ quan Hà Nội công bố; chưa đồng nghĩa tất cả đều thuộc UBND phường Từ Liêm.',
                   'Giữ riêng thẩm quyền giải quyết, tiếp nhận và ủy quyền của danh mục Hà Nội.',
                   'Các mục thành phần giữ nguyên lời nguồn, gồm cả hướng dẫn, điều kiện và giấy tờ xuất trình; không tính mỗi mục là một giấy tờ bắt buộc.',
                   'PDF hướng dẫn thủ tục, mẫu giấy Word/PDF và cấu hình biểu mẫu điện tử được thống kê riêng.',
                   'Hai tệp Word rỗng có bản PDF trích nguyên trang từ văn bản chính thức, kèm trang nguồn; không tính hai bản trích vào số tệp đính kèm tải được.',
                   'Những mục có quyết định thay thế/bãi bỏ vẫn giữ trong danh mục lịch sử, có trang chứng minh riêng. Không dùng mẫu cũ của các mục này làm dữ liệu mẫu hiện hành.',
                   'Không tạo dữ liệu giả. Chưa chuyển giai đoạn tạo dữ liệu khi còn mục chưa xác minh hoặc chưa có bản mềm.',
               ]}
    (OUT / 'library.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    (OUT / 'coverage.json').write_text(json.dumps(stats, ensure_ascii=False, indent=2))

    book = Workbook(); book.remove(book.active)
    sheet(book, 'Huong dan', ['Nội dung', 'Giá trị'], [
        ['Địa bàn', 'Phường Từ Liêm, thành phố Hà Nội'], ['Ngày thu thập', now],
        *[[key, json.dumps(value, ensure_ascii=False) if isinstance(value, dict) else value] for key, value in stats.items()],
        *[['Lưu ý', note] for note in payload['notes']],
        ['Danh mục nguồn', baseline['procedures'][0]['inventory_source_url']],
        ['Bản gốc danh mục', 'originals/hanoi-425-procedures-2026.pdf'],
    ], {1: 40, 2: 110})
    sheet(book, 'Ha Noi 425', ['STT', 'Mã nguồn', 'Tên thủ tục trong danh mục', 'Lĩnh vực', 'Cơ quan quản lý', 'Cấp thực hiện', 'Thẩm quyền giải quyết', 'QĐ ủy quyền', 'Hạn ủy quyền', 'QĐ công bố TP', 'QĐ QTNB', 'Trang nguồn', 'Tra cứu chi tiết', 'Số tệp mẫu tải được', 'Nguồn danh mục', 'Nguồn chi tiết', 'Mã tìm thấy với mục nguồn không có mã'], [
        [r['ordinal'], r['procedure_code'], r['name'], r['domain'], r['managing_agency'], r['execution_level'], r['competent_authority'], r['delegation_decision'], r['delegation_expiry'], r['hanoi_decision'], r['workflow_decision'], r['source_page'], r['lookup_status'], len(r['blank_files']), r['inventory_source_url'], r['details'][0]['source_url'] if r['details'] else '', r.get('matched_current_code', '')]
        for r in entries if r['baseline']], {3: 85, 4: 35, 7: 35, 15: 40, 16: 40})
    sheet(book, 'DVC cap xa hien tai', ['Mã thủ tục', 'Tên thủ tục trên DVC', 'Lĩnh vực', 'Cơ quan công bố', 'Phạm vi nguồn', 'Trạng thái trên DVC', 'Số tệp mẫu', 'Nguồn DVC', 'PDF thủ tục'], [
        [d['code'], d['name'], r['domain'], next((x['managing_agency'] for x in current['procedures'] if x['details'][0]['id'] == d['id']), ''), r.get('current_scope'), d.get('state'), len(r['blank_files']), d['source_url'], r['procedure_pdfs'][0]['local_path'] if r['procedure_pdfs'] else '']
        for r in entries if r['current'] for d in r['details']], {2: 90, 3: 35, 4: 35, 8: 40, 9: 50})
    sheet(book, 'Thanh phan ho so', ['Mã thủ tục', 'Tên thủ tục', 'Lĩnh vực', 'Trường hợp / phần nguồn', 'Tên giấy tờ hoặc hướng dẫn (nguyên văn)', 'Bản chính theo nguồn', 'Bản sao theo nguồn', 'Cờ required từ nguồn', 'Có form điện tử theo nguồn', 'Tên tệp mẫu', 'Đường dẫn tệp tải được', 'Nguồn'], [
        [c['procedure_code'], c['procedure_name'], c['domain'], c['section'], c['name'], c['original_quantity'], c['copy_quantity'], c['required_as_published'], c['has_electronic_form'], '\n'.join(f['filename'] for f in c['download_files']), '\n'.join(f.get('local_path', '') for f in c['download_files'] if f['status'] == 'downloaded'), c['source_url']]
        for c in components], {2: 65, 4: 40, 5: 100, 10: 40, 11: 65, 12: 45})
    sheet(book, 'Ban mem', ['Loại tệp', 'Tên gốc', 'Kết quả tải', 'Tệp trên máy', 'Bytes', 'SHA-256', 'Nguồn tải', 'Tham số tải', 'Ngày lấy'], [
        [f['kind'], f['filename'], f['status'], f.get('local_path', ''), f.get('bytes', ''), f.get('sha256', ''), f['source_endpoint'], json.dumps(f['source_request'], ensure_ascii=False), f['retrieved_at']] for f in files], {2: 55, 4: 80, 6: 70, 7: 65, 8: 55})
    sheet(book, 'Danh muc giay to', ['Mã thành phần nguồn', 'Tên giấy tờ / mục nguồn (các cách diễn đạt)', 'Các thủ tục sử dụng', 'Tệp mẫu tải được', 'Nguồn'], [
        [p['code'], '\n\n'.join(p['names']), '\n'.join(p['procedure_codes']), '\n'.join(p['files']), '\n'.join(p['source_urls'])] for p in papers], {1: 32, 2: 100, 3: 35, 4: 85, 5: 80})
    sheet(book, 'Can doi chieu', ['Mã thủ tục', 'Tên thủ tục / tệp', 'Nội dung cần xử lý', 'Nguồn', 'Tệp'], [[g[k] for k in ['procedure_code', 'name', 'issue', 'source_url', 'local_path']] for g in gaps], {2: 90, 3: 100, 4: 70})
    sheet(book, 'Doi chieu ten va ma', ['Mã danh mục cũ', 'Tên danh mục cũ', 'Mã ứng viên', 'Tên ứng viên', 'Cơ quan công bố', 'Kiểu đối chiếu', 'Kết luận', 'Nguồn DVC'], [
        [r.get('old_code'), r.get('name'), e.get('code'), e.get('name'), e.get('departmentPromulgate'), kind, 'Chưa xác nhận thay thế mã hoặc áp dụng tại phường; đối chiếu quyết định công bố', 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/' + e['id']]
        for r in reconciliation for kind, candidates in [('Trùng tên chuẩn hóa', r.get('exact_title_candidates', [])), ('Kết quả tìm theo tên', r.get('search_candidates', []))] for e in candidates], {2: 80, 4: 80, 7: 70, 8: 65})
    sheet(book, 'Bo mau nguon ban hanh', ['Tên bộ tài liệu', 'Văn bản / phạm vi', 'Tệp gốc', 'Nguồn tải', 'SHA-256', 'Lưu ý'], [
        [r['name'], r['version'], r['local_path'], r['source_url'], r['sha256'], r['note']] for r in supplemental_sources], {1: 70, 2: 40, 3: 75, 4: 70, 5: 70, 6: 90})
    sheet(book, 'Ban PDF trich tu nguon', ['Mã thủ tục', 'Tên mẫu', 'PDF trích nguyên trang', 'Tài liệu gốc', 'Trang PDF gốc (từ 1)', 'Nguồn', 'Lưu ý'], [
        [r['procedure_code'], r['filename'], r['local_path'], r['source_path'], ', '.join(map(str, r['source_pages'])), r['source_url'], r['note']] for r in alternatives], {2: 65, 3: 75, 4: 65, 6: 70, 7: 90})
    sheet(book, 'Thay the va bai bo', ['Mã gốc', 'Tên trong danh mục', 'Tình trạng đối chiếu', 'Giải thích', 'Quyết định gốc', 'Trang PDF', 'Bản mềm quyết định', 'Mã thủ tục mới liên quan', 'Tên thủ tục mới', 'Nguồn DVC mới', 'Phạm vi văn bản', 'Hiệu lực từ (nếu nêu)', 'Đến ngày (nếu nêu)', 'Ngày đối chiếu'], [
        [r['procedure_code'], r['name'], r['label'], r['note'], e['name'], e['page'], e['local_path'],
         '\n'.join(x['code'] for x in r['related_current_procedures']), '\n'.join(x['name'] for x in r['related_current_procedures']),
         '\n'.join(x['source_url'] for x in r['related_current_procedures']), e['scope'], r.get('effective_from'), r.get('effective_until'), r['reviewed_on']]
        for r in lifecycle for e in r['evidence']], {2: 80, 4: 100, 5: 65, 7: 55, 9: 90, 10: 70})
    book.save(OUT / 'Danh-muc-ho-so-thu-tuc-phuong-Tu-Liem.xlsx')
    for filename, items in [('inventory.csv', [{**{k: r.get(k, '') for k in ['id', 'procedure_code', 'name', 'domain', 'baseline', 'current', 'status', 'component_count']}, 'lifecycle_status': r['lifecycle']['label'] if r['lifecycle'] else ''} for r in entries]), ('missing-files.csv', gaps)]:
        with (OUT / filename).open('w', encoding='utf-8-sig', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=list(items[0])); writer.writeheader(); writer.writerows(items)
    page = (ROOT / 'scripts/procedure-library-template.html').read_text()
    page = page.replace('__LIBRARY_JSON__', json.dumps(payload, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'))
    (OUT / 'index.html').write_text(page)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
