"""Build and audit complete synthetic dossiers without overstating sources."""
import collections
import concurrent.futures
import copy
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

import fitz

from .packet_render import shared_profile
from .pipeline import save, sha
from .synthetic_papers import plan_components, profile_facts, render_paper, select_numbered_cases


DATASET = 'tuliem-dossiers-full-v2'
DIRECTORY = 'data/tuliem-dossiers-full'


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def fingerprint(root, seed):
    parent = Path(__file__).parent
    paths = [parent/'complete_dossiers.py', parent/'synthetic_papers.py',
             parent/'packet_render.py', parent/'semantics.py',
             root/'data/tuliem-dossiers/catalogue.json', root/'data/tuliem-dossiers/packets.json']
    return hashlib.sha256((str(seed)+''.join(sha(p) for p in paths)).encode()).hexdigest()


def plan(args, out):
    source = read(args.root/'data/tuliem-dossiers/catalogue.json')
    rows = source['procedures']
    if len(rows) != 425 or {int(b['ordinal']) for b in rows} != set(range(1, 426)):
        raise ValueError('The source inventory must contain exactly the frozen 425 procedure IDs.')
    catalogue = copy.deepcopy(source)
    for b in catalogue['procedures']:
        b['source_status'] = b['status']
        select_numbered_cases(b)
        b['components'] = plan_components(b)
        b['source_requirements_available'] = all(c['requirement_basis'] == 'published_component_description' for c in b['components'])
        b['test_status'] = 'complete_synthetic_plan'
        b['historical_mock_only'] = b['status'] == 'held_changed_procedure'
        b['default_test_scenario'] = {**b['default_test_scenario'],
                                      'conditional_material_policy': 'Supply selected conditional supporting papers as explicit test assumptions.',
                                      'scope': 'complete_synthetic_fixture_not_an_administrative_application'}
        save(out/'blueprints'/(b['id']+'.json'), b)
    catalogue.update(dataset=DATASET, dataset_directory=DIRECTORY+'/',
                     archive_filename='tuliem-dossiers-full.zip')
    catalogue['stats'] = {**catalogue['stats'],
                          'procedures_with_published_components': sum(b['source_requirements_available'] for b in catalogue['procedures']),
                          'procedures_with_assumed_components': sum(not b['source_requirements_available'] for b in catalogue['procedures']),
                          'expected_artifacts_per_copy': sum(len(c['expected_artifacts']) for b in catalogue['procedures'] for c in b['components'])}
    catalogue['notes'] = [
        '425 mục theo danh mục ngày 27/4/2026; giữ nguyên mã và trạng thái vòng đời của kho nguồn.',
        'Mỗi mục có đúng hai bộ dữ liệu giả với các giấy tờ trong checklist kiểm thử đã chọn.',
        'Mẫu gốc đã điền được giữ bố cục. Giấy tờ chưa có bản gốc được tự dựng, gắn nhãn GIẢ LẬP trên từng trang.',
        'Mục chưa có chi tiết dùng danh sách thành phần giả định, không được tính thành đã khôi phục nguồn chính thức.',
        'Mã đã thay đổi chỉ có mô phỏng lịch sử, không dùng mẫu cũ như một thủ tục còn hiệu lực.',
        'Các nhánh không chọn và hướng dẫn được giữ trong checklist, không ghép thành một yêu cầu thông thường.',
    ]
    save(out/'catalogue.json', catalogue)
    print(json.dumps(catalogue['stats'], ensure_ascii=False), flush=True)


def reusable_packet(root, packet, signature):
    if packet.get('generator_signature') != signature or not packet.get('test_complete'):
        return False
    paths = [(d['local_path'], d['sha256']) for d in packet['documents']]
    paths.append((packet['combined_pdf']['local_path'], packet['combined_pdf']['sha256']))
    try:
        return all((root/p).is_file() and sha(root/p) == digest for p, digest in paths) and all(
            (root/d['ground_truth_path']).is_file() for d in packet['documents'])
    except OSError:
        return False


