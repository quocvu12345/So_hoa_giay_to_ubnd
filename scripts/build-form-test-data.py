#!/usr/bin/env python3
"""Fill reviewed applicant slots on exact government PDF pages.

No hidden OCR answer text. Dataset PDFs are raster-only; labels are separate.
The source PDF and printed layout are never regenerated from extracted text.
Font simulation is explicitly labelled and does NOT measure real handwriting.
"""
import collections
import hashlib
import io
import json
from pathlib import Path
import random
import zipfile

import fitz
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

from form_fixtures.definitions import definitions, profile, ROOT, SOURCE

OUT = ROOT / 'data/form-test-data'
FONT = ROOT / 'data/citizen-samples/fonts/PatrickHand-Regular.ttf'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def fill(form, variant, person, blank, partial):
    source = SOURCE / form['source_file']
    original = fitz.open(source)
    # Render the actual source page object. Cloning a page first can change
    # inherited color spaces and cause small gray-level shifts in printed text.
    doc = original
    selected_pages = [doc[n - 1] for n in form['source_pages']]
    sid = f"formtest-{form['id']}-{variant}"
    rng = random.Random(sid)
    values, truth, issues = profile(person), [], []
    keys = collections.Counter()
    for field in form['fields']:
        spec = field['value_spec']
        value = values[spec[1:]] if spec.startswith('$') else spec
        key = field['id']
        keys[key] += 1
        # Repeated printed values still have independent slot identities.
        field_id = key if keys[key] == 1 else f'{key}.occurrence{keys[key]}'
        state = 'blank_form' if blank else 'intentionally_missing' if partial and ('identity' in key or key.endswith('.id')) else 'filled'
        if state == 'filled' and not value:
            state = 'unselected_option'
        truth.append({k: v for k, v in field.items() if k != 'value_spec'} | {
            'id': field_id, 'semantic_key': key, 'value': value if state == 'filled' else '',
            'expected_status': state, 'bbox_unit': 'pdf_point', 'coordinate_origin': 'top_left',
            **({'checked': state == 'filled'} if field['input_type'] == 'checkbox' else {})})
    for pn, page in enumerate(selected_pages, 1):
        ink = io.BytesIO()
        canvas = Canvas(ink, pagesize=(page.rect.width, page.rect.height), pageCompression=1)
        canvas.setFillColorRGB(.12, .23, .46)
        for field in truth:
            if field['page'] != pn or field['expected_status'] != 'filled':
                continue
            value = field['value']
            x0, y0, x1, y1 = field['bbox']
            # At right edge, extend a terminal year slightly into unused margin.
            if x1 > 515 and x1 - x0 < 22 and len(value) == 4 and value.isdigit():
                x1 = min(x1 + 10, page.rect.width - 40)
                field['bbox'][2] = x1
            width = x1 - x0 - 2
            fontsize = min(12.3 + rng.uniform(-.3, .3), width / max(.001, pdfmetrics.stringWidth(value, 'FixtureHand', 1)))
            if fontsize < 6.4:
                issues.append({'field': field['id'], 'reason': 'text_does_not_fit', 'font_size': fontsize})
            # A single run avoids jittering combining marks away from their base letter.
            baseline = field['baseline'] - 1.7
            canvas.saveState()
            canvas.translate(x0 + 1, page.rect.height - baseline)
            canvas.rotate(rng.uniform(-.35, .35))
            canvas.setFont('FixtureHand', fontsize)
            canvas.drawString(0, 0, value)
            canvas.restoreState()
            field['font_size'] = round(fontsize, 2)
            field['ink_bbox'] = [round(x0 + 1, 2), round(baseline - fontsize, 2),
                                 round(x0 + 1 + pdfmetrics.stringWidth(value, 'FixtureHand', fontsize), 2), round(baseline + 2, 2)]
        canvas.setFont('FixtureHand', 9)
        canvas.setFillColorRGB(.55, .12, .12)
        canvas.drawString(38, page.rect.height - 19, 'DỮ LIỆU TEST GIẢ LẬP · KHÔNG PHẢI HỒ SƠ THẬT')
        canvas.setFont('FixtureHand', 7.5)
        canvas.drawString(38, 12, f'{sid} · Chữ điền bằng font mô phỏng · Chỗ ký và xác nhận giữ trống')
        canvas.save()
        overlay = fitz.open(stream=ink.getvalue(), filetype='pdf')
        page.show_pdf_page(page.rect, overlay, 0, overlay=True)
    # Reject broken layouts before any PDF/manifest is shipped.
    if issues:
        raise ValueError(f'{sid}: {issues}')
    output = OUT / 'pdf' / (sid + '.pdf')
    output.parent.mkdir(parents=True, exist_ok=True)
    raster = fitz.open()
    for n, page in enumerate(selected_pages):
        pix = page.get_pixmap(dpi=170, alpha=False)
        out_page = raster.new_page(width=page.rect.width, height=page.rect.height)
        out_page.insert_image(out_page.rect, stream=pix.tobytes('png'))
        if person == 0 and not partial:
            (OUT / 'previews').mkdir(exist_ok=True)
            pix.save(OUT / 'previews' / f'{sid}-p{n + 1}.png')
    raster.set_metadata({'title': form['title'] + ' · dữ liệu test giả lập', 'author': 'Synthetic test fixture generator',
                         'subject': 'Font simulation; never real handwriting or a filed record'})
    raster.save(output, deflate=True, garbage=4)
    with fitz.open(output) as check:
        assert all(not p.get_text().strip() for p in check), 'Hidden answer text leaked into raster test PDF'
    record = {'id': sid, 'title': form['title'] + ' · ' + variant,
              'local_path': str(output.relative_to(ROOT)), 'sha256': digest(output), 'byte_size': output.stat().st_size,
              'media_type': 'application/pdf', 'page_count': len(selected_pages), 'first_page_size_pt': list(selected_pages[0].rect)[2:],
              'dataset': 'official-input-tests-v1', 'sample_kind': 'synthetic_blank_control' if blank else 'synthetic_handwriting_font',
              'template_id': form['id'], 'department_id': form['department_id'], 'procedure_codes': form['procedure_codes'],
              'document_form': form['title'], 'publisher': 'Mẫu công khai · dữ liệu test giả lập',
              'original_path': str(source.relative_to(ROOT)), 'original_sha256': digest(source),
              'source_pages': form['source_pages'], 'source_url': form['source_url'],
              'label_review_status': 'curated_slot_mapping', 'conversion': 'Exact source PDF page + ink overlay → raster-only PDF',
              'verification': 'Mẫu thử OCR, chữ bằng font; chưa đánh giá chữ viết tay thật.',
              'ground_truth_path': f'ground-truth/{sid}.json', 'filled_field_count': sum(f['expected_status'] == 'filled' for f in truth)}
    save(OUT / record['ground_truth_path'], {'document_id': sid, 'template_id': form['id'], 'source_sha256': record['original_sha256'],
         'scenario': variant, 'synthetic': True, 'handwriting_kind': 'font_simulation',
         'fields': truth, 'reserved_and_unselected_slots': form['unfilled_slots'],
         'reserved_regions': ['chữ ký', 'dấu', 'xác nhận của cơ quan'],
         'evaluation_note': 'Score values by field ID AND role/page/region. A matching value elsewhere on the page is not a correct extraction.'})
    return record


