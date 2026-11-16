"""Verify coverage and raster/background invariants, then package the dataset."""
import collections
import hashlib
import json
from pathlib import Path
import zipfile

import fitz
from PIL import Image, ImageChops, ImageDraw

from .pipeline import save, sha, source_path


def verify(args, rows, out):
    manifest = json.loads((out / 'manifest.json').read_text())
    records = manifest['documents']
    by_template = collections.defaultdict(list)
    errors, counts, checked_pages = [], collections.Counter(), 0
    ids = [r['id'] for r in records]
    if len(ids) != len(set(ids)):
        errors.append({'error': 'duplicate_document_ids'})
    for r in records:
        by_template[r['template_id']].append(r)
    per_template = []
    for index, t in enumerate(rows, 1):
        template_errors = []
        copies = by_template[t['id']]
        if len(copies) != args.copies:
            template_errors.append(f'Expected {args.copies} copies, got {len(copies)}')
        if sha(source_path(args.root, t)) != t['sha256']:
            template_errors.append('original_source_hash_changed')
        if len({r['sha256'] for r in copies}) != len(copies):
            template_errors.append('copies_are_identical')
        pdf_source = out / 'source-pdf' / f"{t['id']}.pdf"
        with fitz.open(pdf_source) as source:
            original_images = {}
            for pn, page in enumerate(source, 1):
                pix = page.get_pixmap(dpi=150, alpha=False)
                original_images[pn] = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
            for r in copies:
                try:
                    path = args.root / r['local_path']
                    assert sha(path) == r['sha256'], 'output hash mismatch'
                    truth = json.loads((out / r['ground_truth_path']).read_text())
                    assert truth['document_id'] == r['id']
                    assert len({f['id'] for f in truth['fields']}) == len(truth['fields']), 'duplicate field IDs'
                    assert sum(bool(f['value']) for f in truth['fields']) == r['filled_field_count'] > 0
                    assert truth['original_sha256'] == t['sha256']
                    with fitz.open(path) as pdf:
                        assert len(pdf) == len(source), 'page count changed from office rendering'
                        for pn, page in enumerate(pdf, 1):
                            assert not page.get_text().strip(), 'hidden answer text'
                            assert not list(page.widgets() or []), 'hidden AcroForm values'
                            assert page.rect == source[pn - 1].rect, 'page dimensions changed'
                            images = page.get_images()
                            assert len(images) == 1, 'expected a single raster image'
                            pix = fitz.Pixmap(pdf, images[0][0])
                            actual = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
                            expected = original_images[pn]
                            assert actual.size == expected.size, 'raster size mismatch'
                            mask = Image.new('L', actual.size, 255)
                            draw = ImageDraw.Draw(mask)
                            scale = 150 / 72
                            # Visible test labels in left and bottom page margins.
                            draw.rectangle((0, 0, int(15 * scale), pix.height), fill=0)
                            draw.rectangle((0, int((page.rect.height - 18) * scale), pix.width, pix.height), fill=0)
                            for f in truth['fields']:
                                if f['page'] != pn or not f['value']:
                                    continue
                                x0, y0, x1, y1 = f['ink_bbox']
                                assert -1 <= x0 < x1 <= page.rect.width + 1
                                assert -1 <= y0 < y1 <= page.rect.height + 1
                                draw.rectangle((max(0, int((x0 - 3) * scale)), max(0, int((y0 - 3) * scale)),
                                                int((x1 + 3) * scale), int((y1 + 3) * scale)), fill=0)
                            difference = ImageChops.difference(actual, expected)
                            maximum = ImageChops.lighter(ImageChops.lighter(difference.getchannel('R'), difference.getchannel('G')), difference.getchannel('B'))
                            assert ImageChops.multiply(maximum, mask).getbbox() is None, 'printed background changed outside insertion areas'
                            checked_pages += 1
                    counts['filled_values'] += r['filled_field_count']
                    counts['intentional_missing_values'] += r['intentionally_missing_fields']
                    counts['fit_issues_left_blank'] += r['fit_issues']
                    counts['valid_documents'] += 1
                except Exception as exc:
                    template_errors.append(r['id'] + ': ' + str(exc))
        per_template.append({'template_id': t['id'], 'filename': t['filename'], 'expected_copies': args.copies,
                             'actual_copies': len(copies), 'nonempty_copies': sum(r['filled_field_count'] > 0 for r in copies),
                             'document_ids': [r['id'] for r in copies], 'errors': template_errors})
        errors.extend({'template_id': t['id'], 'error': e} for e in template_errors)
        if index % 30 == 0 or index == len(rows):
            print(f'verify {index}/{len(rows)} templates; errors {len(errors)}', flush=True)
            save(out / 'progress.json', {'stage': 'verify', 'completed': index, 'target': len(rows), 'errors': len(errors)})
    report = {'expected_templates': len(rows), 'expected_documents': len(rows) * args.copies,
              'actual_documents': len(records), 'checked_pages': checked_pages, 'counts': dict(counts), 'errors': errors,
              'automated_checks': ['original hashes', 'output hashes', 'exact per-template copy count', 'unique nonidentical copies',
                                   'nonempty filled fields', 'field IDs and value counts', 'source page dimensions',
                                   'raster only, no hidden answers', 'source pixels unchanged outside ink/test marks'],
              'limitations': ['Automatic field semantics still require domain review.',
                              'Word layout is the LibreOffice rendering, which may differ from Microsoft Word pagination.',
                              'Fonts simulate handwriting. This batch is not a real-handwriting benchmark.']}
    save(out / 'verification.json', report)
    save(out / 'coverage.json', {'stats': manifest['stats'], 'templates': per_template})
    if errors:
        raise RuntimeError(f'{len(errors)} verification errors; see verification.json')