def packet_job(job):
    root_path, blueprint, old_packet, index, seed, signature, resume = job
    root = Path(root_path); out = root/DIRECTORY
    packet_id = f"hs-{blueprint['id']}-{index+1:02}"
    record_path = out/'records'/(packet_id+'.json')
    if resume and record_path.is_file():
        old = read(record_path)
        if reusable_packet(root, old, signature):
            return old
    # Prefer the already verified shared profile for retained source forms.
    # Recreating it with another seed would make those forms inconsistent.
    if old_packet and (root/old_packet['profile_path']).is_file():
        profile = read(root/old_packet['profile_path'])
        generated = shared_profile(blueprint, index, seed)
        if profile['seed_number'] != generated['seed_number']:
            raise ValueError('Seed differs from source-form profile; regenerate the source packet first.')
    else:
        profile = shared_profile(blueprint, index, seed)
    if not old_documents_available(old_packet) and blueprint['procedure_code'] == '2.002621':
        # This source-less linked birth/health-insurance scenario concerns an
        # infant. It must not inherit the generic eleven-year-old child.
        profile['people']['child'].update(dob='01/11/2026', birth_day='01', birth_month='11', birth_year='2026')
        profile['people']['father'] = copy.deepcopy(profile['people']['applicant'])
        profile['people']['mother'] = copy.deepcopy(profile['people']['wife'])
        profile['aliases'].update(father='applicant', mother='wife')
    if not old_documents_available(old_packet) and blueprint['id'] == 'hn87-001':
        profile['history'] = True
        profile['death_date'] = '08/11/1972'
        for role, year in {'applicant': 1944, 'father': 1917, 'mother': 1920, 'wife': 1948, 'child': 1970}.items():
            person = profile['people'][role]
            person.update(birth_year=str(year), dob=person['dob'][:6]+str(year))
    profile.update(synthetic=True, dataset=DATASET)
    profile['facts'] = profile_facts(profile, blueprint)
    profile['scenario_assumptions'] = [
        {'component_id': c['id'], 'reason': c.get('selection_note') or c.get('source_gap')}
        for c in blueprint['components'] if c['included_in_test'] and
        (c.get('selection_note') or c['requirement_basis'] == 'explicit_test_assumption')]
    old_documents = {d['template_id']: d for d in (old_packet or {}).get('documents', [])}
    if blueprint['historical_mock_only']:
        old_documents = {}
    documents = []; by_template = {}; checklist = []
    for c in blueprint['components']:
        document_ids = []
        actual_artifacts = []
        for spec in c['expected_artifacts']:
            tid = spec['template_id']
            if tid and tid in old_documents:
                if tid not in by_template:
                    original = old_documents[tid]
                    original_path = root/original['local_path']
                    if sha(original_path) != original['sha256']:
                        raise ValueError('Source filled PDF hash mismatch: '+original['id'])
                    d = copy.deepcopy(original)
                    for key, folder in [('local_path', 'documents'), ('ground_truth_path', 'ground-truth')]:
                        target = out/folder/Path(original[key]).name
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copyfile(root/original[key], target)
                        d[key] = str(target.relative_to(root))
                    d.update(artifact_kind='source_form_filled', requirement_ids=[],
                             source_filled_pdf=original['local_path'], source_filled_sha256=original['sha256'])
                    by_template[tid] = d; documents.append(d)
                d = by_template[tid]
                d['requirement_ids'].append(spec['id'])
            else:
                d = render_paper(root, out, spec, profile, blueprint, index)
                documents.append(d)
            document_ids.append(d['id'])
            actual_artifacts.append({**spec, 'document_id': d['id'], 'artifact_kind': d['artifact_kind']})
        checklist.append({**c, 'document_id': document_ids[0] if document_ids else None,
                          'document_ids': list(dict.fromkeys(document_ids)),
                          'artifacts': actual_artifacts,
                          'test_artifact_status': 'all_test_documents_supplied' if c['included_in_test'] else c['scenario_status']})
    if not documents:
        raise ValueError('No actual documents for '+packet_id)
    packetdir = out/'packets'/packet_id; packetdir.mkdir(parents=True, exist_ok=True)
    save(packetdir/'profile.json', profile); save(packetdir/'checklist.json', checklist)
    ranges = []
    with fitz.open() as merged:
        for d in documents:
            start = len(merged)+1
            with fitz.open(root/d['local_path']) as pdf:
                merged.insert_pdf(pdf)
            ranges.append({'document_id': d['id'], 'template_id': d['template_id'],
                           'artifact_kind': d['artifact_kind'], 'start_page': start, 'end_page': len(merged),
                           'field_truth_path': d['ground_truth_path']})
        destination = packetdir/'ho-so-test.pdf'
        merged.save(destination, deflate=True, garbage=4)
        combined = {'local_path': str(destination.relative_to(root)), 'sha256': sha(destination),
                    'byte_size': destination.stat().st_size, 'page_count': len(merged), 'page_ranges': ranges}
    packet = {'id': packet_id, 'dataset': DATASET, 'blueprint_id': blueprint['id'],
              'procedure_code': blueprint['procedure_code'], 'procedure_name': blueprint['name'],
              'copy': index+1, 'profile_seed': profile['seed_number'], 'department_id': blueprint['department_id'],
              'status': 'complete_synthetic_test_packet', 'test_complete': True,
              'source_requirements_available': blueprint['source_requirements_available'],
              'historical_mock_only': blueprint['historical_mock_only'],
              'legally_complete': False, 'documents': documents, 'combined_pdf': combined,
              'checklist_path': str((packetdir/'checklist.json').relative_to(root)),
              'profile_path': str((packetdir/'profile.json').relative_to(root)),
              'page_ranges': ranges, 'open_component_count': 0,
              'selected_component_count': sum(c['included_in_test'] for c in checklist),
              'expected_artifact_count': sum(len(c['expected_artifacts']) for c in checklist),
              'filled_document_count': len(documents),
              'filled_field_count': sum(d['filled_fields'] for d in documents),
              'source_form_count': sum(d['artifact_kind'] == 'source_form_filled' for d in documents),
              'mock_document_count': sum(d['artifact_kind'] == 'synthetic_mock' for d in documents),
              'generator_signature': signature,
              'coverage_note': 'Đủ giấy tờ theo checklist kiểm thử. Mẫu tự dựng có nhãn giả lập; phần giả định/nguồn và mã lịch sử được công khai riêng.'}
    save(packetdir/'packet.json', packet); save(record_path, packet)
    return packet


