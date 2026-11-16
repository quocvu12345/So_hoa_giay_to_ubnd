"""Coverage, coherent identities, page boundaries and source integrity checks."""
import collections
import copy
import json
from pathlib import Path
import unicodedata
import zipfile

import fitz
from PIL import Image, ImageChops, ImageDraw

from .pipeline import save,sha


def normal(s):return ' '.join(unicodedata.normalize('NFC',str(s)).casefold().split())


def verify(args,out):
    catalogue=json.loads((out/'catalogue.json').read_text());packets=json.loads((out/'packets.json').read_text())
    blueprints={b['id']:b for b in catalogue['procedures']};errors=[];checked_docs=0;checked_pages=0;cross_fields=0
    identity_owners={}
    templates={t['id']:t for t in json.loads((out/'templates.json').read_text())};checked_sources=set()
    counts=collections.Counter(p['blueprint_id'] for p in packets['packets'])
    if set(counts)!=set(blueprints) or any(n!=args.copies for n in counts.values()):errors.append({'error':'scenario_count_mismatch'})
    for i,p in enumerate(packets['packets'],1):
        try:
            profile=json.loads((args.root/p['profile_path']).read_text());b=blueprints[p['blueprint_id']]
            assert profile['packet_id']==p['id'] and profile['seed_number']==p['profile_seed']
            aliases=profile.get('aliases',{});unique_ids={}
            for role,actor in profile['people'].items():
                canonical=aliases.get(role,role)
                if actor['id'] in unique_ids:assert unique_ids[actor['id']]==canonical,'different roles share undeclared identity'
                unique_ids[actor['id']]=canonical
                owner=(p['id'],canonical)
                if actor['id'] in identity_owners:assert identity_owners[actor['id']]==owner,'identity number reused across profiles'
                identity_owners[actor['id']]=owner
                assert actor['dob'][-4:]==actor['birth_year'],'birth year inconsistent in profile'
            if b['status']=='held_changed_procedure':assert not p['documents'] and not p['combined_pdf']
            observed=collections.defaultdict(set)
            for d in p['documents']:
                if d['template_id'] not in checked_sources:
                    template=templates[d['template_id']]
                    schema=json.loads((out/'assets/schemas'/(d['template_id']+'.json')).read_text())
                    assert sha(out/template['local_path'])==template['sha256']==d['original_sha256'],'original source hash mismatch'
                    assert sha(args.root/d['source_pdf'])==schema['rendered_source_sha256'],'converted source hash mismatch'
                    checked_sources.add(d['template_id'])
                path=args.root/d['local_path'];assert sha(path)==d['sha256'],'PDF hash mismatch'
                truth=json.loads((args.root/d['ground_truth_path']).read_text())
                assert truth['profile_seed']==profile['seed_number'] and truth['packet_id']==p['id']
                assert len({f['id'] for f in truth['fields']})==len(truth['fields']),'duplicate field IDs'
                for f in truth['fields']:
                    if f['value'] and f.get('semantic_type')=='death_date':
                        assert f['value']==profile['death_date'],'death date differs from profile'
                    if f['value'] and f.get('entity_key'):
                        key=f['entity_key'];value=f['value'];role,suffix=key.split('.',1)
                        if suffix=='id' and value.startswith('Căn cước số '):value=value[len('Căn cước số '):]
                        canonical=aliases.get(role,role)+'.'+suffix
                        expected=profile['address'] if key=='household.address' else profile['people'].get(role,{}).get(suffix)
                        if expected is not None:assert normal(value)==normal(expected),'field differs from declared profile '+key
                        observed[canonical].add(normal(value));cross_fields+=1
                with fitz.open(path) as pdf,fitz.open(args.root/d['source_pdf']) as original:
                    assert len(pdf)==len(original)==d['page_count']
                    for pn,page in enumerate(pdf,1):
                        assert not page.get_text().strip(),'hidden answer text'
                        assert not list(page.widgets() or []),'hidden form values'
                        image=fitz.Pixmap(pdf,page.get_images()[0][0]);actual=Image.frombytes('RGB',(image.width,image.height),image.samples)
                        pix=original[pn-1].get_pixmap(dpi=150,alpha=False);expected=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
                        assert actual.size==expected.size
                        mask=Image.new('L',actual.size,255);draw=ImageDraw.Draw(mask);scale=150/72
                        draw.rectangle((0,0,int(15*scale),image.height),fill=0)
                        draw.rectangle((0,int((page.rect.height-18)*scale),image.width,image.height),fill=0)
                        for f in truth['fields']:
                            if f['page']==pn and f['value']:
                                x0,y0,x1,y1=f['ink_bbox'];assert -1<=x0<x1<=page.rect.width+1;assert -1<=y0<y1<=page.rect.height+1
                                draw.rectangle((max(0,int((x0-3)*scale)),max(0,int((y0-3)*scale)),int((x1+3)*scale),int((y1+3)*scale)),fill=0)
                        diff=ImageChops.difference(actual,expected);mx=ImageChops.lighter(ImageChops.lighter(diff.getchannel('R'),diff.getchannel('G')),diff.getchannel('B'))
                        assert ImageChops.multiply(mx,mask).getbbox() is None,'source background changed'
                        checked_pages+=1
                checked_docs+=1
            conflicts={k:list(v) for k,v in observed.items() if len(v)>1}
            assert not conflicts,'cross-document identity conflict '+str(conflicts)
            if p['combined_pdf']:
                combined=p['combined_pdf'];assert sha(args.root/combined['local_path'])==combined['sha256']
                with fitz.open(args.root/combined['local_path']) as pdf:
                    assert len(pdf)==sum(d['page_count'] for d in p['documents'])
                    assert all(not pg.get_text().strip() for pg in pdf)
                next_page=1
                assert len(p['page_ranges'])==len(p['documents']),'missing document page boundaries'
                for r,d in zip(p['page_ranges'],p['documents']):
                    assert r['start_page']==next_page and r['end_page']-r['start_page']+1==d['page_count']
                    next_page=r['end_page']+1
        except Exception as exc:errors.append({'packet_id':p['id'],'error':str(exc)})
        if i%100==0 or i==len(packets['packets']):print('verify packets',i,'errors',len(errors),flush=True)
    report={'inventory_procedures':len(blueprints),'scenario_manifests':len(packets['packets']),'checked_documents':checked_docs,
            'checked_form_pages':checked_pages,'checked_source_templates':len(checked_sources),'identity_fields_checked':cross_fields,'errors':errors,
            'checks':['425 baseline IDs retained','copies per procedure','shared packet profile','declared identity aliases','unique identities across packets',
                      'cross-document field consistency','values match declared profile','original and converted source hashes','field IDs','PDF/source geometry','background outside ink preserved',
                      'raster only','merged PDF page boundaries','no fake output for held old procedure'],
            'limitations':['Checklists preserve published conditions; legal completeness is not certified.',
                           'A packet with missing supporting documents is never reported as legally complete.',
                           'Procedures without templates have a checklist/profile only, not a filled PDF.']}
    save(out/'verification.json',report)
    if errors:raise RuntimeError(f'{len(errors)} packet verification errors')


