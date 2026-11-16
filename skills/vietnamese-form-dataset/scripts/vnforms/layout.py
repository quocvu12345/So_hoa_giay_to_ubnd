"""Find native dotted blanks, unfilled labels and empty table cells."""
import collections
import concurrent.futures
import json
import re
import time
from pathlib import Path

import fitz

from .pipeline import save, sha
from .semantics import fold, infer, explicit_role


def lines(page):
    rows = []
    for block in page.get_text('rawdict')['blocks']:
        for line in block.get('lines', []):
            chars = [c for s in line['spans'] for c in s['chars']]
            if not chars:
                continue
            rows.append({'text': ''.join(c['c'] for c in chars), 'chars': chars,
                         'bbox': line['bbox'], 'font_size': max(s['size'] for s in line['spans']),
                         'baseline': chars[0]['origin'][1]})
    rows.sort(key=lambda r: (r['baseline'], r['bbox'][0]))
    groups = []
    for row in rows:
        if groups and abs(groups[-1][0]['baseline'] - row['baseline']) < 1.8:
            groups[-1].append(row)
        else:
            groups.append([row])
    merged = []
    for group in groups:
        parts = sorted(group, key=lambda r: r['bbox'][0])
        chars, rect = [], fitz.Rect(parts[0]['bbox'])
        for part in parts:
            if chars and part['chars'][0]['bbox'][0] - chars[-1]['bbox'][2] > .3:
                before, after = chars[-1], part['chars'][0]
                chars.append({'c': ' ', 'bbox': [before['bbox'][2], before['bbox'][1], after['bbox'][0], before['bbox'][3]],
                              'origin': [before['bbox'][2], before['origin'][1]]})
            chars.extend(part['chars'])
            rect |= fitz.Rect(part['bbox'])
        merged.append({'text': ''.join(c['c'] for c in chars), 'chars': chars, 'bbox': list(rect),
                       'font_size': max(p['font_size'] for p in parts), 'baseline': parts[0]['baseline']})
    return merged


def overlap(a, b):
    inter = fitz.Rect(a) & fitz.Rect(b)
    return not inter.is_empty and inter.width > min(fitz.Rect(a).width, fitz.Rect(b).width) * .3 and inter.height > 2


