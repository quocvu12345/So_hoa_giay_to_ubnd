#!/usr/bin/env python3
"""Check full dataset hashes, blank controls, labels, background preservation."""
import collections
import hashlib
import json
from pathlib import Path
import fitz
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/form-test-data'


def main():
    manifest = json.loads((DATA / 'manifest.json').read_text())
    source_cache, seen, errors, checked_pages = {}, set(), [], 0
    for row in manifest['documents']:
        try:
            assert row['id'] not in seen, 'duplicate document id'
            seen.add(row['id'])
            path = ROOT / row['local_path']
            assert hashlib.sha256(path.read_bytes()).hexdigest() == row['sha256'], 'output hash mismatch'
            source = ROOT / row['original_path']
            assert hashlib.sha256(source.read_bytes()).hexdigest() == row['original_sha256'], 'source hash mismatch'
            truth = json.loads((DATA / row['ground_truth_path']).read_text())
            assert len({f['id'] for f in truth['fields']}) == len(truth['fields']), 'duplicate field id'
            assert sum(bool(f['value']) for f in truth['fields']) == row['filled_field_count'], 'count mismatch'
            with fitz.open(path) as pdf:
                assert len(pdf) == row['page_count'], 'page count mismatch'
                for n, page in enumerate(pdf, 1):
                    assert not page.get_text().strip(), 'hidden OCR answer text'
                    assert not list(page.widgets() or []), 'hidden form fields'
                    images = page.get_images()
                    assert len(images) == 1, 'expected one raster image per page'
                    pix = fitz.Pixmap(pdf, images[0][0])
                    actual = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
                    key = (str(source), row['source_pages'][n - 1])
                    if key not in source_cache:
                        with fitz.open(source) as original:
                            p = original[key[1] - 1].get_pixmap(dpi=170, alpha=False)
                            source_cache[key] = Image.frombytes('RGB', (p.width, p.height), p.samples)
                    expected = source_cache[key]
                    assert actual.size == expected.size, 'source geometry changed'
                    mask = Image.new('L', actual.size, 255)
                    draw = ImageDraw.Draw(mask)
                    scale = 170 / 72
                    draw.rectangle((0, 0, pix.width, int(24 * scale)), fill=0)
                    draw.rectangle((0, int((page.rect.height - 23) * scale), pix.width, pix.height), fill=0)
                    for field in truth['fields']:
                        if field['page'] != n:
                            continue
                        x0, y0, x1, y1 = field['bbox']
                        assert 0 <= x0 < x1 <= page.rect.width and 0 <= y0 < y1 <= page.rect.height, 'field outside page'
                        if field['value']:
                            draw.rectangle((max(0, int((x0 - 3) * scale)), max(0, int((y0 - 7) * scale)),
                                            int((x1 + 3) * scale), int((y1 + 7) * scale)), fill=0)
                    diff = ImageChops.difference(actual, expected)
                    delta = ImageChops.multiply(ImageChops.lighter(ImageChops.lighter(diff.getchannel('R'), diff.getchannel('G')), diff.getchannel('B')), mask)
                    assert delta.getbbox() is None, 'printed background changed outside input areas'
                    checked_pages += 1
        except Exception as exc:
            errors.append({'document_id': row['id'], 'error': str(exc)})
    report = {'documents': len(seen), 'checked_pages': checked_pages, 'errors': errors,
              'checks': ['original hashes', 'output hashes', 'unique IDs', 'label counts', 'raster only',
                         'no hidden AcroForm', 'bounds', 'source pixels unchanged outside ink and test watermark'],
              'not_checked': ['real handwriting accuracy', 'legal eligibility for submission', 'all candidate attachments filled']}
    (DATA / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
