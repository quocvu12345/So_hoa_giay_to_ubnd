"""Kiểm tra hợp đồng NuExtract và cách chấm; không cần tải model trong unit test."""
import json
from pathlib import Path

import pytest

from document_ai.field_extract import decode_fields, native_prompt
from document_ai.classify import evidence_fields


def test_native_schema_and_document_are_separate():
    class Tokenizer:
        def apply_chat_template(self, messages, **kwargs):
            assert messages == [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": "Tài liệu"}]}]
            assert json.loads(kwargs["template"]) == {"Họ tên": "verbatim-string"}
            assert kwargs["enable_thinking"] is False
            assert kwargs["tokenize"] is False and kwargs["add_generation_prompt"]
            return "rendered"

    assert native_prompt(Tokenizer(), "Tài liệu", ["Họ tên"], "Đơn", images=1) == "rendered"


def test_native_null_missing_and_extra_keys():
    result = decode_fields('{"Tên":"Nguyễn An","Ngày":null,"ngoài schema":"bỏ"}', ["Tên", "Ngày", "Số"], True)
    assert result == [{"label": "Tên", "value": "Nguyễn An", "quote": "Nguyễn An"},
                      {"label": "Ngày", "value": "", "quote": ""},
                      {"label": "Số", "value": "", "quote": ""}]


@pytest.mark.parametrize("answer", ['[]', '{"Tên": ["An"]}', '{"Tên": 123}', '{"Tên": {"value":"An"}}', 'not json'])
def test_native_rejects_invalid_flat_schema(answer):
    with pytest.raises(ValueError):
        decode_fields(answer, ["Tên"], True)


def test_both_protocols_pass_through_same_evidence_filter():
    labels = ["Tên", "Địa chỉ"]
    pages = [{"page": 1, "text": "Tên: Nguyễn An"}]
    native = decode_fields('{"Tên":"Nguyễn An","Địa chỉ":"Hà Nội"}', labels, True)
    qwen = decode_fields('{"fields":[{"label":"Tên","value":"Nguyễn An"},{"label":"Địa chỉ","value":"Hà Nội"}]}', labels, False)
    for raw in (native, qwen):
        result = evidence_fields(raw, pages[0]["text"], labels, pages)
        assert [f["value"] for f in result] == ["Nguyễn An", ""]
        assert result[0]["source_pages"] == [1]
        assert result[1]["status"] == "missing"


def test_image_raw_scores_do_not_replace_guarded_scores(monkeypatch):
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1] / "training"))
    from bench_fields import score_document, summarize

    row = {"id": "a", "kind": "citizen", "expected_type_id": "A", "pages": [{"page": 1, "text": "lỗi OCR"}],
           "expected_fields": {"Tên": "Nguyễn An", "Ngoài schema": "x"}}
    result = {"fields": [], "raw_fields": [{"label": "Tên", "value": "Nguyễn An"}], "seconds": 1,
              "errors": [], "calls": [], "peak_mlx_gib": 2}
    summary = summarize([score_document(row, result)], [{"documentTypes": [{"id": "A", "fields": ["Tên"]}]}])
    assert summary["verified"]["correct"] == 0
    assert summary["raw"]["correct"] == summary["verified"]["n"] == 1
    assert summary["verified"]["readable"] == 0
    assert summary["verified"]["excluded"] == ["a: Ngoài schema"]