def page_schema(page, pn, default_role='applicant'):
    raw = lines(page)
    fields, rejected, cells, tables = [], [], [], []
    try:
        tables = page.find_tables(strategy='lines').tables
        cells = [fitz.Rect(c) for t in tables for c in t.cells if c]
    except Exception:
        pass
    role, agency, instruction = default_role, False, False
    blocked = []
    text_context = page.get_text()
    # Footer confirmation dates on the left and applicant dates on the right
    # are separate roles even when they share the same baseline.
    agency_footer = [r for r in raw if re.search(r'xac nhan.*ubnd|co quan, don vi.{0,30}nhan|co quan.*chung nhan', fold(r['text']))
                     and r['bbox'][1] > page.rect.height * .65 and r['bbox'][0] < page.rect.width * .5]
    official_left_start = min((r['bbox'][1] - 35 for r in agency_footer), default=page.rect.height + 1)

    def add(label, bbox, baseline, evidence, method, local_role, row_text, kind_override=None):
        rect = fitz.Rect(bbox)
        if rect.width < 8 or rect.height < 4:
            return
        if rect.y0 > official_left_start and rect.x1 < page.rect.width * .54:
            rejected.append({'page': pn, 'bbox': list(rect), 'label': label, 'reason': 'authority_confirmation_footer'})
            return
        if any(overlap(rect, f['bbox']) for f in fields):
            return
        kind = kind_override or infer(label, text_context[:1800], local_role)
        if kind in {'year','person.birth_year','issue_year'} and rect.width < 26:
            # Printed templates often reserve only three dots for a four-digit
            # terminal year. Use adjacent white space up to the next label.
            next_x = min((c['bbox'][0] for r in raw if abs(r['baseline']-baseline) < 2
                          for c in r['chars'] if c['bbox'][0] > rect.x1 + .5
                          and c['c'].strip() and c['c'] not in '.…_'), default=page.rect.width-30)
            rect.x1 = max(rect.x1, min(rect.x0 + 28, next_x - 2))
        entry = {'page': pn, 'bbox': [round(v, 2) for v in rect], 'baseline': round(baseline, 2),
                 'label': label.strip(), 'printed_context': row_text[:500], 'role': local_role,
                 'semantic_type': kind, 'detection_method': method, 'evidence': evidence,
                 'schema_review_status': 'automatic_needs_semantic_review'}
        if not kind:
            entry['reason'] = 'unresolved_label'
            rejected.append(entry)
        else:
            fields.append(entry)

    for row in raw:
        text, chars = row['text'], row['chars']
        ftext = fold(text).strip()
        if re.search(r'cong hoa xa hoi|doc lap.{0,8}tu do', ftext):
            agency = False
            instruction = False
            role = default_role
        if re.search(r'phan.{0,15}(co quan|can bo).{0,25}(xac nhan|tiep nhan|ghi)|phan xac nhan|xac nhan cua (uy ban|ubnd|co quan|chinh quyen)|y kien cua (uy ban|ubnd)|de xuat cua (uy ban|ubnd)', ftext):
            agency = True
        # A later applicant form/section can occur in the same bundled file.
        if re.search(r'^(don de nghi|to khai|ban khai|giay de nghi|[ivx]+\..*phan khai)', ftext):
            agency = False
            instruction = False
        if re.search(r'^(ghi chu|chu thich|huong dan ke khai|huong dan ghi)(:|\s*$)|^giai thich.*(noi dung|ke khai)|^chung nhan (ong|ba)', ftext):
            instruction = True
        blocked.append((row['bbox'][1], agency or instruction))
        is_footer = row['font_size'] < 8.3 or row['bbox'][1] > page.rect.height - 32
        reserved = agency or instruction or is_footer or bool(re.search(r'ky,? ghi ro|ky ten|dong dau|nguoi tiep nhan|nguoi kiem tra|thu truong', ftext))
        if 'chu tich' in ftext and 'kinh gui' not in ftext:
            reserved = True
        if re.search(r'^\s*(?:\d+[.)]|[a-d]\.|[ivx]+\.)?\s*(?:thong tin|phan khai|phan ke khai|nguoi giam ho|nguoi duoc giam ho|ben [ab]|ben nu|ben nam)', ftext):
            role = explicit_role(text, role)
        previous = 0
        matches = list(re.finditer(r'(?:[.\u2026\u2025\u22ef][ \t]*){3,}|\u2026+|_{3,}', text))
        date_components = {}
        for mi, match in enumerate(matches):
            selected = [c for c in chars[match.start():match.end()] if c['c'].strip()]
            if not selected:
                continue
            rect = fitz.Rect(selected[0]['bbox'])
            for c in selected[1:]:
                rect |= fitz.Rect(c['bbox'])
            prefix = text[previous:match.start()].strip()
            prefix = re.sub(r'^[\s;,.<>/]+', '', prefix)
            local_role = explicit_role(prefix, role)
            guessed = infer(prefix, text_context[:1800], local_role)
            if guessed in {'person.dob','issue_date','death_date','date'} and mi + 2 < len(matches):
                separators = [text[matches[k].end():matches[k+1].start()].strip() for k in [mi,mi+1]]
                if all(s == '/' for s in separators):
                    kinds = ['person.birth_day','person.birth_month','person.birth_year'] if guessed == 'person.dob' else ['issue_day','issue_month','issue_year'] if guessed == 'issue_date' else ['day','month','year']
                    for k, kind in enumerate(kinds):
                        date_components[mi+k] = (kind, prefix + [' · ngày',' · tháng',' · năm'][k], local_role)
            if reserved:
                rejected.append({'page': pn, 'bbox': list(rect), 'label': prefix, 'reason': 'agency_signature_or_instruction'})
            elif mi in date_components:
                kind, part_label, part_role = date_components[mi]
                add(part_label, rect, selected[0]['origin'][1], match.group(), 'date_component', part_role, text, kind_override=kind)
            elif prefix:
                add(prefix[-200:], rect, selected[0]['origin'][1], match.group(), 'native_dotted_run', local_role, text)
            else:
                # Multi-line printed labels are followed by a blank line in
                # several bilingual forms. Carry only the nearest known label,
                # not a value from an earlier continuation or an instruction.
                prior = [r for r in raw if 0 < row['baseline'] - r['baseline'] < 35 and r['bbox'][0] < rect.x1]
                carried = next((r['text'] for r in reversed(prior) if infer(r['text'], text_context[:1800], role)
                                and not re.search(r'(?:\.[ \t]*){3,}|…+', r['text']) and len(r['text']) < 180), None)
                canonical = lambda label: fold(label).strip(' :;,.')
                if carried:
                    # Prefer the actual dot line over a guessed inline gap on
                    # the preceding label-only line.
                    fields[:] = [f for f in fields if not (f['detection_method'] == 'native_label_gap'
                                 and canonical(f['label']) == canonical(carried) and 0 < row['baseline'] - f['baseline'] < 35)]
                if carried and not any(canonical(f['label']) == canonical(carried) and f['page'] == pn
                                       and 0 < row['baseline'] - f['baseline'] < 35 for f in fields):
                    add(carried, rect, selected[0]['origin'][1], match.group(), 'blank_under_multiline_label', explicit_role(carried, role), text)
                else:
                    rejected.append({'page': pn, 'bbox': list(rect), 'label': '', 'reason': 'unlabelled_continuation_or_signature'})
            previous = match.end()
        if reserved:
            continue
        # Word's empty tab fields often have no dot characters at all.
        colon = text.rfind(':')
        if colon > 0 and not text[colon + 1:].strip():
            label = text[:colon].strip()
            if len(label) > 200 or not infer(label, text_context[:1800], role):
                continue
            x0 = chars[colon]['bbox'][2] + 3
            y0, baseline = row['bbox'][1], row['baseline']
            x1 = page.rect.width - 48
            applicable = [c for c in cells if c.y0 - 2 <= baseline <= c.y1 + 2 and c.x0 <= x0 <= c.x1]
            if applicable:
                cell = min(applicable, key=lambda c: c.width * c.height)
                x1 = cell.x1 - 4
            if x1 - x0 > 28:
                add(label, [x0, y0, x1, baseline + 3], baseline, 'empty text after printed colon',
                    'native_label_gap', explicit_role(label, role), text)

    # Fill one repeated table row (or labelled blank cells in identity tables).
    # Additional unused rows are reserved; do not fabricate an arbitrary list.
    for table_no, table in enumerate(tables):
        try:
            grid = table.extract()
        except Exception:
            continue
        first_data_done = False
        for ri, row in enumerate(table.rows):
            texts = [re.sub(r'\s+', ' ', (t or '')).strip() for t in grid[ri]]
            occupied = [t for t in texts if t]
            label_row = bool(occupied and infer(occupied[0], text_context[:1800])
                             and not re.search(r'^(cong|tong|st\s*t)\b', fold(occupied[0])))
            numbered_empty = len(occupied) == 1 and bool(re.fullmatch(r'\d{1,3}[.)]?', occupied[0]))
            empty_data = (not occupied or numbered_empty) and ri > 0 and not first_data_done
            if not label_row and not empty_data:
                continue
            used = False
            for ci, cell in enumerate(row.cells):
                if not cell or ci >= len(texts) or texts[ci]:
                    continue
                rect = fitz.Rect(cell)
                # Table reconstruction must respect agency/instruction sections
                # just like dotted fields; a blank table is not automatically
                # a citizen input region.
                previous_states = [state for y, state in blocked if y <= rect.y0 + 2]
                if previous_states and previous_states[-1]:
                    continue
                if rect.height < 12 or rect.width < 16 or rect.y0 > page.rect.height - 55:
                    continue
                if label_row:
                    label = occupied[0]
                    role_column = 'wife' if ci == 1 and table.col_count == 3 and 'ben nu' in fold(str(grid[:2])) else 'husband' if ci == 2 and table.col_count == 3 and 'ben nam' in fold(str(grid[:2])) else default_role
                else:
                    column_labels = [grid[k][ci] for k in range(max(0, ri - 3), ri) if ci < len(grid[k]) and grid[k][ci]]
                    label = ' '.join(column_labels)
                    role_column = default_role
                if not label or len(label) > 220:
                    continue
                before = len(fields)
                add(label, [rect.x0 + 4, rect.y0 + 3, rect.x1 - 4, min(rect.y0 + 20, rect.y1 - 3)],
                    min(rect.y0 + 16, rect.y1 - 4), 'empty cell under printed label',
                    f'table_{table_no}_row_{ri}_col_{ci}', explicit_role(label, role_column), label)
                used = used or len(fields) > before
            if empty_data and used:
                first_data_done = True
    # Stable IDs are independent of generated data values.
    fields.sort(key=lambda f: (f['page'], round(f['baseline'] / 3), f['bbox'][0]))
    for index, f in enumerate(fields, 1):
        f['id'] = f'p{pn:02}-f{index:03}'
    return fields, rejected


