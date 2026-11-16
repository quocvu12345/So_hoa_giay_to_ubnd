"""Read-only browser checks against the locally served dossier dataset."""
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/tuliem-dossiers'
BASE = 'http://127.0.0.1:8765'


def main():
    stats = json.loads((DATA / 'packets.json').read_text())['stats']
    coverage = json.loads((DATA / 'catalogue.json').read_text())['stats']['procedures_by_status']
    errors, checks = [], []
    (DATA / 'qa').mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: errors.append(str(e)))
        assert page.goto(BASE + '/tuliem-dossiers/').status == 200
        expect(page.locator('#count')).to_have_text('425 thủ tục phù hợp')
        for status, count in coverage.items():
            page.select_option('#status', status)
            expect(page.locator('#count')).to_have_text(f'{count} thủ tục phù hợp')
        checks.append('425 inventory entries and all source coverage filters')
        page.select_option('#status', '')
        page.fill('#search', '1.001193')
        expect(page.locator('#rows tr')).to_have_count(1)
        page.locator('[data-blueprint]').click()
        expect(page.locator('#profile')).to_contain_text('Số định danh')
        assert page.locator('#contents .component').count() > 15
        assert not page.locator('#pdf').is_hidden()
        assert page.request.get(BASE + '/tuliem-dossiers/' + page.locator('#pdf').get_attribute('src')).status == 200
        first_profile = page.locator('#profile').inner_text()
        page.click('#show-fields')
        page.locator('[data-truth]').first.click()
        expect(page.locator('.values input').first).to_be_visible()
        assert page.locator('.values input').count() > 25
        page.click('#show-cases')
        expect(page.locator('#contents')).to_contain_text('Giấy tờ phải xuất trình')
        page.locator('#packet-tabs [data-packet]').nth(1).click()
        expect(page.locator('#profile')).to_contain_text('Bộ 2')
        assert page.locator('#profile').inner_text() != first_profile
        page.screenshot(path=str(DATA / 'qa/catalog-detail.png'), full_page=True)
        page.click('#close')
        page.fill('#search', '2.000575')
        page.locator('[data-blueprint]').click()
        expect(page.locator('#case-note')).to_contain_text('bị mất')
        checks.append('shared profile, source PDF, labels, two copies and selected business branch')
        page.click('#close')
        page.fill('#search', '')
        page.select_option('#status', 'source_detail_missing')
        page.locator('[data-blueprint]').first.click()
        expect(page.locator('#no-pdf')).to_be_visible()
        assert page.locator('#pdf').is_hidden()
        page.click('#close')
        page.select_option('#status', '')
        page.screenshot(path=str(DATA / 'qa/catalog.png'), full_page=True)
        page.set_viewport_size({'width': 390, 'height': 844})
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        page.screenshot(path=str(DATA / 'qa/mobile.png'), full_page=True)
        checks.append('missing sources stay checklist-only; mobile has no body overflow')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.goto(BASE + '/scan-inbox.html?samples=dossiers')
        expect(page.locator('#list-count')).to_have_text(f"{stats['packets_with_pdf']} tài liệu PDF", timeout=20000)
        expect(page.locator('#pdf-list tr')).to_have_count(stats['packets_with_pdf'])
        checks.append('inbox lists actual merged PDFs only')
        browser.close()
    assert not errors, errors
    report = {'passed': True, 'checks': checks, 'browser_errors': errors,
              'packets_with_pdf': stats['packets_with_pdf']}
    (DATA / 'browser-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
