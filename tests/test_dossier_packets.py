"""Dossier regressions: source roles, scenario branches, and shared identities."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'skills/vietnamese-form-dataset/scripts'))
if importlib.util.find_spec('fitz'):
    from vnforms.dossiers import component_role,scenario_status
    from vnforms.packet_render import shared_profile,field_value,resolved_packet_field


@unittest.skipUnless(importlib.util.find_spec('fitz') and importlib.util.find_spec('reportlab'),
                     'PDF dataset dependencies use the document-samples environment')
class DossierTests(unittest.TestCase):
    def test_source_headings_are_not_flat_mandatory_documents(self):
        self.assertEqual(component_role('Bản sao giấy khai sinh','* Giấy tờ phải xuất trình:'),'supporting_show')
        self.assertEqual(component_role('Công dân có quyền lựa chọn nơi đăng ký','* Lưu ý:'),'instruction')
        self.assertEqual(component_role('+ Giấy đề nghị cấp lại Giấy chứng nhận đăng ký hộ kinh doanh'),'applicant_form')
        self.assertEqual(component_role('Bản khai','b) Hồ sơ trình xét tặng, gồm:'),'agency_prepared')
        self.assertEqual(component_role('a) Đơn đề nghị cấp Giấy chứng nhận'),'applicant_form')
        self.assertEqual(component_role('a) Trợ cấp một lần - Bản khai theo Mẫu số 12. - Bản sao giấy báo tử'),'applicant_form')
        self.assertEqual(component_role('Văn bản đề nghị thẩm định báo cáo','Hồ sơ đề nghị thẩm định'),'applicant_form')
        self.assertEqual(scenario_status('Mẫu hộ tịch điện tử tương tác','', 'electronic_form'),'not_selected_direct_channel')
        self.assertEqual(scenario_status('Văn bản ủy quyền','', 'applicant_prepared'),'conditional_not_selected')
        self.assertNotEqual(scenario_status('Tờ khai khai sinh (nộp trực tiếp hoặc gửi qua bưu chính)', '', 'applicant_form'),'conditional_not_selected')
        self.assertEqual(scenario_status('Phiếu gửi qua bưu chính', '', 'applicant_form'),'conditional_not_selected')

    def test_historical_people_and_events_predate_the_application(self):
        profile=shared_profile({'id':'hn87-test','procedure_code':'1.013744',
                               'name':'Đi chiến trường không có thân nhân, ở lại miền Nam sau năm 1954'},0,20261113)
        self.assertLessEqual(int(profile['people']['applicant']['birth_year']),1936)
        profile=shared_profile({'id':'hn87-test','procedure_code':'1.010781',
                               'name':'Cấp Bằng Tổ quốc ghi công đối với người hy sinh trong chiến tranh'},0,20261113)
        self.assertLess(profile['people']['deceased']['birth_year'],profile['people']['representative']['birth_year'])
        self.assertLess(profile['people']['representative']['birth_year'],profile['death_date'][-4:])
        f=resolved_packet_field({'label':'Hy sinh ngày','semantic_type':'person.dob','role':'deceased'})
        self.assertEqual(field_value(f,profile,False)[0],profile['death_date'])
        combined=resolved_packet_field({'label':'năm sinh','printed_context':'Họ và tên bố, mẹ … năm sinh …',
                                       'semantic_type':'person.birth_year','role':'applicant'})
        self.assertEqual(field_value(combined,profile,False),('',None))

    def test_different_template_fields_use_one_packet_identity(self):
        blueprint={'id':'hn87-test','procedure_code':'1.001193','name':'Thủ tục đăng ký khai sinh'}
        profile=shared_profile(blueprint,0,20261113)
        ordinary={'semantic_type':'person.name','role':'applicant','label':'Họ và tên người yêu cầu'}
        curated={'id':'father.name','value_spec':'$father.name'}
        a,entity_a=field_value(ordinary,profile,False)
        b,entity_b=field_value(curated,profile,True)
        self.assertEqual(a,b)
        self.assertEqual(entity_a,'applicant.name')
        self.assertEqual(entity_b,'father.name')
        self.assertEqual(profile['aliases']['father'],'applicant')
        other=shared_profile(blueprint,1,20261113)
        self.assertNotEqual(profile['people']['applicant']['id'],other['people']['applicant']['id'])
        self.assertNotEqual(profile['seed_number'],other['seed_number'])

    def test_reissue_and_change_branches_are_not_merged(self):
        path=ROOT/'data/tuliem-dossiers/blueprints/hn87-418.json'
        if not path.is_file():self.skipTest('No generated source-backed blueprint')
        blueprint=json.loads(path.read_text())
        self.assertEqual(blueprint['procedure_code'],'2.000575')
        selected=blueprint['default_test_scenario']['selected_conditional_group']
        self.assertIn('bị mất',selected)
        for c in blueprint['components']:
            if c['selected_template_id']:
                self.assertEqual(c['section'],selected)
                self.assertIn('cấp lại',c['name'])
        self.assertTrue(any(c['scenario_status']=='alternative_case_not_selected' for c in blueprint['components']))

    def test_dated_scope_does_not_hide_missing_or_repealed_entries(self):
        path=ROOT/'data/tuliem-dossiers/catalogue.json'
        if not path.is_file():self.skipTest('No generated dossier catalogue')
        catalogue=json.loads(path.read_text());rows=catalogue['procedures']
        self.assertEqual(len(rows),425)
        self.assertEqual({int(r['ordinal']) for r in rows},set(range(1,426)))
        for r in rows:
            if r.get('lifecycle') and not r['lifecycle'].get('use_old_form_for_synthetic_data',True):
                self.assertEqual(r['selected_template_ids'],[])
                self.assertEqual(r['status'],'held_changed_procedure')


if __name__=='__main__':unittest.main()