def package(args,out):
    from .packet_web import build
    catalogue=json.loads((out/'catalogue.json').read_text());packets=json.loads((out/'packets.json').read_text());verification=json.loads((out/'verification.json').read_text())
    if verification['errors']:raise RuntimeError('Fix packet verification errors before packaging.')
    by_procedure=collections.defaultdict(list)
    for p in packets['packets']:by_procedure[p['blueprint_id']].append(p)
    (out/'downloads').mkdir(exist_ok=True)
    for b in catalogue['procedures']:
        path=out/'downloads'/(b['id']+'.zip')
        with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=3) as archive:
            archive.write(out/'blueprints'/(b['id']+'.json'),'thu-tuc.json')
            for p in by_procedure[b['id']]:
                prefix=f"bo-{p['copy']:02}"
                directory=out/'packets'/p['id']
                for name in ['profile.json','checklist.json']+(['ho-so-test.pdf'] if p['combined_pdf'] else []):
                    source=directory/name
                    archive.write(source,prefix+'/'+source.name)
                portable=copy.deepcopy(p);portable['path_base']='packet_directory'
                portable['profile_path']='profile.json';portable['checklist_path']='checklist.json'
                for d in portable['documents']:
                    d['local_path']='giay-to/'+Path(d['local_path']).name
                    d['ground_truth_path']='dap-an/'+Path(d['ground_truth_path']).name
                    d['source_pdf_included']=False
                if portable['combined_pdf']:
                    portable['combined_pdf']['local_path']='ho-so-test.pdf'
                ranges=portable['page_ranges']+((portable['combined_pdf'] or {}).get('page_ranges',[]))
                for r in ranges:r['field_truth_path']='dap-an/'+Path(r['field_truth_path']).name
                archive.writestr(prefix+'/packet.json',json.dumps(portable,ensure_ascii=False,indent=2))
                for d in p['documents']:
                    archive.write(args.root/d['local_path'],prefix+'/giay-to/'+Path(d['local_path']).name)
                    archive.write(args.root/d['ground_truth_path'],prefix+'/dap-an/'+Path(d['ground_truth_path']).name)
        b['download_url']='downloads/'+path.name
        b['packet_ids']=[p['id'] for p in by_procedure[b['id']]]
    save(out/'catalogue.json',catalogue)
    build(args.root,out,catalogue,packets,verification)
    stats=packets['stats']
    (out/'README.txt').write_text(f'''Bộ hồ sơ test cấp phường Từ Liêm

Mốc kiểm kê: 425 mục theo danh mục cấp xã Hà Nội ngày 27/4/2026; không gọi là toàn bộ thủ tục còn hiệu lực ngày hôm nay.
Đã lập {stats['scenario_manifests']} kịch bản/checklist, {stats['copies_per_procedure']} bản cho mỗi mục thủ tục.
Trong đó {stats['packets_with_pdf']} bộ có PDF đã điền, phủ {stats['procedures_with_pdf']} thủ tục; {stats['checklist_only_or_held']} bộ chỉ có profile/checklist hoặc mã cũ được giữ để đối chiếu.
Có {stats['filled_documents']} file giấy tờ được điền lại từ {stats['combined_pdf_pages']} trang nguồn; không lấy các PDF có người khai khác nhau để ghép thành một hồ sơ.

Mỗi bộ gồm profile.json dùng chung, checklist.json, packet.json, giấy tờ đã điền, đáp án từng ô và PDF gộp nếu có giấy tờ thực tế.
Phần giấy tờ chỉ xuất trình, giấy tờ có điều kiện, mẫu điện tử, hướng dẫn và phần cơ quan lập được phân loại riêng.
Giấy tờ chưa có bản mềm hoặc bản sao/căn cước/giấy tờ đã cấp chưa được cung cấp được ghi thiếu; không tính là đã đủ hồ sơ.
Không biến required=false trong API thành khẳng định rằng giấy tờ luôn tùy chọn. Tất cả hồ sơ là dữ liệu test, chưa xác nhận đủ điều kiện nộp hành chính.
Schema suy luận tự động còn cần duyệt ngữ nghĩa; các vị trí không đọc rõ/không đủ chỗ ghi được giữ trống với lý do trong đáp án.
Chữ điền là font Patrick Hand và Mali mô phỏng viết tay.

Tải từng thủ tục tại downloads/<id>.zip hoặc toàn bộ tại tuliem-dossiers.zip. ZIP từng thủ tục dùng đường dẫn tương đối trong bo-01/packet.json và bo-02/packet.json. Bản PDF nguồn trong metadata là tham chiếu kho mẫu, không nằm trong ZIP từng thủ tục.
Nếu dùng ZIP toàn bộ với project này, giải nén vào thư mục data/ để giữ đúng đường dẫn data/tuliem-dossiers trong manifest. Chỉ đưa ho-so-test.pdf vào OCR; đáp án/profile dùng để chấm riêng.
''')
    target=out/'tuliem-dossiers.zip'
    include={'catalogue.json','packets.json','manifest.json','verification.json','README.txt','index.html','templates.json'}
    current_files={str((out/'blueprints'/(b['id']+'.json')).relative_to(out)) for b in catalogue['procedures']}
    for p in packets['packets']:
        current_files.update('packets/'+p['id']+'/'+n for n in ['profile.json','checklist.json','packet.json']+(['ho-so-test.pdf'] if p['combined_pdf'] else []))
        for d in p['documents']:
            current_files.add(str((args.root/d['local_path']).relative_to(out)))
            current_files.add(str((args.root/d['ground_truth_path']).relative_to(out)))
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=3) as archive:
        for p in sorted(out.rglob('*')):
            rel=p.relative_to(out)
            if p.is_file() and (str(rel) in include or str(rel) in current_files):archive.write(p,'tuliem-dossiers/'+str(rel))
    save(out/'archive-info.json',{'filename':target.name,'bytes':target.stat().st_size,'sha256':sha(target)})
    save(out/'progress.json',{'stage':'complete',**stats})
    print('Dossier archive',target.stat().st_size,'bytes',flush=True)
