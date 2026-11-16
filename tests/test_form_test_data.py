import importlib.util
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from form_fixtures.evaluate import score

spec = importlib.util.spec_from_file_location('official_input_triage', ROOT / 'scripts/classify-official-forms.py')
triage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(triage)


def test_external_services_are_not_routed_to_ward_department():
    assert triage.route('Hải quan') == 'haiquan'
    assert triage.route('Hàng hải và đường thủy nội địa') == 'chuyennganh'
    assert triage.route('Quản lý biên giới') == 'chuyennganh'
    assert triage.route('Đăng ký, quản lý cư trú (Bộ Công an)') == 'ca'
    assert triage.route('Lĩnh vực chưa biết') == 'review'


def test_issued_papers_and_agency_sections_are_not_applicant_forms():
    assert triage.paper_role('Bản sao giấy khai sinh')[0] == 'supporting_issued'
    assert triage.paper_role('Tờ trình về việc đề nghị hỗ trợ')[0] == 'agency_prepared'
    assert triage.paper_role('Giấy đề nghị hỗ trợ', 'Hồ sơ trình xét tặng')[0] == 'agency_prepared'
    assert triage.paper_role('Tờ khai đăng ký khai sinh')[0] == 'applicant_fillable'
    assert triage.paper_role('Đơn đề nghị kèm bản sao giấy khai sinh')[0] == 'mixed_or_conditional'


def test_same_value_elsewhere_does_not_pass_wrong_role():
    truth = {'document_id': 'test', 'fields': [
        {'id': 'mother.name', 'label': 'Mẹ', 'value': 'Trần Thị Mai', 'page': 1, 'bbox': [0, 0, 100, 20]},
        {'id': 'father.name', 'label': 'Cha', 'value': 'Nguyễn Văn An', 'page': 1, 'bbox': [0, 30, 100, 50]},
    ]}
    result = score(truth, {'fields': [{'id': 'mother.name', 'value': 'Nguyễn Văn An'},
                                      {'id': 'father.name', 'value': 'Trần Thị Mai'}]})
    assert result['filled_exact'] == 0
    # Matching text but a region from another field must be separately rejected.
    result = score(truth, {'fields': [{'id': 'mother.name', 'value': 'Trần Thị Mai',
                                       'page': 1, 'bbox': [5, 32, 95, 48]}]})
    assert result['checks'][0]['exact_value'] is True
    assert result['checks'][0]['source_region_matches'] is False


def test_blank_hallucination_and_missing_prediction_are_visible():
    truth = {'document_id': 'test', 'fields': [
        {'id': 'id', 'label': 'Số định danh', 'value': '', 'page': 1, 'bbox': [0, 0, 100, 20]},
        {'id': 'name', 'label': 'Họ tên', 'value': 'Nguyễn Văn An', 'page': 1, 'bbox': [0, 30, 100, 50]},
    ]}
    result = score(truth, {'fields': [{'id': 'id', 'value': '999000000011'}]})
    assert result['hallucinated_blanks'] == 1
    assert result['filled_exact'] == 0
    assert result['prediction_coverage'] == 1


def test_legacy_doc_embedded_zip_is_read_as_doc(monkeypatch, tmp_path):
    import io
    import zipfile
    from types import SimpleNamespace
    embedded = io.BytesIO()
    with zipfile.ZipFile(embedded, 'w') as z:
        z.writestr('drs/e2oDoc.xml', '<shape/>')
    source = tmp_path / 'legacy.doc'
    source.write_bytes(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1' + embedded.getvalue())
    assert zipfile.is_zipfile(source)
    monkeypatch.setattr(triage.subprocess, 'run', lambda *a, **k: SimpleNamespace(returncode=0, stdout='Họ tên: ....'.encode(), stderr=b''))
    text, method = triage.extract_text(source)
    assert text == 'Họ tên: ....'
    assert method == 'doc_textutil_readonly'
