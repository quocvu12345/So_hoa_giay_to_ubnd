import json
from pathlib import Path


def build(root,out,catalogue,packets,verification):
    # Fields/answers stay in per-document JSON fetched on demand; the catalogue
    # can show all procedure and dossier component descriptions without loading
    # image data or the entire answer dataset into the browser.
    if packets['stats'].get('complete_synthetic_packets'):
        # Load large per-paper labels and descriptions only when a packet is
        # opened. The 850-packet catalogue stays usable on a local browser.
        data={'catalogue':{**catalogue,'procedures':[
            {k:b[k] for k in ['id','ordinal','procedure_code','name','domain','department_id','department',
                              'source_status','source_requirements_available','historical_mock_only','download_url']}
            for b in catalogue['procedures']]},
              'packets':{'stats':packets['stats'],'packets':[
                  {k:p[k] for k in ['id','blueprint_id','copy','filled_document_count','mock_document_count','source_form_count']}
                  for p in packets['packets']]},'verification':verification}
        html=Path(__file__).with_name('complete_packets.html').read_text()
    else:
        data={'catalogue':catalogue,'packets':packets,'verification':{k:v for k,v in verification.items() if k!='checks'}}
        html=Path(__file__).with_name('packets.html').read_text()
    html=html.replace('__DATA__',json.dumps(data,ensure_ascii=False).replace('<','\\u003c'))
    (out/'index.html').write_text(html)
