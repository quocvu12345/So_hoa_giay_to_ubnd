"""Separate published components, service cases, instructions and legal scope."""
import collections
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import shutil

import fitz

from .pipeline import save, sha, convert_chunk
from .layout import plan_one
from .semantics import fold


def raw_detail(root, detail):
    path = root / 'data/official-forms' / detail.get('raw_path','')
    if path.is_file():
        data = json.loads(path.read_text())
        return data.get('data', data)
    return {}


def component_role(name, section=''):
    n, s = fold(name).strip(' -•+\t\n'), fold(section)
    n=re.sub(r'^(?:\(?\d+\)?[.)]?|[a-z][.)])\s*','',n)
    if re.search(r'luu y|huong dan|ghi chu|yeu cau, dieu kien', s):
        return 'instruction'
    if re.match(r'(nguoi co yeu cau|nguoi yeu cau|nguoi nop).*?(thuc hien|cung cap|nop/xuat trinh)', n) or re.search(r'khong (phai|duoc) (nop|yeu cau)|trach nhiem|de nghi.*cap nhat', n) and not re.match(r'(to khai|don|giay de nghi)', n):
        return 'instruction'
    if 'mau' in n and re.search(r'dien tu.*tuong tac|tuong tac.*dien tu', n):
        return 'electronic_form'
    if 'xuat trinh' in s:
        return 'supporting_show'
    if re.search(r'ho so trinh xet|trinh xet tang', s) or re.match(r'(to trinh|bien ban|quyet dinh|thong bao|phieu chuyen)', n):
        return 'agency_prepared'
    if re.match(r'(to khai|ban khai|don\b|giay de nghi|van ban de nghi|phieu yeu cau|ban cam ket|ban tuong trinh)', n):
        return 'applicant_form'
    if re.match(r'(danh sach|bang ke|de an|phuong an|bao cao|dieu le|hop dong|giay uy quyen|van ban uy quyen)', n):
        return 'applicant_prepared'
    # Some source rows contain an entire numbered list, including the request
    # and supporting certificates. Keep their wording and flag mixed coverage.
    if re.search(r'(?:^|[.:;-])\s*(?:\d+[.)]\s*)?(to khai|ban khai|don de nghi|don dang ky)',n):
        return 'applicant_form'
    if re.search(r'ban sao|ban chup|giay chung|chung chi|can cuoc|ho chieu|giay khai sinh|trich luc|bang tot nghiep', n):
        return 'supporting_submit'
    if n.startswith('truong hop') and re.search(r'khong phai|chi can|da co|da nop', n):
        return 'instruction'
    return 'needs_review'


def scenario_status(name, section, role):
    """For the documented default: direct, self-submitted individual, ordinary case.

    Unknown requirements stay unresolved. Published required=False is kept as a
    source field; it is never used here to declare a paper universally optional.
    """
    s, n = fold(section), fold(name)
    primary=re.split(r'\.\s*truong hop',n,maxsplit=1)[0]
    if role == 'instruction': return 'instruction_only'
    if role == 'agency_prepared': return 'agency_reserved'
    if role == 'electronic_form': return 'not_selected_direct_channel'
    # Many civil forms are explicitly shared by the direct AND postal channels.
    # The presence of "bưu chính" alone must not exclude a direct paper form.
    if 'buu chinh' in n+' '+s and 'truc tiep' not in n+' '+s:
        return 'conditional_not_selected'
    if re.search(r'uy quyen|bi bo roi|mang thai ho|nguoi nuoc ngoai|yeu to nuoc ngoai|thanh vien ho gia dinh', primary+' '+s):
        return 'conditional_not_selected'
    if re.search(r'neu co|truong hop|doi voi|tuy theo|mot trong', n+' '+s):
        return 'conditional_needs_review'
    return 'selected_for_test' if role in {'applicant_form','applicant_prepared','supporting_submit','supporting_show'} else 'requirement_needs_review'


