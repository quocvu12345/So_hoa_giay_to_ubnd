"""Generate dossier documents from one shared scenario, never concatenate
unrelated per-template identities into a purported coherent dossier."""
import collections
import concurrent.futures
import copy
import hashlib
import io
import json
import re
from pathlib import Path

import fitz
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen.canvas import Canvas

from .pipeline import save, sha
from .layout import lines
from .render import fonts
from .semantics import scenario, value_for, fold


def shared_profile(blueprint, index, seed):
    identity_key=blueprint['id']+':'+blueprint['procedure_code']
    data=scenario(identity_key,index,seed,blueprint['name'])
    people=data['people']
    ordinal=blueprint.get('ordinal')
    if ordinal is None:
        suffix=re.search(r'-(\d+)$',blueprint['id'])
        ordinal=int(suffix[1]) if suffix else data['seed_number']%40000
    # Use a bounded, injective namespace for the <=20 copies, rather than the
    # truncated random seed (which can collide across unrelated people).
    namespace=int(ordinal)*20+index
    for i,person in enumerate(people.values()):person['id']=f'999{namespace:06}{i:03}'
    aliases={}
    code=blueprint['procedure_code']
    context=fold(blueprint['name'])
    def born(role, year):
        p=people[role]
        p.update(birth_year=str(year),dob=p['dob'][:6]+str(year))
    historical=bool(re.search(r'chong my|chong phap|chien truong|chien tranh|liet si|hy sinh|to quoc ghi cong|khang chien',context))
    if historical:
        data['history']=True
        data['death_date']='08/11/1972'
        born('deceased',1944)
        # A child submitting a war victim's dossier must predate the death.
        born('representative',1968)
        if 'than nhan' not in context or 'khong co than nhan' in context:
            veteran_year=1928 if 'chong phap' in context else 1933 if '1954' in context else 1944
            for role,year in {'applicant':veteran_year,'wife':veteran_year+4,'husband':veteran_year,
                              'child':veteran_year+26,'mother':veteran_year-24,'father':veteran_year-27}.items():born(role,year)
    if code!='1.003702' and re.search(r'mam non|nha tre|mau giao',context):
        born('child',2022)
    if code in {'1.001193','1.001022','2.000635'}:
        people['child'].update(dob='01/11/2026',birth_day='01',birth_month='11',birth_year='2026')
        people['father']=copy.deepcopy(people['applicant']);aliases['father']='applicant'
        people['mother']=copy.deepcopy(people['wife']);aliases['mother']='wife'
    if code in {'1.000894','1.004746'}:
        people['husband']=copy.deepcopy(people['applicant']);aliases['husband']='applicant'
        people['wife']['birth_year']='1992';people['wife']['dob']=people['wife']['dob'][:6]+'1992'
    if code=='1.004845':
        people['ward_person'].update(dob='01/11/2008',birth_day='01',birth_month='11',birth_year='2008')
    data['aliases']=aliases
    data['packet_id']=f"hs-{blueprint['id']}-{index+1:02}"
    data['procedure_code']=code
    data['channel']='direct'
    return data


def resolved_packet_field(field):
    """Correct known ambiguous legacy inferences without changing source slots.

    The bulk schemas are automatic candidates. Reuse their geometry, but never
    turn "hy sinh ngày" into a birthday or "miền Nam" into a calendar year.
    """
    f=copy.deepcopy(field)
    label=fold(f['label']);context=fold(f.get('printed_context',''))
    if re.search(r'bo,?\s*me|cha,?\s*me',context) and re.search(r'ho va ten|ho ten|nam sinh',label):
        f['semantic_type']=None
        f['resolution_note']='ambiguous_combined_parent_roles'
        return f
    if re.search(r'hy sinh ngay|ngay.*hy sinh|chet ngay|ngay.*chet|ngay tu tran',label):
        f.update(semantic_type='death_date',role='deceased')
    elif re.search(r'(co quan|don vi)',label) and not re.search(r'kinh gui|noi cap|co quan cap|ngay cap|dia chi|noi cong tac',label):
        f['semantic_type']='organization.name'
    if f.get('semantic_type','') and f['semantic_type'].startswith('person.'):
        text=label if f['semantic_type']=='person.name' else context
        for role,pattern in [('wife',r'ho va ten vo|ho ten vo|ten vo hoac chong'),
                             ('child',r'ho va ten con|ho ten con'),('father',r'ho va ten bo|ho ten bo')]:
            if re.search(pattern,text):f['role']=role;break
    return f