def old_documents_available(packet):
    return bool(packet and packet.get('documents'))


def generate(args, out):
    catalogue = read(out/'catalogue.json')
    source_packets = {p['id']: p for p in read(args.root/'data/tuliem-dossiers/packets.json')['packets']}
    signature = fingerprint(args.root, args.seed)
    jobs = [(str(args.root), b, source_packets.get(f"hs-{b['id']}-{i+1:02}"), i, args.seed, signature, args.resume)
            for b in catalogue['procedures'] for i in range(args.copies)]
    packets = []
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.jobs) as pool:
        futures = {pool.submit(packet_job, job): job[1]['id'] for job in jobs}
        for future in concurrent.futures.as_completed(futures):
            packets.append(future.result())
            if len(packets) % 25 == 0 or len(packets) == len(jobs):
                print('complete synthetic packets', len(packets), '/', len(jobs), flush=True)
                save(out/'progress.json', {'stage': 'generate', 'completed': len(packets), 'target': len(jobs)})
    packets.sort(key=lambda p: p['id'])
    stats = {'inventory_procedures': len(catalogue['procedures']), 'scenario_manifests': len(packets),
             'copies_per_procedure': args.copies, 'packets_with_pdf': len(packets),
             'procedures_with_pdf': len({p['blueprint_id'] for p in packets}), 'checklist_only_or_held': 0,
             'complete_synthetic_packets': sum(p['test_complete'] for p in packets),
             'filled_documents': sum(p['filled_document_count'] for p in packets),
             'filled_fields': sum(p['filled_field_count'] for p in packets),
             'source_form_documents': sum(p['source_form_count'] for p in packets),
             'mock_documents': sum(p['mock_document_count'] for p in packets),
             'combined_pdf_pages': sum(p['combined_pdf']['page_count'] for p in packets),
             'procedures_with_published_components': catalogue['stats']['procedures_with_published_components'],
             'procedures_with_assumed_components': catalogue['stats']['procedures_with_assumed_components'],
             'historical_mock_packets': sum(p['historical_mock_only'] for p in packets)}
    save(out/'packets.json', {'dataset': DATASET, 'stats': stats, 'packets': packets})
    records = []
    for p in packets:
        c = p['combined_pdf']
        records.append({'id': 'full-'+p['id'], 'packet_id': p['id'], 'dataset': DATASET,
                        'title': p['procedure_code']+' · '+p['procedure_name']+f" · bộ {p['copy']} · {p['filled_document_count']} giấy tờ",
                        'local_path': c['local_path'], 'sha256': c['sha256'], 'byte_size': c['byte_size'],
                        'page_count': c['page_count'], 'media_type': 'application/pdf',
                        'sample_kind': 'synthetic_complete_packet', 'department_id': p['department_id'],
                        'procedure_code': p['procedure_code'], 'publisher': '425 × 2 bộ dữ liệu giả đầy đủ giấy tờ',
                        'test_complete': True, 'requires_review': True})
    save(out/'manifest.json', {'dataset': DATASET, 'documents': records, 'stats': stats})
    print(json.dumps(stats, ensure_ascii=False, indent=2), flush=True)


