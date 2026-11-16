"""Write two independently seeded raster-only samples per exact source PDF."""
import concurrent.futures
import io
import hashlib
import json
import random
from pathlib import Path

import fitz
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

from .pipeline import save, sha, source_path
from .semantics import scenario, value_for


def generator_signature():
    parent = Path(__file__).parent
    return hashlib.sha256(b''.join((parent / n).read_bytes() for n in ['render.py', 'semantics.py', 'layout.py'])).hexdigest()


def fonts(root):
    choices = [('VNPatrick', root / 'data/citizen-samples/fonts/PatrickHand-Regular.ttf'),
               ('VNMali', root / 'data/form-test-data/fonts/Mali-Regular.ttf')]
    for name, path in choices:
        if name not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(name, str(path)))
    return choices


def generate_template(job):
    root, out, t, copies, seed = job
    root, out = Path(root), Path(out)
    styles = fonts(root)
    schema = json.loads((out / 'schemas' / f"{t['id']}.json").read_text())
    assert schema['fields'], 'A zero-field schema cannot produce filled samples.'
    records = []
    for copy in range(copies):
        sid = f"vnform-{t['sha256'][:16]}-{copy + 1:02}"
        source = out / 'source-pdf' / f"{t['id']}.pdf"
        font_name, font_path = styles[copy % len(styles)]
        data = scenario(t['id'], copy, seed, schema['context'])
        rng = random.Random(data['seed_number'])
        partial = copy % 2 == 1 and data['seed_number'] % 5 == 0 and len(schema['fields']) > 8
        omit = next((f['id'] for f in schema['fields'] if f['semantic_type'] in {'phone','email','person.id'}), None) if partial else None
        fields, issues = [], []
        for f in schema['fields']:
            entry = dict(f)
            x0, y0, x1, y1 = f['bbox']
            width = x1 - x0 - 2
            value = value_for(f['semantic_type'], f['label'], f['role'], data, width)
            assert value is not None
            status = 'intentionally_missing' if f['id'] == omit else 'filled'
            size = min(11.5 + rng.uniform(-.4, .4), (y1-y0) * .78,
                       width / max(.001, pdfmetrics.stringWidth(value, font_name, 1)))
            if size < 6.3:
                status = 'does_not_fit'
                issues.append({'field_id': f['id'], 'label': f['label'], 'value': value, 'reason': 'value_too_wide_for_original_slot'})
            entry.update(value=value if status == 'filled' else '', expected_status=status,
                         font_name=font_path.stem, font_size=round(size, 3), bbox_unit='pdf_point', coordinate_origin='top_left')
            if status == 'filled':
                baseline = f['baseline'] - 1.6
                length = pdfmetrics.stringWidth(value, font_name, size)
                entry['ink_bbox'] = [x0 + .5, baseline - size * 1.15, x0 + .5 + length, baseline + size * .32]
                entry['draw_baseline'] = baseline
            fields.append(entry)
        if not any(f['value'] for f in fields):
            raise ValueError(f"{t['id']} has no fitting filled fields")
        doc = fitz.open(source)
        output = fitz.open()
        for pn, page in enumerate(doc, 1):
            ink = io.BytesIO()
            canvas = Canvas(ink, pagesize=(page.rect.width, page.rect.height), pageCompression=1, invariant=1)
            canvas.setFillColorRGB(*((.10, .23, .43) if copy % 2 == 0 else (.15, .18, .24)))
            for f in fields:
                if f['page'] != pn or not f['value']:
                    continue
                canvas.setFont(font_name, f['font_size'])
                canvas.drawString(f['bbox'][0] + .5, page.rect.height - f['draw_baseline'], f['value'])
            canvas.saveState()
            canvas.setFillColorRGB(.60, .12, .12)
            canvas.setFont(font_name, 7)
            canvas.translate(8, 19)
            canvas.rotate(90)
            canvas.drawString(0, 0, 'DỮ LIỆU GIẢ LẬP ĐỂ TEST · KHÔNG PHẢI HỒ SƠ THẬT')
            canvas.restoreState()
            canvas.setFont(font_name, 6)
            canvas.setFillColorRGB(.60, .12, .12)
            canvas.drawString(22, 8, sid + ' · Font mô phỏng viết tay · Chỗ ký/dấu giữ trống')
            canvas.save()
            overlay = fitz.open(stream=ink.getvalue(), filetype='pdf')
            page.show_pdf_page(page.rect, overlay, 0, overlay=True)
            pix = page.get_pixmap(dpi=150, alpha=False)
            rendered = output.new_page(width=page.rect.width, height=page.rect.height)
            rendered.insert_image(rendered.rect, stream=pix.tobytes('png'))
            if pn == 1:
                preview = out / 'previews' / (sid + '.png')
                preview.parent.mkdir(exist_ok=True)
                pix.save(preview)
        path = out / 'pdf' / (sid + '.pdf')
        path.parent.mkdir(exist_ok=True)
        output.set_metadata({'title': 'Dữ liệu giả lập · ' + t['filename'], 'author': 'Vietnamese Form Dataset',
                             'subject': 'Synthetic font simulation for OCR testing'})
        output.save(path, garbage=4, deflate=True)
        truth_path = out / 'ground-truth' / (sid + '.json')
        save(truth_path, {'document_id': sid, 'template_id': t['id'], 'original_sha256': t['sha256'],
                         'rendered_source_sha256': schema['rendered_source_sha256'], 'synthetic': True,
                         'handwriting_kind': 'font_simulation', 'schema_review_status': schema['schema_status'],
                         'scenario': {'seed': data['seed_number'], 'copy': copy + 1, 'style': font_path.stem,
                                      'purpose': 'test_data_only', 'has_intentionally_missing_fields': bool(omit)},
                         'fields': fields, 'unfilled_candidates': schema['unfilled_candidates'], 'layout_issues': issues,
                         'reserved': ['chữ ký', 'dấu', 'phần xác nhận của cơ quan', 'dòng bảng không sử dụng']})
        record = {'id': sid, 'title': t['filename'] + f' · giả lập {copy + 1:02}', 'original_name': path.name,
                  'local_path': str(path.relative_to(root)), 'sha256': sha(path), 'byte_size': path.stat().st_size,
                  'page_count': len(output), 'first_page_size_pt': list(output[0].rect)[2:], 'media_type': 'application/pdf',
                  'dataset': 'official-input-tests-441-v1', 'sample_kind': 'synthetic_handwriting_font',
                  'template_id': t['id'], 'department_ids': t['department_ids'], 'procedure_codes': t['procedure_codes'],
                  'department_id': t['department_ids'][0] if t['department_ids'] else 'review',
                  'source_url': t['source_urls'][0] if t['source_urls'] else None,
                  'original_path': str(source_path(root, t).relative_to(root)), 'original_sha256': t['sha256'],
                  'rendered_source_path': str(source.relative_to(root)), 'ground_truth_path': str(truth_path.relative_to(out)),
                  'filled_field_count': sum(bool(f['value']) for f in fields), 'schema_field_count': len(fields),
                  'intentionally_missing_fields': sum(f['expected_status'] == 'intentionally_missing' for f in fields),
                  'fit_issues': len(issues), 'font_name': font_path.stem, 'publisher': 'Mẫu công khai · dữ liệu giả lập',
                  'label_review_status': 'automatic_layout_and_semantics', 'requires_review': True,
                  'schema_sha256': sha(out / 'schemas' / f"{t['id']}.json"),
                  'generator_signature': generator_signature(), 'generation_seed': seed,
                  'conversion': 'Original Word → LibreOffice PDF or original PDF → ink overlay → raster-only PDF'}
        save(out / 'records' / (sid + '.json'), record)
        records.append(record)
        output.close()
        doc.close()
    return records