def prepare(args, out):
    root = args.root
    library = json.loads((root/'data/official-forms/library.json').read_text())
    classification = json.loads((root/'data/form-test-data/classification.json').read_text())
    baseline = [e for e in library['entries'] if e['baseline']]
    baseline_hashes = {f['sha256'] for e in baseline for f in e['blank_files']}
    templates = [t for t in classification['templates'] if t['sha256'] in baseline_hashes and
                 (t['input_status']=='applicant_inputs_detected' or t['input_class']=='applicant_prepared')]
    assets = out/'assets'
    for folder in ['source-pdf','schemas','conversions']:
        (assets/folder).mkdir(parents=True,exist_ok=True)
    bulk = root/'data/vietnamese-form-dataset'
    to_convert=[]
    for t in templates:
        for folder in ['source-pdf','schemas']:
            suffix = '.pdf' if folder=='source-pdf' else '.json'
            origin = bulk/folder/(t['id']+suffix)
            target = assets/folder/(t['id']+suffix)
            if origin.is_file() and not target.is_file(): shutil.copyfile(origin,target)
        if not (assets/'source-pdf'/(t['id']+'.pdf')).is_file():to_convert.append(t)
    soffice = '/Volumes/quocDisk/AI/document-samples/tools/lo-extracted/LibreOffice/LibreOffice.app/Contents/MacOS/soffice'
    chunks = [to_convert[i:i+15] for i in range(0,len(to_convert),15)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = [pool.submit(convert_chunk,(str(root),str(assets),soffice,c,1000+i)) for i,c in enumerate(chunks)]
        for f in concurrent.futures.as_completed(futures):
            results=f.result()
            if any(r['status']!='completed' for r in results): raise RuntimeError('Packet source conversion failed')
    jobs=[t for t in templates if not (assets/'schemas'/(t['id']+'.json')).is_file()]
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.jobs) as pool:
        for result in pool.map(plan_one,[(str(assets),t) for t in jobs]):
            print('extra schema',result['template_id'],result['fillable_fields'],flush=True)
    usable=[]
    for t in templates:
        schema=json.loads((assets/'schemas'/(t['id']+'.json')).read_text())
        if schema.get('fields'):usable.append(t)
    # Curated exact PDF page extracts supply civil forms omitted by DVC as files.
    curated=json.loads((root/'data/form-test-data/schemas.json').read_text())['forms']
    for f in curated:
        source=root/'data/official-forms/originals'/f['source_file']
        tid='curated-'+f['id'];target=assets/'source-pdf'/(tid+'.pdf')
        if not target.is_file():
            with fitz.open(source) as original:
                doc=fitz.open()
                for pn in f['source_pages']:doc.insert_pdf(original,from_page=pn-1,to_page=pn-1)
                doc.save(target,garbage=4,deflate=True)
        t={'id':tid,'filename':f['title'],'sha256':sha(source),'procedure_codes':f['procedure_codes'],
           'department_ids':[f['department_id']],'local_path':'../official-forms/originals/'+f['source_file'],
           'source_urls':[f['source_url']], 'attachment_ids':[], 'curated':True}
        save(assets/'schemas'/(tid+'.json'),{'template_id':tid,'fields':f['fields'],'source_pages':len(f['source_pages']),
             'source_sha256':t['sha256'],'rendered_source_sha256':sha(target),'context':f['title'],
             'schema_status':'curated_slot_mapping','unfilled_candidates':f['unfilled_slots'],'curated':True})
        usable.append(t)
    save(out/'templates.json',usable)
    print('packet assets',len(usable),'templates; extra conversions',len(to_convert),flush=True)