def curated_value(field, data):
    key=field['id'];spec=field['value_spec']
    ref=spec[1:] if spec.startswith('$') else key
    if '.' in ref:
        role,suffix=ref.split('.',1)
        mapped={'subject':'applicant','recipient_person':'child','student':'child','guardian':'mother'}.get(role,role)
        person=data['people'].get(mapped)
        suffix_map={'year':'birth_year','nationality_short':'nationality'}
        typ=suffix_map.get(suffix,suffix)
        if person and typ in person:
            return person[typ], mapped+'.'+typ
        if person and suffix=='identity':return 'Căn cước số '+person['id'],mapped+'.id'
        if person and suffix=='address':return data['address'],'household.address'
        if person and suffix=='ethnicity':return 'Kinh',None
        if person and typ=='nationality':return ('VN' if suffix=='nationality_short' else 'Việt Nam'),None
        if person and suffix in {'birthplace','hometown'}:return 'Hà Nội',None
    simple={'recipient':'UBND phường Từ Liêm','place':'Hà Nội','day':'13','month':'11','year':'2026','copies':'2',
            'relationship':'Cha' if data['procedure_code'] in {'1.001193','1.001022','2.000635'} else 'Bản thân',
            'business.name':data['organization'],'business.no':'TEST-HKD-'+str(data['seed_number']%1000),
            'business.ref':'TEST-01','business.reason':'Giấy chứng nhận bị mất',
            'school.name':'Trường Mẫu Thử','student.class':'6A','student.ethnicity':'La Hủ',
            'student.address':data['address'],'student.dob':'01/11/2015',
            'marriage.no':'123','marriage.book':'01','marriage.day':'15','marriage.month':'06','marriage.year':'2018',
            'marriage.place':'UBND phường Mễ Trì, Hà Nội', 'birth.words1':'Ngày một',
            'birth.words2':'tháng mười một năm hai nghìn không trăm hai mươi sáu',
            'death.hour':'08','death.minute':'30','death.day':'08','death.month':'11','death.year':'2026',
            'death.place':'Hà Nội','death.reason':'Tuổi cao','death.notice':'TEST-001','death.issuer':'BV Mẫu Thử'}
    if ref in simple:return simple[ref],('household.address' if ref=='student.address' else None)
    if key in simple:return simple[key],None
    return (spec if not spec.startswith('$') else ''),None


def field_value(field, data, curated):
    if curated:return curated_value(field,data)
    kind=field['semantic_type'];role=field.get('role','applicant')
    if not kind:return '',None
    # A large width requests full scenario values. A value too long for its
    # actual original slot is recorded as missing, not silently changed to a
    # different address or shortened person identity across documents.
    value=value_for(kind,field['label'],role,data,1000)
    # Historical service/event dates are distinct from the declaration date.
    context=fold(field.get('printed_context',''))
    if data['history'] and kind in {'day','month','year','date'} and re.search(r'chien truong|ra bac|nhap ngu|mat tich',context):
        event='08/11/1972' if 'mat tich' in context else '13/11/1968'
        value={'day':event[:2],'month':event[3:5],'year':event[6:],'date':event}[kind]
    entity=role+'.'+kind.split('.')[1] if kind.startswith('person.') else 'household.address' if kind=='address' else None
    return value,entity