def expected_entity(profile, key):
    role, _, suffix = key.partition('.')
    if role == 'household':
        return profile['address']
    if role == 'facts':
        return profile['facts'][suffix]
    if role in profile['people']:
        return profile['people'][role].get(suffix)
    return profile.get(key)


def audit_packet(root, packet, blueprint):
    """Return evidence counters; raise on any missing paper or changed value."""
    from .packet_review import normal
    profile = read(root/packet['profile_path']); checklist = read(root/packet['checklist_path'])
    assert profile['packet_id'] == packet['id'], 'profile packet ID'
    assert not packet['legally_complete'], 'synthetic does not certify legal coverage'
    assert packet['source_requirements_available'] == blueprint['source_requirements_available']
    assert {c['id'] for c in checklist} == {c['id'] for c in blueprint['components']}, 'checklist lost source rows'
    docs = {d['id']: d for d in packet['documents']}
    assert len(docs) == len(packet['documents']) > 0, 'duplicate/empty documents'
    expected_specs = {s['id']: s for c in blueprint['components'] for s in c['expected_artifacts']}
    supplied_specs = {}
    for c in checklist:
        planned = next(b for b in blueprint['components'] if b['id'] == c['id'])
        assert c['included_in_test'] == planned['included_in_test'], 'changed case selection'
        actual = c.get('artifacts', [])
        assert {a['id'] for a in actual} == {a['id'] for a in planned['expected_artifacts']}, 'missing component artifact'
        assert not c['included_in_test'] or actual, 'selected component has no document'
        for a in actual:
            assert a['document_id'] in docs, 'component references absent document'
            assert a['id'] in docs[a['document_id']]['requirement_ids'], 'requirement not covered by document'
            supplied_specs[a['id']] = a['document_id']
    assert set(supplied_specs) == set(expected_specs), 'missing papers'
    assert set(supplied_specs.values()) == set(docs), 'unreferenced documents'
    assert len(expected_specs) == packet['expected_artifact_count']
    observed = collections.defaultdict(set); fields_checked = pages_checked = 0
    for d in packet['documents']:
        path = root/d['local_path']
        assert path.is_file() and sha(path) == d['sha256'], 'missing/changed PDF '+d['id']
        truth = read(root/d['ground_truth_path'])
        assert truth['packet_id'] == packet['id']
        assert len({f['id'] for f in truth['fields']}) == len(truth['fields']), 'duplicate field IDs'
        assert any(f['value'] for f in truth['fields']), 'blank PDF counted as filled'
        for f in truth['fields']:
            if not f['value'] or not f.get('entity_key'):
                continue
            key = f['entity_key']; value = str(f['value']).removeprefix('Căn cước số ')
            expected = expected_entity(profile, key)
            if expected is not None:
                assert normal(value) == normal(expected), 'field differs from profile '+key
            role, dot, suffix = key.partition('.')
            canonical = profile.get('aliases', {}).get(role, role)+dot+suffix
            observed[canonical].add(normal(value)); fields_checked += 1
        if d['artifact_kind'] == 'source_form_filled':
            assert not blueprint['historical_mock_only'], 'old source form used for held procedure'
            assert d['sha256'] == d['source_filled_sha256'] == sha(root/d['source_filled_pdf']), 'source layout changed'
            assert d.get('source_pdf') and (root/d['source_pdf']).is_file()
        else:
            assert truth['artifact_kind'] == 'synthetic_mock' and truth['source_original_available'] is False
            assert d['source_pdf'] is None and d['original_sha256'] is None, 'mock claims official source'
        with fitz.open(path) as pdf:
            assert len(pdf) == d['page_count']
            for pn, page in enumerate(pdf, 1):
                assert not page.get_text().strip(), 'hidden answer text'
                assert not list(page.widgets() or []), 'hidden form data'
                assert page.get_images(), 'not a raster page'
                for f in truth['fields']:
                    if f['page'] != pn or not f['value']:
                        continue
                    x0, y0, x1, y1 = f.get('ink_bbox', f['bbox'])
                    assert 0 <= x0 < x1 <= page.rect.width+1 and 0 <= y0 < y1 <= page.rect.height+1, 'field outside page'
                pages_checked += 1
    assert not {k: v for k, v in observed.items() if len(v) > 1}, 'cross-document identity conflict'
    combined = packet['combined_pdf']
    assert sha(root/combined['local_path']) == combined['sha256'], 'merged PDF changed'
    ranges = packet['page_ranges']
    assert ranges == combined['page_ranges'] and len(ranges) == len(packet['documents'])
    next_page = 1
    with fitz.open(root/combined['local_path']) as merged:
        assert len(merged) == combined['page_count'] == sum(d['page_count'] for d in packet['documents'])
        for r, d in zip(ranges, packet['documents']):
            assert r['document_id'] == d['id'] and r['start_page'] == next_page
            assert r['end_page']-r['start_page']+1 == d['page_count'], 'page boundary mismatch'
            with fitz.open(root/d['local_path']) as paper:
                for i, page in enumerate(paper):
                    actual = merged[r['start_page']-1+i]
                    assert not actual.get_text().strip() and not list(actual.widgets() or [])
                    # Comparing embedded raster streams verifies merged page
                    # content without re-rendering every original at 150 dpi.
                    src = page.get_images()[0][0]; dst = actual.get_images()[0][0]
                    assert paper.xref_stream(src) == merged.xref_stream(dst), 'merged page differs from paper'
            next_page = r['end_page']+1
    assert packet['test_complete'] and packet['open_component_count'] == 0
    return {'documents': len(docs), 'pages': pages_checked, 'identity_fields': fields_checked,
            'requirements': len(expected_specs), 'applicant_id': profile['people']['applicant']['id']}


