#!/usr/bin/env python3
"""Download public blank attachments, official procedure PDFs and e-form schemas."""
import concurrent.futures
import hashlib
import importlib.util
import json
import re
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/official-forms'
API = 'https://dichvucong.gov.vn/api/v1'


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def safe_name(name):
    return re.sub(r'[^\w.() -]+', '_', Path(name).name, flags=re.UNICODE)[:150] or 'attachment.bin'


def download(task):
    key, kind, name, endpoint, payload, references = task
    folder = {'blank_form': 'templates', 'procedure_pdf': 'procedure-pdf', 'electronic_form': 'electronic-forms'}[kind]
    target = OUT / folder / key / safe_name(name)
    meta_path = target.parent / 'receipt.json'
    if meta_path.is_file():
        previous = json.loads(meta_path.read_text())
        if previous.get('status') in {'downloaded', 'not_provided'}:
            if previous['status'] == 'not_provided' or (target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == previous.get('sha256')):
                previous['references'] = references; save_json(meta_path, previous)
                return previous
    result = {'id': key, 'kind': kind, 'filename': name, 'references': references,
              'source_endpoint': API + endpoint, 'source_request': payload,
              'retrieved_at': datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).isoformat(), 'status': 'failed'}
    for attempt in range(3):
        try:
            r = requests.post(API + endpoint, json=payload, timeout=75)
            if kind == 'electronic_form' and r.status_code == 400 and r.json().get('code') == 'OBJECT_NOT_FOUND':
                result.update(status='not_provided', source_message=r.json().get('message'))
                break
            r.raise_for_status()
            content = r.content
            if kind == 'electronic_form':
                data = r.json()
                if data.get('code') != 'OK':
                    raise ValueError(data.get('message', 'No JSON data'))
                if not data.get('data') or not data['data'].get('formJson'):
                    result['status'] = 'not_provided'; break
            elif kind == 'procedure_pdf' and not content.startswith(b'%PDF-'):
                raise ValueError('Server did not return a PDF')
            elif kind == 'blank_form':
                # Do not save an HTML error or a JSON status response as a Word file.
                if content.lstrip()[:1] in {b'<', b'{'} and Path(name).suffix.lower() not in {'.xml', '.json', '.html'}:
                    raise ValueError('Response is not the requested attachment')
                if not content:
                    raise ValueError('Empty attachment')
            target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(content)
            result.update(status='downloaded', local_path=str(target.relative_to(OUT)), bytes=len(content),
                          sha256=hashlib.sha256(content).hexdigest(), media_type=r.headers.get('content-type'))
            break
        except (requests.RequestException, ValueError) as error:
            result['error'] = str(error)[:400]
            if attempt < 2:
                time.sleep(1 + attempt)
    save_json(meta_path, result)
    time.sleep(.15)
    return result


def main():
    details = {}
    attachments = {}
    files = sorted((OUT / 'procedures').glob('hn87-*.json')) + sorted((OUT / 'supplemental-procedures').glob('*.json'))
    for file in files:
        row = json.loads(file.read_text())
        for detail in row.get('details', []):
            details.setdefault(detail['id'], {'detail': detail, 'references': []})['references'].append(row['id'])
            for component in detail.get('components', []):
                for attachment in component['attachments']:
                    if not attachment.get('id'):
                        continue
                    item = attachments.setdefault(attachment['id'], {'attachment': attachment, 'references': []})
                    item['references'].append({'procedure_id': row['id'], 'procedure_code': row['procedure_code'],
                                               'detail_id': detail['id'], 'component': component['name'],
                                               'section': component['section'], 'source_url': detail['source_url']})
    tasks = []
    for key, item in attachments.items():
        tasks.append((key, 'blank_form', item['attachment'].get('fileName', 'attachment.bin'),
                      '/submitting/preview-attachment', {'fileId': key}, item['references']))
    for key, item in details.items():
        tasks.append((key, 'procedure_pdf', item['detail']['code'] + '.pdf',
                      '/configuring/formality/export-pdf-formality-detail-by-citizen', {'formalityId': key}, item['references']))
        tasks.append((key, 'electronic_form', item['detail']['code'] + '.json',
                      '/configuring/formality/get-formality-form-by-citizen', {'formalityId': key}, item['references']))
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for index, item in enumerate(pool.map(download, tasks), 1):
            results.append(item)
            if index % 50 == 0 or index == len(tasks):
                print(f'{index}/{len(tasks)} files; downloaded {sum(r["status"] == "downloaded" for r in results)}', flush=True)
    save_json(OUT / 'files.json', results)
    from collections import Counter
    print(Counter((r['kind'], r['status']) for r in results))


if __name__ == '__main__':
    main()
