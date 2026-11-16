#!/usr/bin/env python3
"""Auditable routing and input triage of the collected public library.

Routing is an inference from domains, NOT an assignment of legal competence.
Public COMMUNE flags include external services; keep their authority separate.
Only recognize actual template text as evidence for fillable slots. Never turn
the source's required=False into a claim that a document is always optional.
"""
import collections
import hashlib
import json
from pathlib import Path
import re
import subprocess
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/official-forms'
OUT = ROOT / 'data/form-test-data'
DEPARTMENTS = {
    'vp': 'Văn phòng HĐND và UBND · tư pháp, hộ tịch',
    'ktdt': 'Phòng Kinh tế, Hạ tầng và Đô thị',
    'vx': 'Phòng Văn hóa - Xã hội',
    'ca': 'Công an · đơn vị ngành dọc',
    'qs': 'Quân sự · phối hợp quốc phòng',
    'thue': 'Cơ quan Thuế · đơn vị ngành dọc',
    'haiquan': 'Cơ quan Hải quan · ngoài phòng chuyên môn phường',
    'bhxh': 'Cơ quan BHXH · đơn vị ngành dọc',
    'khobac': 'Kho bạc Nhà nước · ngoài phòng chuyên môn phường',
    'chuyennganh': 'Cơ quan chuyên ngành · cần xác định đơn vị phối hợp',
    'review': 'Chưa đủ căn cứ phân phòng',
}
ROUTING_SOURCES = [
    'https://tuliem.hanoi.gov.vn/tin-tuc-hoat-dong-cua-ubnd/ubnd-phuong-tu-liem-to-chuc-hop-tap-the-lanh-dao-xem-xet-nhieu-noi-dung-quan-trong-ve-quan-ly-dieu-hanh-2695260410141900987.htm',
    'https://tuliem.hanoi.gov.vn/tin-tuc-hoat-dong-cua-ubnd/tap-the-lanh-dao-ubnd-phuong-tu-liem-hop-thong-nhat-chi-dao-mot-so-noi-dung-theo-tham-quyen-2695250905173321162.htm',
    'https://datafiles.hanoi.gov.vn/gov-hni/6244/VanBan/2026/3/9/PLQDPVHCC-295-2026.pdf',
]


def folded(text):
    return ''.join(c for c in unicodedata.normalize('NFD', str(text).lower())
                   if unicodedata.category(c) != 'Mn').replace('đ', 'd')


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def route(domain):
    d = folded(domain)
    rules = [
        ('haiquan', r'hai quan'), ('thue', r'thue'), ('khobac', r'kho bac'),
        ('chuyennganh', r'hang hai va duong thuy|quan ly bien gioi'),
        ('bhxh', r'bhxh|bhyt|bao hiem xa hoi|bao hiem y te|cap so'),
        ('qs', r'bqp|nghia vu quan su|quan ly bien gioi'),
        ('ca', r'cu tru|can cuoc|dinh danh|xuat nhap canh|phong chay|con dau|an ninh|phuong tien giao thong|sat hach|vu khi|trat tu|cai nghien'),
        ('vp', r'ho tich|chung thuc|nuoi con nuoi|hoa giai|boi thuong nha nuoc|khieu nai|to cao|tham nhung|tiep can thong tin|bien phap bao dam|thu tuc hanh chinh lien thong'),
        ('vx', r'nguoi co cong|bao tro|tre em|giao duc|thi, tuyen|dao tao|lao dong|viec lam|y duoc|phong benh|dan so|an toan thuc pham|an toan, vsld|van hoa|the duc|tin nguong|ton giao|xuat ban|phat thanh|thong tin dien tu|my thuat|quang cao|gia dinh|khoa hoc|cong nghe|cong chuc|can bo|thi dua|td-kt|dan toc|hoi$|quy$|chinh sach$|giam ngheo|te nan'),
        ('ktdt', r'dat dai|xay dung|nha o|quy hoach|ha tang|tai nguyen|moi truong|khoang san|dia chat|nong|lam nghiep|kiem lam|thuy|chan nuoi|trong trot|thu y|de dieu|thien tai|bien va hai dao|ho kinh doanh|hop tac|kinh te|hang hoa|thuong mai|kinh doanh khi|cong san|cho|cong nghiep|dien luc|duong bo|chuong trinh muc tieu|ban hang|bao hiem \(bo tai chinh\)|nguoi tieu dung'),
    ]
    for dept, pattern in rules:
        if re.search(pattern, d):
            return dept
    return 'review'