def render_document(root,out,template,schema,data,index):
    assets=root/'data/tuliem-dossiers/assets'
    style,path=fonts(root)[index%2]
    source=assets/'source-pdf'/(template['id']+'.pdf')
    document_id='pkt-'+data['packet_id'][3:]+'-'+hashlib.sha256(template['id'].encode()).hexdigest()[:12]
    doc=fitz.open(source)
    authority_footers={}
    if not schema.get('curated',False):
        for pn,page in enumerate(doc,1):
            markers=[r for r in lines(page) if re.search(r'xac nhan.*ubnd|co quan, don vi.{0,30}nhan|co quan.*chung nhan',fold(r['text']))
                     and r['bbox'][1]>page.rect.height*.65 and r['bbox'][0]<page.rect.width*.5]
            if markers:authority_footers[pn]=(min(r['bbox'][1] for r in markers)-35,page.rect.width*.54)
    truth=[];field_counts=collections.Counter();excluded=[]
    for original_field in schema['fields']:
        f=original_field if schema.get('curated',False) else resolved_packet_field(original_field)
        footer=authority_footers.get(f['page'])
        if footer and f['bbox'][1]>footer[0] and f['bbox'][0]<footer[1]:
            excluded.append({**f,'reason':'authority_confirmation_footer'})
            continue
        value,entity=field_value(f,data,schema.get('curated',False))
        value=str(value or '')
        x0,y0,x1,y1=f['bbox'];w=x1-x0-2
        size=min(11.2,(y1-y0)*.78,w/max(.001,pdfmetrics.stringWidth(value,style,1))) if value else 0
        state='filled' if value and size>=6.3 else 'does_not_fit' if value else 'unresolved'
        typed={k:v for k,v in f.items() if k!='value_spec'}
        field_counts[f['id']]+=1
        typed['id']=f['id'] if field_counts[f['id']]==1 else f['id']+'.occurrence'+str(field_counts[f['id']])
        typed['semantic_key']=f['id']
        typed.update(value=value if state=='filled' else '',expected_status=state,entity_key=entity,
                     role=f.get('role','applicant'),font_name=path.stem,font_size=round(size,3),
                     coordinate_origin='top_left',bbox_unit='pdf_point')
        if state=='filled':
            typed['ink_bbox']=[x0+.5,f['baseline']-1.6-size*1.15,x0+.5+pdfmetrics.stringWidth(value,style,size),f['baseline']-1.6+size*.32]
        else:typed['candidate_value_not_inserted']=value
        truth.append(typed)
    # Cases with no fitting fields cannot be labelled as a filled document.
    if not any(f['value'] for f in truth):return None
    raster=fitz.open()
    for pn,page in enumerate(doc,1):
        stream=io.BytesIO();canvas=Canvas(stream,pagesize=(page.rect.width,page.rect.height),invariant=1)
        canvas.setFillColorRGB(.10,.22,.42)
        for f in truth:
            if f['page']!=pn or not f['value']:continue
            canvas.setFont(style,f['font_size']);canvas.drawString(f['bbox'][0]+.5,page.rect.height-(f['baseline']-1.6),f['value'])
        canvas.saveState();canvas.setFillColorRGB(.6,.12,.12);canvas.setFont(style,7)
        canvas.translate(8,20);canvas.rotate(90);canvas.drawString(0,0,'BỘ HỒ SƠ TEST GIẢ LẬP · '+data['packet_id']);canvas.restoreState()
        canvas.setFont(style,6);canvas.setFillColorRGB(.6,.12,.12);canvas.drawString(22,8,document_id+' · Chữ mô phỏng viết tay')
        canvas.save();overlay=fitz.open(stream=stream.getvalue(),filetype='pdf');page.show_pdf_page(page.rect,overlay,0)
        pix=page.get_pixmap(dpi=150,alpha=False);r=raster.new_page(width=page.rect.width,height=page.rect.height);r.insert_image(r.rect,stream=pix.tobytes('png'))
    filename=out/'documents'/(document_id+'.pdf');filename.parent.mkdir(parents=True,exist_ok=True)
    raster.save(filename,deflate=True,garbage=4)
    ground=out/'ground-truth'/(document_id+'.json')
    save(ground,{'document_id':document_id,'packet_id':data['packet_id'],'template_id':template['id'],
                 'profile_seed':data['seed_number'],'fields':truth,'unfilled_candidates':schema.get('unfilled_candidates',[])+excluded,
                 'schema_status':schema['schema_status'],'handwriting_kind':'font_simulation','synthetic':True})
    record={'id':document_id,'title':template['filename'],'template_id':template['id'],
            'local_path':str(filename.relative_to(root)),'sha256':sha(filename),'byte_size':filename.stat().st_size,
            'page_count':len(raster),'media_type':'application/pdf','ground_truth_path':str(ground.relative_to(root)),
            'source_pdf':str(source.relative_to(root)),'original_sha256':template['sha256'],
            'filled_fields':sum(bool(f['value']) for f in truth),'font_name':path.stem}
    return record


