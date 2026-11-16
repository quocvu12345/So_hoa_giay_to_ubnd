#!/usr/bin/env python3
"""Extract unchanged official PDF pages when public Word attachments are empty."""
import hashlib
import json
from pathlib import Path

import fitz
import requests

OUT = Path(__file__).resolve().parents[1] / 'data/official-forms'
RECIPES = [
    {
        'attachment_id': '019d714f-556b-73bf-82e2-75c07e538b39',
        'procedure_code': '2.002770',
        'source_url': 'https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/3/66-nd-2025.signed.pdf',
        'source_path': 'originals/education-66-2025.pdf',
        'source_pages': [27],
        'source_name': 'Nghị định 66/2025/NĐ-CP và phụ lục gốc',
        'version': 'NĐ 66/2025/NĐ-CP ngày 12/3/2025',
        'local_path': 'originals/mau-05-hoc-vien-ban-tru-nd66-2025-trang-27.pdf',
        'filename': 'Mẫu số 05 — học viên bán trú (PDF trích trang 27)',
        'note': 'Trích nguyên trang 27 của PDF gốc, không gõ lại nội dung. Tệp Word Mu05.docx trên DVC trả về rỗng.',
    },
    {
        'attachment_id': '01a0f14b-38ed-77e8-a001-22fcbe05bfa0',
        'procedure_code': '1.003702',
        'source_url': 'https://congbaocdn.chinhphu.vn/CongBaoCP/CongBao/2023/7/39818/45875-1-857-858.pdf',
        'source_path': 'originals/cong-bao-857-858-2023.pdf',
        'source_pages': [79],
        'source_name': 'Công báo 857 + 858 ngày 28/7/2023 — có bản hợp nhất NĐ 57/2017 và 104/2022',
        'version': 'NĐ 57/2017/NĐ-CP, hợp nhất sửa đổi NĐ 104/2022/NĐ-CP',
        'local_path': 'originals/mau-02-ho-tro-hoc-tap-cong-bao-2023-trang-79.pdf',
        'filename': 'Mẫu số 02 — hỗ trợ học tập (PDF trích trang 79)',
        'note': 'Trích nguyên trang 79 Công báo, gồm chú thích sửa đổi bởi NĐ 104/2022. Tệp Word Mẫu số 02.docx trên DVC trả về rỗng.',
    },
]


def main():
    bundles = json.loads((OUT / 'source-bundles.json').read_text())
    by_path = {row['local_path']: row for row in bundles}
    alternatives = []
    for recipe in RECIPES:
        source_path = OUT / recipe['source_path']
        if not source_path.is_file():
            response = requests.get(recipe['source_url'], timeout=40)
            response.raise_for_status()
            assert response.content.startswith(b'%PDF-')
            source_path.write_bytes(response.content)
        target = OUT / recipe['local_path']
        # Save to a temporary path so a rerun can replace the previous extract.
        temporary = target.with_suffix('.tmp.pdf')
        with fitz.open(source_path) as source, fitz.open() as extracted:
            for page in recipe['source_pages']:
                extracted.insert_pdf(source, from_page=page - 1, to_page=page - 1)
            extracted.save(temporary, garbage=4, deflate=True)
            temporary.replace(target)
            with fitz.open(target) as check:
                for index, page in enumerate(recipe['source_pages']):
                    assert check[index].get_pixmap().samples == source[page - 1].get_pixmap().samples
        row = {**recipe, 'id': 'extract-' + recipe['attachment_id'], 'kind': 'blank_form_extract',
               'status': 'downloaded', 'bytes': target.stat().st_size,
               'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'media_type': 'application/pdf',
               'source_sha256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
               'render_matches_source': True}
        alternatives.append(row)
        for path, name, sha in [(recipe['source_path'], recipe['source_name'], row['source_sha256']),
                                (recipe['local_path'], recipe['filename'], row['sha256'])]:
            by_path[path] = {'name': name, 'version': recipe['version'], 'local_path': path,
                             'source_url': recipe['source_url'], 'sha256': sha, 'note': recipe['note']}
    (OUT / 'template-alternatives.json').write_text(json.dumps(alternatives, ensure_ascii=False, indent=2))
    (OUT / 'source-bundles.json').write_text(json.dumps(list(by_path.values()), ensure_ascii=False, indent=2))
    print(f'{len(alternatives)} PDF extracts verified against their original pages')


if __name__ == '__main__':
    main()
