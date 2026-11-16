"""Regression cases discovered while processing real source forms."""
import io
import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/vietnamese-form-dataset/scripts'))

from vnforms.semantics import infer, scenario


class FieldSemanticsTests(unittest.TestCase):
    def test_neighbouring_fields_do_not_supply_the_wrong_type(self):
        self.assertEqual(infer('Họ và tên: …………… Nam (Nữ)'), 'person.gender')
        self.assertEqual(infer('[16] Điện thoại: ……… [17] Fax: ……… [18] Email'), 'email')
        self.assertEqual(infer('Nơi cấp: …………… Quốc tịch'), 'nationality')
        self.assertEqual(infer('[07] Mã số thuế: [08] Hợp đồng dịch vụ làm thủ tục về thuế: Số'), 'reference_number')
        self.assertIsNone(infer('sở chính:'))
        self.assertIsNone(infer('tử:'))
        self.assertIsNone(infer('sinh là hóa đơn giá trị gia tăng theo quy định của pháp luật về hóa đơn điện tử:'))
        self.assertEqual(infer('Tổng doanh thu chịu thuế suất 0%'), 'money')

    def test_periods_citations_and_dates_are_distinct(self):
        self.assertEqual(infer('[01] Kỳ tính thuế: Tháng'), 'tax_period')
        self.assertEqual(infer('Thời gian phát sinh khoản phải nộp (Kỳ tính thuế)'), 'tax_period')
        self.assertIsNone(infer('lệnh số 05/2012/UBTVQH13)'))
        self.assertIsNone(infer('Mẫu số 01/BMVNAH'))
        self.assertIsNone(infer('(Ký, ghi rõ họ tên)'))
        self.assertEqual(infer('Trú quán:'), 'address')
        self.assertEqual(infer('Quan hệ với bà mẹ'), 'relationship')
        self.assertEqual(infer('Kính gửi: Chủ tịch UBND'), 'recipient')

    def test_scenarios_are_repeatable_and_roles_have_distinct_ids(self):
        a = scenario('source-hash', 0, 7, 'Tờ khai cá nhân chống Mỹ')
        b = scenario('source-hash', 0, 7, 'Tờ khai cá nhân chống Mỹ')
        c = scenario('source-hash', 1, 7, 'Tờ khai cá nhân chống Mỹ')
        self.assertEqual(a, b)
        self.assertNotEqual(a['seed_number'], c['seed_number'])
        people = a['people']
        self.assertEqual(len({p['id'] for p in people.values()}), len(people))
        for person in people.values():
            self.assertEqual(person['dob'][-4:], person['birth_year'])
        self.assertLess(int(people['father']['birth_year']), int(people['applicant']['birth_year']))
        self.assertLess(int(people['applicant']['birth_year']), int(people['child']['birth_year']))

    @unittest.skipUnless(importlib.util.find_spec('fitz') and importlib.util.find_spec('reportlab'),
                         'PDF fixture dependencies are in the document-samples environment')
    def test_multiline_input_and_authority_confirmation(self):
        import fitz
        from reportlab.pdfgen.canvas import Canvas
        from vnforms.layout import page_schema
        stream = io.BytesIO()
        canvas = Canvas(stream, pagesize=(500, 400))
        canvas.setFont('Helvetica', 12)
        canvas.drawString(50, 340, '1. Ho va ten:')
        canvas.drawString(50, 323, '.' * 65)
        canvas.drawString(50, 290, 'Email: ' + '.' * 40)
        canvas.drawString(50, 90, 'Xac nhan cua UBND')
        canvas.drawString(50, 70, 'Ho va ten: ' + '.' * 40)
        canvas.save()
        pdf = fitz.open(stream=stream.getvalue(), filetype='pdf')
        fields, skipped = page_schema(pdf[0], 1)
        self.assertTrue(any(f['semantic_type'] == 'person.name' and f['detection_method'] == 'blank_under_multiline_label' for f in fields))
        self.assertTrue(any(f['semantic_type'] == 'email' for f in fields))
        self.assertFalse(any(f['bbox'][1] > 310 for f in fields))
        self.assertTrue(any(f['reason'] == 'agency_signature_or_instruction' for f in skipped))


if __name__ == '__main__':
    unittest.main()