def contact_sheets(out, rows):
    qa = out / 'qa'
    qa.mkdir(exist_ok=True)
    for start in range(0, len(rows), 20):
        sheet = Image.new('RGB', (1500, 1800), 'white')
        draw = ImageDraw.Draw(sheet)
        for index, t in enumerate(rows[start:start + 20]):
            sid = f"vnform-{t['sha256'][:16]}-01"
            preview = out / 'previews' / (sid + '.png')
            if not preview.is_file():
                continue
            with Image.open(preview) as img:
                img.thumbnail((290, 405))
                x, y = (index % 5) * 300, (index // 5) * 450
                sheet.paste(img, (x + (300 - img.width)//2, y))
                draw.text((x + 7, y + 411), t['id'][-16:], fill='black')
                draw.text((x + 7, y + 427), str(start + index + 1), fill='black')
        sheet.save(qa / f'contact-{start // 20 + 1:02}.jpg', quality=90)


def package(args, rows, out):
    from .web import build_index
    manifest = json.loads((out / 'manifest.json').read_text())
    verification = json.loads((out / 'verification.json').read_text())
    if verification['errors']:
        raise RuntimeError('Fix verification errors before packaging a complete dataset.')
    contact_sheets(out, rows)
    build_index(args.root, rows, manifest, verification, out)
    stats = manifest['stats']
    save(out / 'progress.json', {'stage': 'complete', **stats})
    (out / 'README.txt').write_text(f'''Vietnamese Form Dataset — synthetic administrative form fixtures

{stats['target_templates']} source attachments × {stats['copies_per_template']} copies = {stats['documents']} nonempty synthetic PDFs.
{stats['pages']} PDF pages; {stats['filled_fields']} inserted values with separate ground-truth JSON.
Two OFL font styles: Patrick Hand and Mali. All records and identifiers are synthetic; not real handwriting.
Original Word files are rendered by LibreOffice 26.8.3.1 and preserved as PDF backgrounds.
The layout authority for insertion coordinates is source-pdf/<template_id>.pdf, not text reconstructed from a document.
Original source hashes and public source URLs are in targets.json and manifest.json.

Only recognized applicant fields are filled. Official signatures, stamps and confirmation sections are reserved.
Unresolved labels, unfitted values and conditional/unused slots remain explicit in schemas/ and ground-truth/.
Schema semantics are automatically inferred, not manually reviewed legal classifications.
Some second copies intentionally omit one optional contact/identity field. Check expected_status before scoring.

Use pdf/ as OCR input. Use ground-truth/ only for scoring or supervised labels, never as part of the OCR prompt.
Value matching must use field ID, role and page/region; finding a name elsewhere on a page does not count.
The PDFs contain a raster image per page and no hidden answer text or AcroForm values.
verification.json documents hash, count, bounds and printed-background checks for all PDFs.
Contact sheets under qa/ are for visual inspection. Automatic checks do not prove every semantic label correct.

Open index.html offline or http://127.0.0.1:8765/vietnamese-form-dataset/ to browse sources, copies and labels.
The skill source is in the project skills/vietnamese-form-dataset/ directory and installed in the user's Codex skills directory.
''')
    selected = {'targets.json','settings.json','manifest.json','coverage.json','verification.json','schema-review.json',
                'index.html','README.txt','progress.json','conversion-report.json'}
    dirs = {'pdf','ground-truth','schemas','source-pdf','previews'}
    archive_path = out / 'vietnamese-form-dataset-441x2.zip'
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=5) as archive:
        for path in sorted(out.rglob('*')):
            rel = path.relative_to(out)
            if path.is_file() and (str(rel) in selected or rel.parts[0] in dirs):
                archive.write(path, 'vietnamese-form-dataset/' + str(rel))
        for base, names in [(args.root / 'data/citizen-samples/fonts', ['PatrickHand-Regular.ttf','OFL.txt']),
                            (args.root / 'data/form-test-data/fonts', ['Mali-Regular.ttf','Mali-OFL.txt'])]:
            for name in names:
                archive.write(base / name, 'vietnamese-form-dataset/fonts/' + name)
        skill = Path(__file__).resolve().parents[2]
        for path in sorted(skill.rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts:
                archive.write(path, 'skill/vietnamese-form-dataset/' + str(path.relative_to(skill)))
    save(out / 'archive-info.json', {'filename': archive_path.name, 'bytes': archive_path.stat().st_size, 'sha256': sha(archive_path)})
    print(f'Packaged {stats["documents"]} PDFs; ZIP {archive_path.stat().st_size:,} bytes', flush=True)