def verify(args, out):
    catalogue = read(out/'catalogue.json'); data = read(out/'packets.json')
    blueprints = {b['id']: b for b in catalogue['procedures']}
    counts = collections.Counter(p['blueprint_id'] for p in data['packets'])
    errors = []; totals = collections.Counter(); identities = set()
    if len(blueprints) != 425 or set(counts) != set(blueprints) or any(c != 2 for c in counts.values()) or len(data['packets']) != 850:
        errors.append({'error': 'Must have exactly 425 procedures x 2 packets = 850.'})
    if len({p['id'] for p in data['packets']}) != 850:
        errors.append({'error': 'Duplicate or missing packet IDs.'})
    for i, p in enumerate(data['packets'], 1):
        try:
            evidence = audit_packet(args.root, p, blueprints[p['blueprint_id']])
            applicant_id = evidence.pop('applicant_id')
            assert applicant_id not in identities, 'duplicate applicant between packets'
            identities.add(applicant_id); totals.update(evidence)
        except Exception as exc:
            errors.append({'packet_id': p['id'], 'error': str(exc)})
        if i % 50 == 0 or i == len(data['packets']):
            print('verify complete packets', i, '/', len(data['packets']), 'errors', len(errors), flush=True)
    report = {'passed': not errors, 'dataset': DATASET, 'inventory_procedures': len(blueprints),
              'scenario_manifests': len(data['packets']), 'checked_documents': totals['documents'],
              'checked_form_pages': totals['pages'], 'identity_fields_checked': totals['identity_fields'],
              'checked_required_artifacts': totals['requirements'], 'errors': errors,
              'checks': ['425 x 2 actual raster PDFs', 'every selected checklist artifact has a filled PDF',
                         'excluded conditions retained without mixing alternatives', 'source forms byte-identical to verified originals',
                         'mock provenance never claims original source', 'shared identities and facts across all papers',
                         'unique applicants across packets', 'field coordinates within page',
                         'no hidden answers or widgets', 'merged page images equal individual documents'],
              'source_coverage': {k: data['stats'][k] for k in ['procedures_with_published_components', 'procedures_with_assumed_components', 'historical_mock_packets']},
              'limitations': ['Complete means complete against the declared synthetic scenario checklist.',
                              'Unretrieved official requirements remain explicit test assumptions.',
                              'Mock papers have purpose-built layouts and do not certify administrative eligibility.']}
    save(out/'verification.json', report)
    if errors:
        raise RuntimeError(str(len(errors))+' complete packet verification errors')


