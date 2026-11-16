"""Read blank runs in native PDF coordinates without changing the template."""
import re
import fitz


def slots(page):
    found = []
    for block in page.get_text('rawdict')['blocks']:
        for line in block.get('lines', []):
            chars = [c for s in line['spans'] for c in s['chars']]
            text = ''.join(c['c'] for c in chars)
            previous = 0
            for match in re.finditer(r'(?:[.][ \t]*){3,}|…+', text):
                selected = [c for c in chars[match.start():match.end()] if c['c'].strip()]
                if not selected:
                    continue
                rect = fitz.Rect(selected[0]['bbox'])
                for c in selected[1:]:
                    rect |= fitz.Rect(c['bbox'])
                found.append({'bbox': [round(v, 2) for v in rect],
                              'baseline': round(selected[0]['origin'][1], 2),
                              'prefix': text[previous:match.start()].strip(), 'line': text.strip()})
                previous = match.end()
    return sorted(found, key=lambda r: (round(r['baseline'] / 3), r['bbox'][0]))
