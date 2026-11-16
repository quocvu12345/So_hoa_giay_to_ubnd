"""Completeness regressions for the 425 x 2 synthetic dossier extension."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'skills/vietnamese-form-dataset/scripts'))
AVAILABLE = importlib.util.find_spec('fitz') and importlib.util.find_spec('reportlab')
if AVAILABLE:
    from vnforms.synthetic_papers import document_parts, plan_components, select_numbered_cases
    from vnforms.complete_dossiers import audit_packet


@unittest.skipUnless(AVAILABLE, 'PDF dependencies use the document-samples environment')
class CompleteDossierTests(unittest.TestCase):
    def test_embedded_supporting_papers_are_not_covered_by_request_only(self):
        parts = document_parts({'name': 'Bản khai theo Mẫu số 12. Bản sao giấy báo tử. Bản sao giấy khai sinh.'})
        self.assertEqual(len(parts), 3)
        self.assertIn('giấy báo tử', parts[1])

    def test_alternatives_choose_one_paper_and_keep_source_wording(self):
        parts = document_parts({'name': 'Bản sao giấy chứng tử hoặc quyết định của Tòa án tuyên bố đã chết'})
        self.assertEqual(parts, ['Bản sao giấy chứng tử'])

    def test_assumed_requirements_remain_distinct_from_source(self):
        blueprint = {'id': 'hn87-326', 'ordinal': '326', 'components': [], 'name': 'Liên thông khai sinh'}
        components = plan_components(blueprint)
        self.assertGreaterEqual(len(components), 7)
        self.assertTrue(all(c['requirement_basis'] == 'explicit_test_assumption' for c in components))
        self.assertTrue(all(c['source_url'] is None for c in components))
        self.assertTrue(all(c['included_in_test'] and c['expected_artifacts'] for c in components))

    def test_every_inventory_entry_has_a_nonempty_explicit_plan(self):
        path = ROOT/'data/tuliem-dossiers/catalogue.json'
        if not path.is_file():
            self.skipTest('No source catalogue')
        rows = json.loads(path.read_text())['procedures']
        self.assertEqual(len(rows), 425)
        for row in rows:
            with self.subTest(procedure=row['id']):
                select_numbered_cases(row)
                plan = plan_components(row)
                self.assertTrue(any(c['expected_artifacts'] for c in plan))
                for c in plan:
                    if c['scenario_status'] in {'alternative_case_not_selected', 'instruction_only'}:
                        self.assertEqual(c['expected_artifacts'], [])

    def test_numbered_worker_cases_and_one_of_sublists_are_not_concatenated(self):
        path = ROOT/'data/tuliem-dossiers/catalogue.json'
        if not path.is_file():
            self.skipTest('No source catalogue')
        blueprint = next(b for b in json.loads(path.read_text())['procedures'] if b['id'] == 'hn87-033')
        select_numbered_cases(blueprint)
        planned = plan_components(blueprint)
        active = [c for c in planned if c['expected_artifacts']]
        self.assertLess(len(active), 20)
        self.assertEqual(len({c['section'] for c in active}), 1)
        self.assertIn('nhà quản lý', blueprint['default_test_scenario']['selected_conditional_group'])
        # The criminal-record option was previously misclassified as an
        # instruction because its title contains the words 'không phải'.
        records = [c for c in active if 'Phiếu lý lịch tư pháp' in c['name']]
        self.assertEqual(len(records), 1)
        self.assertNotIn('hn87-033-c019', {c['id'] for c in active})

    def test_missing_supporting_paper_fails_even_if_packet_claims_complete(self):
        # A valid-looking status/combined PDF must not compensate for the
        # absent second document referenced by the checklist.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            profile = {'packet_id': 'hs-test', 'people': {'applicant': {'id': '999000001000'}}}
            (root/'profile.json').write_text(json.dumps(profile))
            checklist = [{'id': 'c1', 'included_in_test': True,
                          'artifacts': [{'id': 'paper1', 'document_id': 'missing'}]}]
            (root/'checklist.json').write_text(json.dumps(checklist))
            blueprint = {'source_requirements_available': True,
                         'components': [{'id': 'c1', 'included_in_test': True, 'expected_artifacts': [{'id': 'paper1'}]}]}
            packet = {'id': 'hs-test', 'profile_path': 'profile.json', 'checklist_path': 'checklist.json',
                      'legally_complete': False, 'source_requirements_available': True,
                      'documents': [{'id': 'present', 'requirement_ids': ['paper1']}], 'test_complete': True}
            with self.assertRaisesRegex(AssertionError, 'absent document'):
                audit_packet(root, packet, blueprint)


if __name__ == '__main__':
    unittest.main()