def plan_one(job):
    directory, t = job
    out = Path(directory)
    try:
        src = out / 'source-pdf' / f"{t['id']}.pdf"
        all_fields, rejected = [], []
        with fitz.open(src) as pdf:
            default = 'beneficiary' if 'ba me viet nam' in fold(pdf[0].get_text()) else 'applicant'
            for pn, p in enumerate(pdf, 1):
                fields, remaining = page_schema(p, pn, default)
                all_fields.extend(fields)
                rejected.extend(remaining)
            title = ' '.join(pdf[0].get_text().split())[:700]
            count = len(pdf)
        schema = {'template_id': t['id'], 'source_sha256': t['sha256'], 'rendered_source_sha256': sha(src),
                  'source_pages': count, 'context': title, 'fields': all_fields, 'unfilled_candidates': rejected,
                  'schema_status': 'automatic_layout_and_semantics', 'version': 1}
        save(out / 'schemas' / f"{t['id']}.json", schema)
        summary = {'template_id': t['id'], 'filename': t['filename'], 'pages': count,
                   'fillable_fields': len(all_fields), 'unfilled_candidates': len(rejected),
                   'unresolved_labels': sum(r['reason'] == 'unresolved_label' for r in rejected),
                   'schema_review_status': schema['schema_status']}
        return summary
    except Exception as exc:
        return {'template_id': t['id'], 'filename': t['filename'], 'fillable_fields': 0, 'error': str(exc)}


def plan(args, rows, out):
    summaries, failures = [], []
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.jobs) as pool:
      futures = [pool.submit(plan_one, (str(out), t)) for t in rows]
      for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
        summary = future.result()
        summaries.append(summary)
        if not summary['fillable_fields']:
            failures.append(summary['template_id'])
        if index % 25 == 0 or index == len(rows):
            print(f'plan {index}/{len(rows)}; schemas without fields {len(failures)}', flush=True)
            save(out / 'progress.json', {'stage': 'plan', 'completed': index, 'target': len(rows)})
    position = {t['id']: i for i, t in enumerate(rows)}
    summaries.sort(key=lambda s: position[s['template_id']])
    save(out / 'schema-review.json', summaries)
    print(f'fields: {sum(s["fillable_fields"] for s in summaries)}; zero-field schemas: {failures}', flush=True)
