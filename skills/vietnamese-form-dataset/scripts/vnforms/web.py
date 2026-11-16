import json
from pathlib import Path


def build_index(root, rows, manifest, verification, out):
    classification = json.loads((root / 'data/form-test-data/classification.json').read_text())
    templates = [{k: t[k] for k in ['id','filename','sha256','department_ids','procedure_codes','source_urls','local_path']} for t in rows]
    data = {'templates': templates, 'manifest': manifest, 'departments': classification['departments'],
            'verification': {'errors': verification['errors'], 'checked_pages': verification['checked_pages'],
                             'counts': verification['counts']}}
    html = Path(__file__).with_name('catalog.html').read_text()
    html = html.replace('__DATA__', json.dumps(data, ensure_ascii=False).replace('<','\\u003c'))
    (out / 'index.html').write_text(html)
