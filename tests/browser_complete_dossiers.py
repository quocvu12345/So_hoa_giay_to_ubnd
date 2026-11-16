"""Read-only end-to-end checks for the full 425 x 2 synthetic batch."""
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT/'data/tuliem-dossiers-full'
BASE = os.environ.get('DOSSIER_TEST_BASE', 'http://127.0.0.1:8765')


def main():
    stats = json.loads((DATA/'packets.json').read_text())['stats']
    errors = []; checks = []; qa = DATA/'qa'; qa.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: errors.append(str(e)))
        assert page.goto(BASE+'/tuliem-dossiers-full/').status == 200
        expect(page.locator('#count')).to_have_text('425 thủ tục phù hợp')
        expect(page.locator('#coverage')).to_contain_text('850 bộ')
        for status, count in [('published', 338), ('assumed', 87), ('historical', 32)]:
            page.select_option('#status', status)
            expect(page.locator('#count')).to_have_text(f'{count} thủ tục phù hợp')
        checks.append('425 procedures, 850 PDF packets, transparent source filters')
        page.select_option('#status', '')
        page.fill('#search', 'hn87-326')
        expect(page.locator('#rows tr')).to_have_count(1)
        page.locator('#rows [data-packet]').first.click()
        expect(page.locator('#profile')).to_contain_text('Số định danh')
        expect(page.locator('#case-note')).to_contain_text('Thành phần giả định')
        expect(page.locator('#contents [data-doc]')).to_have_count(7)
        first = page.locator('#profile').inner_text()
        src = page.locator('#pdf').get_attribute('src')
        assert page.request.get(BASE+'/tuliem-dossiers-full/'+src).status == 200
        page.locator('#contents [data-doc]').nth(1).click()
        assert '#page=2' in page.locator('#pdf').get_attribute('src')
        page.click('#show-fields')
        page.locator('[data-truth]').nth(1).click()
        expect(page.locator('.values input').first).to_be_visible()
        assert '01/11/2026' in page.locator('.values input').evaluate_all('(nodes)=>nodes.map(n=>n.value)')
        page.locator('#packet-tabs [data-packet]').nth(1).click()
        expect(page.locator('#profile')).to_contain_text('Bộ 2')
        assert page.locator('#profile').inner_text() != first
        page.screenshot(path=str(qa/'complete-detail.png'), full_page=True)
        checks.append('seven linked birth papers, shared profile, two identities, labels and merged page jumps')
        page.click('#close')
        page.fill('#search', '2.000575')
        page.locator('#rows [data-packet]').first.click()
        expect(page.locator('#case-note')).to_contain_text('bị mất')
        expect(page.locator('#contents [data-doc]')).to_have_count(1)
        page.click('#show-cases')
        expect(page.locator('#contents')).to_contain_text('Nhóm thành phần trong nguồn')
        page.click('#close')
        page.fill('#search', '')
        page.screenshot(path=str(qa/'complete-catalog.png'), full_page=True)
        page.set_viewport_size({'width': 390, 'height': 844})
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        page.screenshot(path=str(qa/'complete-mobile.png'), full_page=True)
        checks.append('source forms preserved, case alternatives retained, responsive catalogue')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.goto(BASE+'/scan-inbox.html?samples=dossiers')
        expect(page.locator('#list-count')).to_have_text('850 tài liệu PDF', timeout=30000)
        expect(page.locator('#pdf-list tr')).to_have_count(850)
        checks.append('inbox includes exactly 850 complete packets, without duplicate older batch')
        browser.close()
    assert not errors, errors
    report = {'passed': True, 'packets_with_pdf': stats['packets_with_pdf'],
              'checks': checks, 'browser_errors': errors}
    (DATA/'browser-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
