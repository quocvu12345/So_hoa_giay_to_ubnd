#!/usr/bin/env python3
"""Snapshot the ward's published procedure inventory; no claim of legal currency."""
import concurrent.futures
import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/official-forms'
BASE = 'https://tuliem.hanoi.gov.vn'


def main():
    evidence = OUT / 'evidence/tuliem'
    evidence.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    html = session.get(BASE + '/danh-muc-tthc', timeout=45).text
    soup = BeautifulSoup(html, 'html.parser')
    links = {urljoin(BASE, a['href']) for a in soup.select('a[href]') if '/danh-muc-tthc/' in a['href']}
    params = {k: re.search(r"var " + v + r" = '([^']*)'", html).group(1) for k, v in {
        'Catname': 'mo_CatName', 'Site': 'mo_SiteId', 'ZoomSize': 'mo_ZoomSize', 'LanguageId': 'mo_LanguageId'}.items()}
    params.update(PageIndex=0, PageSize=100, DataIds='')
    response = session.post(BASE + '/api/NewsZone/NewsZone', data=params, timeout=45)
    response.raise_for_status()
    (evidence / 'index.html').write_text(html + '\n' + response.text)
    links.update(urljoin(BASE, a['href']) for a in BeautifulSoup(response.text, 'html.parser').select('a[href]') if '/danh-muc-tthc/' in a['href'])
    checked = datetime.now(timezone.utc).isoformat()

    def collect(url):
        try:
            response = requests.get(url, timeout=45)
            response.raise_for_status()
            name = hashlib.sha256(url.encode()).hexdigest()[:16] + '.html'
            (evidence / name).write_text(response.text)
            soup = BeautifulSoup(response.text, 'html.parser')
            heading = soup.find('h1')
            title = heading.get_text(' ', strip=True) if heading else url
            rows = []
            for tr in soup.select('tr'):
                cells = tr.find_all(['td', 'th'], recursive=False)
                values = [' '.join(c.get_text(' ', strip=True).split()) for c in cells]
                if len(values) >= 4 and re.match(r'^\d\.\d{6}', values[1]):
                    rows.append({'procedure_code': values[1], 'name': values[2], 'published_basis': values[3],
                                 'domain': title, 'source_url': url, 'checked_at': checked,
                                 'template_status': 'chua_doi_chieu_bieu_mau', 'filled_samples': 0})
            return rows
        except requests.RequestException as exc:
            print('FAILED', url, str(exc), flush=True)
            return []

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        rows = [row for group in pool.map(collect, sorted(links)) for row in group]
    rows = list({(r['procedure_code'], r['domain']): r for r in rows}.values())
    payload = {'locality': 'Phường Từ Liêm, thành phố Hà Nội', 'checked_at': checked,
               'note': 'Danh mục do phường công bố, có trang chốt số liệu năm 2025. Ngày tải không phải xác nhận hiệu lực; biểu mẫu phải đối chiếu nguồn mới.',
               'domain_pages': len(links), 'procedures': rows}
    (OUT / 'procedures.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    if rows:
        with (OUT / 'procedures.csv').open('w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
    print(json.dumps({'domain_pages': len(links), 'procedures': len(rows)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
