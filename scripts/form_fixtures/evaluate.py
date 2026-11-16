"""Compare field IDs, never award a value found under somebody else's role."""
import unicodedata


def normalize(value):
    return ' '.join(unicodedata.normalize('NFC', str(value or '')).casefold().split())


def score(expected, prediction):
    predicted = {f['id']: f for f in prediction.get('fields', [])}
    checks = []
    for f in expected['fields']:
        p = predicted.get(f['id'], {})
        value = str(p.get('value') or '')
        empty = not f['value']
        check = {'id': f['id'], 'label': f['label'], 'expected': f['value'], 'actual': value,
                 'expected_blank': empty, 'present_in_prediction': f['id'] in predicted,
                 'exact_value': normalize(value) == normalize(f['value']),
                 'hallucinated_blank': empty and bool(value.strip()),
                 'source_page_matches': p.get('page') == f['page'] if p.get('page') is not None else None}
        if p.get('bbox') and value.strip():
            x0, y0, x1, y1 = p['bbox']
            tx0, ty0, tx1, ty1 = f['bbox']
            check['source_region_matches'] = tx0 - 3 <= (x0 + x1) / 2 <= tx1 + 3 and ty0 - 3 <= (y0 + y1) / 2 <= ty1 + 3
        else:
            check['source_region_matches'] = None
        checks.append(check)
    filled = [c for c in checks if not c['expected_blank']]
    blanks = [c for c in checks if c['expected_blank']]
    return {'document_id': expected['document_id'], 'filled_exact': sum(c['exact_value'] for c in filled),
            'filled_total': len(filled), 'blank_correct': sum(c['exact_value'] for c in blanks),
            'blank_total': len(blanks), 'hallucinated_blanks': sum(c['hallucinated_blank'] for c in checks),
            'prediction_coverage': sum(c['present_in_prediction'] for c in checks),
            'unexpected_field_ids': sorted(set(predicted) - {f['id'] for f in expected['fields']}),
            'checks': checks, 'note': 'Value accuracy is separate from source region verification; null region checks are not passes.'}