def packet_job(job):
    directory,blueprint,index,seed=job
    root=Path(directory);out=root/'data/tuliem-dossiers';data=shared_profile(blueprint,index,seed)
    packet_id=data['packet_id'];templates={t['id']:t for t in json.loads((out/'templates.json').read_text())}
    documents=[]
    for tid in blueprint['selected_template_ids']:
        t=templates[tid];schema=json.loads((out/'assets/schemas'/(tid+'.json')).read_text())
        r=render_document(root,out,t,schema,data,index)
        if r:documents.append(r)
    checklist=[]
    docs_by_template={d['template_id']:d for d in documents}
    for c in blueprint['components']:
        d=docs_by_template.get(c['selected_template_id'])
        state='filled_form_available' if d else c['scenario_status']
        if d and c.get('embedded_other_requirements'):state='mixed_requirement_needs_review'
        if not d and state in {'selected_for_test','conditional_needs_review','requirement_needs_review'}:
            state='supporting_document_missing' if c['role'] in {'supporting_show','supporting_submit'} else 'source_form_missing' if c['role'] in {'applicant_form','applicant_prepared'} else 'requirement_needs_review'
        checklist.append({**c,'test_artifact_status':state,'document_id':d['id'] if d else None})
    packetdir=out/'packets'/packet_id;packetdir.mkdir(parents=True,exist_ok=True)
    save(packetdir/'profile.json',{'synthetic':True,**data})
    save(packetdir/'checklist.json',checklist)
    ranges=[];merged=fitz.open()
    for d in documents:
        start=len(merged)+1
        with fitz.open(root/d['local_path']) as source:merged.insert_pdf(source)
        ranges.append({'document_id':d['id'],'template_id':d['template_id'],'start_page':start,'end_page':len(merged),
                       'field_truth_path':d['ground_truth_path']})
    combined=None
    if documents:
        destination=packetdir/'ho-so-test.pdf';merged.save(destination,deflate=True,garbage=4)
        combined={'local_path':str(destination.relative_to(root)),'sha256':sha(destination),'byte_size':destination.stat().st_size,
                  'page_count':len(merged),'page_ranges':ranges}
    open_items=[c for c in checklist if c['test_artifact_status'] in {'supporting_document_missing','source_form_missing','requirement_needs_review','conditional_needs_review','mixed_requirement_needs_review'}]
    status='held_changed_procedure' if blueprint['status']=='held_changed_procedure' else 'checklist_only' if not documents else 'forms_ready_with_gaps' if open_items else 'forms_ready_needs_requirement_review'
    packet={'id':packet_id,'blueprint_id':blueprint['id'],'procedure_code':blueprint['procedure_code'],'procedure_name':blueprint['name'],
            'copy':index+1,'profile_seed':data['seed_number'],'department_id':blueprint['department_id'],
            'status':status,'documents':documents,'combined_pdf':combined,'checklist_path':str((packetdir/'checklist.json').relative_to(root)),
            'profile_path':str((packetdir/'profile.json').relative_to(root)), 'open_component_count':len(open_items),
            'filled_document_count':len(documents),'filled_field_count':sum(d['filled_fields'] for d in documents),
            'page_ranges':ranges,'legally_complete':False,
            'coverage_note':'Các file đã điền dùng cùng profile. Giấy tờ cấp sẵn/chưa có mẫu được ghi thiếu, không tính thành đã đủ hồ sơ hành chính.'}
    save(packetdir/'packet.json',packet)
    save(out/'records'/(packet_id+'.json'),packet)
    return packet


def generate(args,out):
    catalogue=json.loads((out/'catalogue.json').read_text());jobs=[]
    for b in catalogue['procedures']:
        for copy in range(args.copies):jobs.append((str(args.root),b,copy,args.seed))
    packets=[]
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.jobs) as pool:
        futures={pool.submit(packet_job,j):j[1]['id'] for j in jobs}
        for i,f in enumerate(concurrent.futures.as_completed(futures),1):
            packets.append(f.result())
            if i%50==0 or i==len(jobs):
                print('packets',i,'/',len(jobs),flush=True);save(out/'progress.json',{'stage':'generate','completed':i,'target':len(jobs)})
    packets.sort(key=lambda p:p['id'])
    stats={'inventory_procedures':len(catalogue['procedures']),'scenario_manifests':len(packets),'copies_per_procedure':args.copies,
           'packets_with_pdf':sum(bool(p['combined_pdf']) for p in packets),'checklist_only_or_held':sum(not p['combined_pdf'] for p in packets),
           'procedures_with_pdf':len({p['blueprint_id'] for p in packets if p['combined_pdf']}),
           'filled_documents':sum(p['filled_document_count'] for p in packets),'filled_fields':sum(p['filled_field_count'] for p in packets),
           'combined_pdf_pages':sum((p['combined_pdf'] or {}).get('page_count',0) for p in packets),
           'packet_status_counts':dict(collections.Counter(p['status'] for p in packets))}
    save(out/'packets.json',{'stats':stats,'packets':packets})
    records=[]
    for p in packets:
        if p['combined_pdf']:
            c=p['combined_pdf'];records.append({'id':p['id'],'title':p['procedure_code']+' · '+p['procedure_name']+f" · bộ {p['copy']}",
                'local_path':c['local_path'],'sha256':c['sha256'],'byte_size':c['byte_size'],'page_count':c['page_count'],
                'media_type':'application/pdf','dataset':'tuliem-dossiers-v1','sample_kind':'synthetic_mixed_packet',
                'department_id':p['department_id'],'procedure_code':p['procedure_code'],'publisher':'Bộ hồ sơ test · profile đồng nhất',
                'requires_review':True})
    save(out/'manifest.json',{'dataset':'tuliem-dossiers-v1','documents':records,'stats':stats})
    print(json.dumps(stats,ensure_ascii=False,indent=2),flush=True)
