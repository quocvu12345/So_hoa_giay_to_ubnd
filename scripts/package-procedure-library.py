#!/usr/bin/env python3
"""Package only the catalog, its source evidence and the downloaded originals."""
import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/official-forms'


def main():
    data = json.loads((OUT / 'library.json').read_text())
    paths = {OUT / name for name in [
        'index.html', 'README.txt', 'Danh-muc-ho-so-thu-tuc-phuong-Tu-Liem.xlsx',
        'library.json', 'files.json', 'inventory.csv', 'missing-files.csv', 'papers.json',
        'coverage.json', 'validation.json', 'source-bundles.json', 'reconciliation.json', 'template-alternatives.json', 'lifecycle.json',
        'procedures.json', 'current-ward-procedures.json', 'originals/hanoi-425-procedures-2026.pdf']}
    for record in data['files']:
        if record['status'] == 'downloaded':
            paths.add(OUT / record['local_path'])
    for source in data['source_bundles']:
        paths.add(OUT / source['local_path'])
    for entry in data['entries']:
        for detail in entry['details']:
            paths.add(OUT / detail['raw_path'])
    checksum_lines = []
    for path in sorted(paths):
        assert path.resolve().is_relative_to(OUT.resolve()) and path.is_file(), path
        checksum_lines.append(hashlib.sha256(path.read_bytes()).hexdigest() + '  ' + str(path.relative_to(OUT)))
    manifest = OUT / 'SHA256SUMS.txt'
    manifest.write_text('\n'.join(checksum_lines) + '\n'); paths.add(manifest)
    target = OUT / 'thu-tuc-phuong-tu-liem-ban-mem.zip'
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(paths):
            archive.write(path, Path('Tu-Liem-thu-tuc-ban-mem') / path.relative_to(OUT))
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        count = len(archive.namelist())
    result = {'path': str(target.relative_to(ROOT)), 'files': count, 'bytes': target.stat().st_size,
              'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
    (OUT / 'package.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