def paper_role(name, section=''):
    n, s = folded(name).strip(' -•'), folded(section)
    if len(n) > 850 or (re.search(r'\b(don|to khai|ban khai)\b', n) and re.search(r'\bban sao\b', n)):
        return 'mixed_or_conditional', 'Mô tả gộp nhiều giấy tờ/điều kiện; cần tách trước khi điền.'
    if re.match(r'(ban sao|ban chup|ban chinh|ho chieu|the can cuoc|can cuoc|chung minh nhan dan|giay khai sinh|giay chung nhan|trich luc|bang tot nghiep|anh\b)', n):
        return 'supporting_issued', 'Giấy tờ đã được cấp hoặc bản sao/xuất trình; không điền như tờ khai.'
    if re.match(r'(to trinh|quyet dinh|ket luan|phieu chuyen|thong bao|cong van|giay gioi thieu|bien ban)', n) or re.search(r'ho so trinh|ho so tham dinh', s):
        return 'agency_prepared', 'Văn bản của cơ quan/khâu trình, thẩm định; không tự điền thay người dân.'
    if re.search(r'\b(to khai|ban khai|don de nghi|don dang ky|don yeu cau|giay de nghi|phieu yeu cau|ban tuong trinh|ban cam ket|van ban de nghi|giay dang ky|so yeu ly lich)\b', n):
        return 'applicant_fillable', 'Tên thành phần là mẫu kê khai/đề nghị của người nộp.'
    if re.search(r'hop dong|van ban uy quyen|giay uy quyen|phuong an|de an|dieu le|bao cao|danh sach|bang ke|ban ke khai', n):
        return 'applicant_prepared', 'Tài liệu người nộp/tổ chức lập; cần đọc mẫu để xác định ô nhập và vai trò.'
    return 'needs_review', 'Chưa đủ căn cứ để khẳng định có ô người dân điền.'


def extract_text(path):
    if path.suffix.lower() == '.pdf':
        import fitz
        with fitz.open(path) as pdf:
            return '\n'.join(p.get_text() for p in pdf), 'pdf_native'
    # Legacy OLE .doc files can contain embedded ZIP shapes. is_zipfile alone
    # mistakes those for a DOCX and loses the entire actual document text.
    if path.read_bytes()[:4] == b'PK\x03\x04':
        with zipfile.ZipFile(path) as z:
            root = ET.fromstring(z.read('word/document.xml'))
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        lines = []
        for p in root.findall('.//w:p', ns):
            lines.append(''.join(e.text or '' if e.tag.endswith('}t') else '\t'
                                 for e in p.iter() if e.tag in {f'{{{ns["w"]}}}t', f'{{{ns["w"]}}}tab'}))
        return '\n'.join(lines), 'docx_xml'
    result = subprocess.run(['textutil', '-convert', 'txt', '-stdout', str(path)], capture_output=True, timeout=30)
    if result.returncode:
        raise ValueError(result.stderr.decode(errors='replace')[:150])
    return result.stdout.decode(errors='replace'), 'doc_textutil_readonly'


def candidate_slots(text):
    slots = []
    for line_no, line in enumerate(text.splitlines(), 1):
        for m in re.finditer(r'(?:[.][ \t]*){3,}|…+|_{3,}', line):
            prefix = line[:m.start()].strip()
            # Raw evidence only, not asserted field semantics. Avoid endless dot continuations.
            slots.append({'line': line_no, 'offset': m.start(), 'label_candidate': prefix[-180:],
                          'printed_context': line[:400], 'kind': 'dotted_blank'})
    return slots