def portable_packet(packet):
    p = copy.deepcopy(packet)
    p.update(path_base='packet_directory', profile_path='profile.json', checklist_path='checklist.json')
    p['combined_pdf']['local_path'] = 'ho-so-test.pdf'
    for d in p['documents']:
        d['local_path'] = 'giay-to/'+Path(d['local_path']).name
        d['ground_truth_path'] = 'dap-an/'+Path(d['ground_truth_path']).name
        d['source_pdf_included'] = False
    for r in p['page_ranges']+p['combined_pdf']['page_ranges']:
        r['field_truth_path'] = 'dap-an/'+Path(r['field_truth_path']).name
    return p


def write_packet(archive, root, out, packet, prefix):
    directory = out/'packets'/packet['id']
    for name in ['profile.json', 'checklist.json', 'ho-so-test.pdf']:
        archive.write(directory/name, prefix+'/'+name)
    archive.writestr(prefix+'/packet.json', json.dumps(portable_packet(packet), ensure_ascii=False, indent=2))
    for d in packet['documents']:
        archive.write(root/d['local_path'], prefix+'/giay-to/'+Path(d['local_path']).name)
        archive.write(root/d['ground_truth_path'], prefix+'/dap-an/'+Path(d['ground_truth_path']).name)


def package(args, out):
    from .packet_web import build
    verification = read(out/'verification.json')
    if not verification['passed'] or verification['errors']:
        raise RuntimeError('Verify complete packets before packaging.')
    catalogue = read(out/'catalogue.json'); data = read(out/'packets.json'); stats = data['stats']
    by_procedure = collections.defaultdict(list)
    for p in data['packets']:
        by_procedure[p['blueprint_id']].append(p)
    (out/'downloads').mkdir(exist_ok=True)
    for i, b in enumerate(catalogue['procedures'], 1):
        target = out/'downloads'/(b['id']+'.zip')
        with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
            archive.write(out/'blueprints'/(b['id']+'.json'), 'thu-tuc.json')
            for p in by_procedure[b['id']]:
                write_packet(archive, args.root, out, p, f"bo-{p['copy']:02}")
        b['download_url'] = 'downloads/'+target.name
        b['packet_ids'] = [p['id'] for p in by_procedure[b['id']]]
        if i % 50 == 0:
            print('package procedure ZIPs', i, '/ 425', flush=True)
    save(out/'catalogue.json', catalogue)
    build(args.root, out, catalogue, data, verification)
    (out/'README.txt').write_text(f'''BỘ DỮ LIỆU GIẢ ĐẦY ĐỦ GIẤY TỜ - 425 x 2 = 850 BỘ

425 mục trong danh mục cấp xã Hà Nội ngày 27/4/2026, mỗi mục đúng 2 bộ giả.
{stats['packets_with_pdf']} PDF gộp thực tế; {stats['filled_documents']} file giấy tờ, {stats['combined_pdf_pages']} trang.
Trong đó {stats['source_form_documents']} biểu mẫu nguồn đã điền được giữ nguyên; {stats['mock_documents']} giấy tờ tự dựng có nhãn GIẢ LẬP.
Không còn bộ chỉ có checklist. Mỗi thành phần được chọn đều trỏ tới PDF đã điền.

Mỗi bộ có profile.json dùng chung, checklist.json, packet.json, ho-so-test.pdf,
PDF riêng từng giấy tờ và đáp án JSON gồm giá trị, vai trò, số trang, tọa độ.
Tên, số định danh, địa chỉ và mã tham chiếu nhất quán giữa các giấy tờ.
Hai bản dùng profile khác nhau, font Patrick Hand / Mali mô phỏng chữ viết tay.
Hướng dẫn và nhánh không chọn vẫn hiển thị; không ghép các nhánh loại trừ nhau.
Số lượng bản chính/bản sao theo nguồn được giữ trong checklist; một mẫu PDF đại diện cho loại giấy tờ.

PHẠM VI NGUỒN
{stats['procedures_with_published_components']} thủ tục có mô tả thành phần nguồn;
{stats['procedures_with_assumed_components']} mục chưa có mô tả nguồn dùng danh sách giấy tờ giả định công khai.
{stats['historical_mock_packets']} bộ thuộc mã đã thay đổi chỉ là mô phỏng lịch sử.
Đủ dữ liệu giả theo checklist kiểm thử không đồng nghĩa đủ điều kiện nộp hành chính.
Không sửa kho nguồn data/tuliem-dossiers hoặc biến giấy tờ tự dựng thành bản cấp chính thức.

MỞ VÀ TẢI
index.html: tìm theo mã, tên thủ tục, giấy tờ; xem hai bản và tải ZIP từng thủ tục.
tuliem-dossiers-full.zip: toàn bộ dữ liệu, giải nén vào thư mục data/ của dự án.
downloads/<mã>.zip: hai bộ, đường dẫn trong packet.json tương đối với bo-01/bo-02.
Chỉ đưa PDF vào OCR; đáp án JSON được giữ riêng để đánh giá, không nạp vào mô hình.
verification.json: kết quả kiểm tra toàn bộ 850 bộ và mỗi thành phần giấy tờ.

TÁI TẠO
/Volumes/quocDisk/AI/document-samples/venv/bin/python skills/vietnamese-form-dataset/scripts/build_complete_dossiers.py --root . --copies 2 --phase all --resume
''', encoding='utf-8')
    target = out/'tuliem-dossiers-full.zip'
    files = {out/n for n in ['README.txt', 'index.html', 'catalogue.json', 'packets.json', 'manifest.json', 'verification.json']}
    files.update(out/'blueprints'/(b['id']+'.json') for b in catalogue['procedures'])
    for p in data['packets']:
        files.update(out/'packets'/p['id']/n for n in ['profile.json', 'checklist.json', 'packet.json', 'ho-so-test.pdf'])
        for d in p['documents']:
            files.add(args.root/d['local_path']); files.add(args.root/d['ground_truth_path'])
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
        for i, path in enumerate(sorted(files), 1):
            archive.write(path, 'tuliem-dossiers-full/'+str(path.relative_to(out)))
            if i % 1000 == 0:
                print('package all files', i, '/', len(files), flush=True)
    save(out/'archive-info.json', {'filename': target.name, 'bytes': target.stat().st_size, 'sha256': sha(target)})
    save(out/'progress.json', {'stage': 'complete', **stats})
    print('Complete synthetic archive', target.stat().st_size, 'bytes', flush=True)


def execute(args):
    out = args.root/DIRECTORY; out.mkdir(parents=True, exist_ok=True)
    for phase in ['plan', 'generate', 'verify', 'package'] if args.phase == 'all' else [args.phase]:
        globals()[phase](args, out)
