#!/usr/bin/env python3
"""Download the curated public attachments and verify exact bytes against the manifest.

Uses only Python's standard library. A changed upstream file is reported, not silently accepted.
"""
import argparse
import hashlib
import json
from pathlib import Path
import tempfile
from urllib.parse import quote, urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
HOSTS = {'datafiles.hanoi.gov.vn', 'storage-vnportal.vnpt.vn', 'sqhx-hanoi.mediacdn.vn'}


def encoded_url(url):
    u = urlsplit(url)
    if u.scheme != 'https' or u.hostname not in HOSTS:
        raise ValueError('Unexpected source host: ' + str(u.hostname))
    return urlunsplit((u.scheme, u.netloc, quote(u.path, safe='/%'), quote(u.query, safe='=&%'), ''))


def verify(path, item):
    return path.stat().st_size == item['byte_size'] and hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256']


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--key', help='Download one document key, for example public-016.')
    p.add_argument('--output-dir', type=Path, default=ROOT / 'downloads')
    p.add_argument('--verify-included', action='store_true', help='Offline check of the three bundled PDFs; do not download.')
    args = p.parse_args()
    rows = json.loads((ROOT / 'data/file_manifest.json').read_text())
    if args.key:
        rows = [r for r in rows if r['document_key'] == args.key]
        if not rows:
            raise SystemExit('Unknown document key.')
    if args.verify_included:
        rows = [r for r in rows if r['included_path']]
    else:
        args.output_dir.mkdir(parents=True, exist_ok=True)
    errors = []
    for item in rows:
        if Path(item['filename']).name != item['filename']:
            raise ValueError('Unsafe local filename')
        destination = ROOT / item['included_path'] if args.verify_included else args.output_dir / item['filename']
        temp = None
        try:
            if destination.exists():
                if not verify(destination, item):
                    raise ValueError('Existing file has different size/hash; not overwritten')
            elif args.verify_included:
                raise FileNotFoundError(destination)
            else:
                request = Request(encoded_url(item['url']), headers={'User-Agent': 'HoSoPublicDataset/1.0'})
                with urlopen(request, timeout=30) as response, tempfile.NamedTemporaryFile(dir=args.output_dir, delete=False) as output:
                    temp = Path(output.name)
                    encoded_url(response.url)  # Also validate the resolved host.
                    total = 0
                    while chunk := response.read(65536):
                        total += len(chunk)
                        if total > item['byte_size']:
                            raise ValueError('Upstream size changed')
                        output.write(chunk)
                if not verify(temp, item):
                    raise ValueError('Upstream hash/size differs from reviewed manifest')
                temp.replace(destination)
            print('OK', item['document_key'], destination.name)
        except Exception as error:
            errors.append(item['document_key'])
            print('FAILED', item['document_key'], str(error))
        finally:
            if temp is not None and temp.exists():
                temp.unlink()
    if errors:
        raise SystemExit(f'{len(errors)} file(s) could not be verified. Source URLs and expected hashes remain unchanged.')
    print(f'Verified {len(rows)} file(s).')


if __name__ == '__main__':
    main()
