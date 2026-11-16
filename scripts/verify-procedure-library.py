#!/usr/bin/env python3
"""Verify downloaded bytes, native file formats, inventory coverage and links."""
import collections
import hashlib
import json
import zipfile
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/official-forms'


def main():
    data = json.loads((OUT / 'library.json').read_text())
    baseline = [r for r in data['entries'] if r['baseline']]
    current = [r for r in data['entries'] if r['current']]
    assert len(baseline) == 425
    assert {r['baseline_ordinal'] for r in baseline} == set(range(1, 426))
    assert len(current) == data['stats']['current_commune_procedures']
    assert all(d['is_ward'] for r in current for d in r['details'])
    counts = collections.Counter(); errors = []; checked = 0
    for record in data['files']:
        if record['status'] != 'downloaded':
            continue
        path = (OUT / record['local_path']).resolve()
        try:
            assert path.is_relative_to(OUT.resolve()) and path.is_file()
            raw = path.read_bytes()
            assert len(raw) == record['bytes']
            assert hashlib.sha256(raw).hexdigest() == record['sha256']
            if raw.startswith(b'%PDF-'):
                with fitz.open(path) as pdf:
                    assert len(pdf) > 0
                    # Render every PDF's first page to detect corrupt objects.
                    pdf[0].get_pixmap(matrix=fitz.Matrix(.2, .2))
                counts['pdf'] += 1
            elif raw[:2] == b'PK':
                with zipfile.ZipFile(path) as archive:
                    assert archive.testzip() is None
                    counts['word_ooxml' if 'word/document.xml' in archive.namelist() else 'zip_or_office'] += 1
            elif raw[:8] == bytes.fromhex('d0cf11e0a1b11ae1'):
                counts['office_legacy'] += 1
            elif path.suffix.lower() == '.json':
                json.loads(raw); counts['json'] += 1
            else:
                counts['other_format'] += 1
            checked += 1
        except Exception as error:
            errors.append({'path': record['local_path'], 'error': str(error) or type(error).__name__})
    for row in data['source_bundles']:
        path = OUT / row['local_path']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == row['sha256']
    for row in data.get('template_alternatives', []):
        with fitz.open(OUT / row['source_path']) as source, fitz.open(OUT / row['local_path']) as extract:
            assert len(extract) == len(row['source_pages'])
            for index, page in enumerate(row['source_pages']):
                assert source[page - 1].get_pixmap().samples == extract[index].get_pixmap().samples
    for row in data.get('lifecycle', []):
        for evidence in row['evidence']:
            with fitz.open(OUT / evidence['local_path']) as doc:
                assert row['procedure_code'] in doc[evidence['page'] - 1].get_text()
    report = {'baseline_count': len(baseline), 'current_count': len(current), 'checked_downloaded_files': checked,
              'formats': dict(counts), 'errors': errors,
              'pdf_template_alternatives_verified': len(data.get('template_alternatives', [])),
              'lifecycle_evidence_records_verified': len(data.get('lifecycle', [])),
              'unavailable_attachments': [r['filename'] for r in data['files'] if r['kind'] == 'blank_form' and r['status'] == 'failed']}
    (OUT / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