def generate(args, rows, out):
    todos, done = [], 0
    for t in rows:
        existing = [out / 'records' / f"vnform-{t['sha256'][:16]}-{i + 1:02}.json" for i in range(args.copies)]
        if args.resume and all(p.is_file() for p in existing):
            saved = [json.loads(p.read_text()) for p in existing]
            schema_sha = sha(out / 'schemas' / f"{t['id']}.json")
            if all(r.get('schema_sha256') == schema_sha and r.get('generator_signature') == generator_signature()
                   and r.get('generation_seed') == args.seed and (args.root / r['local_path']).is_file()
                   and sha(args.root / r['local_path']) == r['sha256'] for r in saved):
                done += 1
                continue
        todos.append((str(args.root), str(out), t, args.copies, args.seed))
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.jobs) as pool:
        futures = {pool.submit(generate_template, job): job[2]['id'] for job in todos}
        for future in concurrent.futures.as_completed(futures):
            try:
                future.result()
                done += 1
            except Exception as exc:
                save(out / 'errors' / f"{futures[future]}.json", {'template_id': futures[future], 'error': str(exc)})
                print(f'ERROR {futures[future]}: {exc}', flush=True)
            if done % 15 == 0 or done == len(rows):
                print(f'generate {done}/{len(rows)} templates; {done * args.copies} PDFs', flush=True)
                save(out / 'progress.json', {'stage': 'generate', 'completed_templates': done, 'target_templates': len(rows),
                                             'generated_documents': done * args.copies})
    expected_ids = {f"vnform-{t['sha256'][:16]}-{i + 1:02}" for t in rows for i in range(args.copies)}
    records = [json.loads(p.read_text()) for p in sorted((out / 'records').glob('*.json')) if p.stem in expected_ids]
    save(out / 'manifest.json', {'dataset': 'official-input-tests-441-v1', 'documents': records,
        'stats': {'target_templates': len(rows), 'templates_with_outputs': len({r['template_id'] for r in records}),
                  'copies_per_template': args.copies, 'documents': len(records), 'expected_documents': len(expected_ids),
                  'filled_fields': sum(r['filled_field_count'] for r in records), 'pages': sum(r['page_count'] for r in records),
                  'fit_issues': sum(r['fit_issues'] for r in records)},
        'schema_review_status': 'automatic_layout_and_semantics', 'handwriting_kind': 'font_simulation'})
    if len(records) != len(expected_ids):
        raise RuntimeError(f'Missing {len(expected_ids) - len(records)} documents; see errors/')