def main():
    lib = json.loads((SOURCE / 'library.json').read_text())
    procedures, by_code = [], collections.defaultdict(list)
    for e in lib['entries']:
        dept = route(e.get('domain', ''))
        components = []
        for detail in e.get('details', []):
            for c in detail.get('components', []):
                role, reason = paper_role(c['name'], c.get('section', ''))
                components.append({'code': c.get('component_code'), 'name': c['name'], 'section': c.get('section'),
                                   'input_class': role, 'reason': reason,
                                   'required_as_published': c.get('required_as_published'),
                                   'source_url': detail['source_url'],
                                   'file_ids': [f['id'] for f in c.get('download_files', [])]})
        row = {'id': e['id'], 'procedure_code': e['procedure_code'], 'name': e['name'],
               'domain': e.get('domain', ''), 'department_id': dept, 'department': DEPARTMENTS[dept],
               'routing_status': 'inferred_from_domain_requires_local_review',
               'routing_reason': f"Lĩnh vực trong nguồn: {e.get('domain', '')}",
               'authority_as_published': e.get('competent_authority'),
               'execution_level_as_published': e.get('execution_level'),
               'receiving_location_as_published': e.get('receiving_location'),
               'baseline': e.get('baseline'), 'current': e.get('current'),
               'lifecycle': e.get('lifecycle'), 'components': components,
               'source_urls': [d['source_url'] for d in e.get('details', [])] or [e.get('inventory_source_url')],
               'blank_files': [f['id'] for f in e.get('blank_files', [])]}
        procedures.append(row)
        by_code[e['procedure_code']].append(row)
    papers = []
    for p in json.loads((SOURCE / 'papers.json').read_text()):
        classifications = [paper_role(n) for n in p['names']]
        roles = set(r[0] for r in classifications)
        role = next(iter(roles)) if len(roles) == 1 else 'mixed_or_conditional'
        depts = sorted({e['department_id'] for c in p['procedure_codes'] for e in by_code[c]})
        papers.append({**p, 'department_ids': depts, 'input_class': role,
                       'classification_method': 'rules_on_published_component_description',
                       'reason': classifications[0][1] if len(roles) == 1 else 'Tên cùng mã dẫn đến nhiều vai trò; cần duyệt.',
                       'has_applicant_input': True if role == 'applicant_fillable' else False if role == 'supporting_issued' else None})
    unique = {}
    for f in lib['files']:
        if f['kind'] == 'blank_form' and f['status'] == 'downloaded':
            unique.setdefault(f['sha256'], []).append(f)
    templates = []
    for digest, versions in unique.items():
        f = versions[0]
        tid = 'template-' + digest[:16]
        try:
            text, method = extract_text(SOURCE / f['local_path'])
            error = None
        except Exception as exc:
            text, method, error = '', 'failed', str(exc)
        cache = OUT / 'template-text' / (tid + '.txt')
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(text)
        slots = candidate_slots(text)
        # Inspect title region, not citations or instructions near the bottom.
        top = text[:1800]
        role, reason = paper_role(f['references'][0].get('component', ''))
        if re.search(r'(?im)^\s*(?:tờ khai|bản khai|đơn đề nghị|đơn đăng ký|đơn yêu cầu|giấy đề nghị|phiếu yêu cầu|bản tường trình)', top):
            role, reason = 'applicant_fillable', 'Đọc thấy tiêu đề mẫu kê khai trong chính tệp gốc.'
        elif re.search(r'(?im)^\s*(?:quyết định|tờ trình|giấy chứng nhận|thông báo|biên bản)\s*$', top):
            role, reason = 'agency_prepared', 'Tiêu đề tệp là văn bản lập/cấp/xác nhận, không phải đơn kê khai.'
        if not text.strip():
            state = 'needs_ocr_or_file_repair'
        elif role == 'applicant_fillable' and slots:
            state = 'applicant_inputs_detected'
        elif role == 'supporting_issued':
            state = 'supporting_document'
        elif role == 'agency_prepared':
            state = 'agency_inputs_only_or_mixed'
        else:
            state = 'needs_layout_review'
        refs = [r for v in versions for r in v['references']]
        templates.append({'id': tid, 'filename': f['filename'], 'sha256': digest,
                          'attachment_ids': [v['id'] for v in versions], 'local_path': '../official-forms/' + f['local_path'],
                          'text_path': str(cache.relative_to(OUT)), 'extraction_method': method, 'error': error,
                          'procedure_codes': sorted({r['procedure_code'] for r in refs}),
                          'source_urls': sorted({r['source_url'] for r in refs}),
                          'department_ids': sorted({e['department_id'] for r in refs for e in by_code[r['procedure_code']]}),
                          'input_class': role, 'input_status': state, 'reason': reason,
                          'slot_candidate_count': len(slots), 'slot_candidates': slots,
                          'field_schema_status': 'candidates_not_reviewed',
                          'generation_status': 'pending_schema_and_layout_review' if state == 'applicant_inputs_detected' else 'not_eligible_without_review'})
    stats = {'procedures': len(procedures), 'paper_descriptions': len(papers), 'unique_attachments': len(templates),
             'department_counts': dict(collections.Counter(p['department_id'] for p in procedures)),
             'paper_input_counts': dict(collections.Counter(p['input_class'] for p in papers)),
             'template_input_counts': dict(collections.Counter(t['input_status'] for t in templates)),
             'input_candidates': sum(t['slot_candidate_count'] for t in templates)}
    result = {'version': 1, 'generated_on': '2026-11-13', 'departments': DEPARTMENTS, 'routing_sources': ROUTING_SOURCES,
              'notes': ['Phân phòng là gợi ý từ lĩnh vực, chưa phải phân công chính thức cho từng thủ tục.',
                        'Dữ liệu COMMUNE trên DVC có dịch vụ ngành dọc; không đồng nghĩa thuộc thẩm quyền giải quyết của UBND phường.',
                        'Một mô tả thành phần có thể gộp nhiều loại hoặc trường hợp; 3964 mô tả không phải 3964 mẫu đơn.',
                        'Ứng viên ô trống chưa phải schema được duyệt. Không điền tự động vào chỗ ký, dấu, xác nhận của cơ quan.'],
              'stats': stats, 'procedures': procedures, 'papers': papers, 'templates': templates}
    save(OUT / 'classification.json', result)
    save(OUT / 'classification-summary.json', stats)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