def main():
    pdfmetrics.registerFont(TTFont('FixtureHand', str(FONT)))
    bundles = json.loads((ROOT / 'data/official-forms/source-bundles.json').read_text())
    alts = json.loads((ROOT / 'data/official-forms/template-alternatives.json').read_text())
    sources = {Path(s['local_path']).name: s['source_url'] for s in bundles + alts}
    forms, records = definitions(), []
    for form in forms:
        form['source_url'] = sources[form['source_file']]
        form['source_sha256'] = digest(SOURCE / form['source_file'])
        for variant, person, blank, partial in [('blank', 0, True, False), ('filled-a', 0, False, False),
                                                ('filled-b', 1, False, False), ('filled-c', 2, False, False),
                                                ('missing-id', 0, False, True)]:
            if partial and not any('identity' in f['id'] or f['id'].endswith('.id') for f in form['fields']):
                continue
            records.append(fill(form, variant, person, blank, partial))
        print(form['id'], len(form['fields']), flush=True)
    save(OUT / 'schemas.json', {'forms': forms, 'notes': ['Schema chỉ áp dụng đúng trang nguồn và phiên bản có hash tương ứng.',
                                                        'Các ô liên quan cùng một người được ghi rõ role, không suy vai trò từ giá trị trùng.']})
    manifest = {'dataset': 'official-input-tests-v1', 'documents': records,
                'stats': {'reviewed_templates': len(forms), 'documents': len(records),
                          'filled_documents': sum(r['filled_field_count'] > 0 for r in records),
                          'blank_controls': sum(r['filled_field_count'] == 0 for r in records),
                          'filled_fields': sum(r['filled_field_count'] for r in records),
                          'schema_fields': sum(len(f['fields']) for f in forms)}}
    save(OUT / 'manifest.json', manifest)
    print(json.dumps(manifest['stats'], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