def blueprint(args, out):
    root=args.root
    lib=json.loads((root/'data/official-forms/library.json').read_text())
    classification=json.loads((root/'data/form-test-data/classification.json').read_text())
    routing={r['id']:r for r in classification['procedures']}
    templates=json.loads((out/'templates.json').read_text())
    by_hash={t['sha256']:t for t in templates if not t.get('curated')}
    original_templates={t['id']:t for t in templates}
    all_rows=[]
    for e in [e for e in lib['entries'] if e['baseline']]:
        route=routing[e['id']];components=[];variants=[];source_groups=[]
        hold=bool(e.get('lifecycle') and not e['lifecycle'].get('use_old_form_for_synthetic_data',True))
        for detail in e['details']:
            raw=raw_detail(root,detail)
            source_groups.extend({'name':g.get('name',''),'component_count':len(g.get('profileComponents') or []),
                                  'source_detail_id':detail['id']} for g in raw.get('executionCases') or [])
            for case in raw.get('cases') or []:
                variants.append({'id':case.get('id'),'code':case.get('code'),'name':case.get('name'),
                                 'source_processing_time':case.get('processingDay'),
                                 'has_case_specific_components':bool(case.get('profileComponents'))})
            for i,c in enumerate(detail['components'],1):
                role=component_role(c['name'],c.get('section',''))
                available=[]
                for f in c.get('download_files',[]):
                    t=by_hash.get(f.get('sha256'))
                    if t and t['id'] not in available:available.append(t['id'])
                # Prefer the first explicitly requested form number. A row may
                # also attach a relative's alternative form after the main one.
                first_number=re.search(r'mau\s*(?:so)?\s*(\d+)',fold(c['name']))
                if first_number and len(available)>1:
                    pattern=r'mau\s*(?:so)?\s*0?'+str(int(first_number[1]))+r'(?:\D|$)'
                    available.sort(key=lambda tid:not bool(re.search(pattern,fold(original_templates[tid]['filename']))))
                if available and role=='needs_review':role='applicant_form'
                status=scenario_status(c['name'],c.get('section',''),role)
                comps={'id':f"{e['id']}-c{i:03}",'code':c.get('component_code'),'name':c['name'],'section':c.get('section',''),
                       'role':role,'scenario_status':status,'required_as_published':c.get('required_as_published'),
                       'original_quantity':c.get('original_quantity'),'copy_quantity':c.get('copy_quantity'),
                       'source_url':detail['source_url'],'source_detail_id':detail['id'],
                       'embedded_other_requirements':bool(re.search(r'ban sao|giay ra vien|giay bao tu|giay tiep nhan',fold(c['name'])) and role in {'applicant_form','applicant_prepared'}),
                       'template_candidates':available,'template_selection_method':'first_matching_source_attachment' if available else None,
                       'selected_template_id':available[0] if available and role in {'applicant_form','applicant_prepared'}
                                                  and status not in {'conditional_not_selected','agency_reserved'} and not hold else None,
                       'selection_requires_review':len(available)>1}
                components.append(comps)
        # executionCases is overloaded in the public API: some entries are
        # headings (submit/show/notes), others are actual mutually exclusive
        # conditions. Pick one documented conditional group for the default
        # test, and keep all other conditions in the blueprint/checklist.
        conditional_groups=[]
        for g in source_groups:
            name=g['name'];n=re.sub(r'^(?:\d+|[a-z])[.)]\s*','',fold(name).lstrip(' -*+'))
            if n.startswith('truong hop') and 'uy quyen' not in n and g['component_count']:
                if name not in conditional_groups:conditional_groups.append(name)
        selected_condition=conditional_groups[0] if conditional_groups else None
        initial_groups=[g['name'] for g in source_groups if fold(g['name']).strip().startswith('ho so de nghi tham dinh')]
        followup_groups=[g['name'] for g in source_groups if fold(g['name']).strip().startswith('ho so nop lai')]
        if initial_groups and followup_groups:
            conditional_groups=list(dict.fromkeys(initial_groups+followup_groups))
            selected_condition=initial_groups[0]
        # Attach a curated shared national form only to the matching procedural
        # request component, never to an unrelated guide/supporting certificate.
        for t in templates:
            if not t.get('curated') or e['procedure_code'] not in t['procedure_codes'] or hold:continue
            matching=[c for c in components if c['role']=='applicant_form' and not c['selected_template_id']
                      and c['scenario_status'] not in {'conditional_not_selected','alternative_case_not_selected'}]
            title=fold(t['filename']);title=re.sub(r'^(to khai|giay de nghi|don de nghi)\s*','',title).split(' · ')[0]
            ranked=[c for c in matching if title in fold(c['name'])]
            if ranked:matching=ranked
            elif len(matching)>1:matching=[]
            if matching:
                c=matching[0];c['selected_template_id']=t['id'];c['template_candidates'].append(t['id']);c['template_selection_method']='curated_exact_pdf_page_for_matching_procedure'
        available_groups=[g for g in conditional_groups if any(c['section']==g and c['selected_template_id'] for c in components)]
        if available_groups:selected_condition=available_groups[0]
        if len(conditional_groups)>1:
            for c in components:
                if c['section'] in conditional_groups and c['section']!=selected_condition:
                    c['scenario_status']='alternative_case_not_selected';c['selected_template_id']=None
        selected=[]
        for c in components:
            if c['selected_template_id'] and c['selected_template_id'] not in selected:selected.append(c['selected_template_id'])
        status='held_changed_procedure' if hold else 'source_detail_missing' if not components else 'has_fillable_templates' if selected else 'source_template_missing'
        row={'id':e['id'],'ordinal':e['ordinal'],'procedure_code':e['procedure_code'],'name':e['name'],
             'domain':e['domain'],'department_id':route['department_id'],'department':route['department'],
             'authority_as_published':e.get('competent_authority'),'execution_level_as_published':e.get('execution_level'),
             'receiving_location_as_published':e.get('receiving_location'),'inventory_date':e['inventory_date'],
             'inventory_source_url':e['inventory_source_url'],'source_urls':[d['source_url'] for d in e['details']],
             'current_dvc_match':bool(e.get('current')),'lifecycle':e.get('lifecycle'),
             'scope':'hanoi_commune_notice_2026_04_27','scope_note':'Mốc kiểm kê cấp xã Hà Nội; áp dụng từng thủ tục tại Từ Liêm còn phải theo thẩm quyền/ủy quyền hiện hành.',
             'status':status,'components':components,'service_cases':variants,'selected_template_ids':selected,
             'source_component_groups':source_groups,'conditional_component_groups':conditional_groups,
             'default_test_scenario':{'channel':'direct','applicant_submits_self':True,'authorized':False,
                                      'special_case_flags':[],'selected_conditional_group':selected_condition,
                                      'case_selection_method':'first_published_condition_with_available_template_for_test' if selected_condition else 'ordinary_direct_submission',
                                      'case_status':'scenario_for_testing_not_a_legal_eligibility_decision'},
             'requirement_note':'required_as_published được giữ nguyên; false không chứng minh giấy tờ luôn tùy chọn. Các nhóm executionCases có thể là mục giấy tờ/hướng dẫn, không phải các phương án loại trừ nhau.'}
        all_rows.append(row);save(out/'blueprints'/(e['id']+'.json'),row)
    stats={'inventory_procedures':len(all_rows),'procedures_by_status':dict(collections.Counter(r['status'] for r in all_rows)),
           'published_component_descriptions':sum(len(r['components']) for r in all_rows),
           'document_components':sum(c['role']!='instruction' for r in all_rows for c in r['components']),
           'instruction_rows':sum(c['role']=='instruction' for r in all_rows for c in r['components']),
           'service_case_rows':sum(len(r['service_cases']) for r in all_rows),
           'templates_selected':len({t for r in all_rows for t in r['selected_template_ids']})}
    save(out/'catalogue.json',{'locality':'Phường Từ Liêm, Hà Nội','inventory_date':'2026-04-27',
          'source_snapshot_generated_at':lib['generated_at'],'stats':stats,'procedures':all_rows,
          'departments':classification['departments'], 'notes':[
            '425 là số mục trong danh mục công bố ngày 27/4/2026, không phải số thủ tục toàn quốc hoặc xác nhận toàn bộ còn áp dụng ngày hôm nay.',
            'Danh mục có tiếp nhận/phối hợp ngành dọc; tên đơn vị gợi ý không thay thế văn bản giao thẩm quyền.',
            'Một thủ tục có nhiều trường hợp, kênh nộp, giấy tờ điều kiện và giấy tờ chỉ xuất trình. Không có số lượng bộ hồ sơ cố định bằng số thủ tục.',
            'Mã cũ đã có chứng cứ bãi bỏ/thay thế được giữ để đối chiếu, không sinh mẫu dùng mã cũ.']})
    print(json.dumps(stats,ensure_ascii=False,indent=2),flush=True)


def execute(args):
    out=args.root/'data/tuliem-dossiers';out.mkdir(parents=True,exist_ok=True)
    phases=['prepare','plan','generate','verify','package'] if args.phase=='all' else [args.phase]
    for phase in phases:
        if phase=='prepare':prepare(args,out)
        elif phase=='plan':blueprint(args,out)
        elif phase=='generate':
            from .packet_render import generate
            generate(args,out)
        elif phase=='verify':
            from .packet_review import verify
            verify(args,out)
        else:
            from .packet_review import package
            package(args,out)
