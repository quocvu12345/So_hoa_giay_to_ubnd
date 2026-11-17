"""Số đo so sánh phải tính đúng cả khi shortlist bỏ bước chọn loại."""
from pathlib import Path
from types import SimpleNamespace

import pytest


@pytest.fixture
def bench(monkeypatch):
    pytest.importorskip("psutil")
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1] / "training"))
    import bench_pipeline

    return bench_pipeline


def test_title_shortcut_keeps_extraction_time_in_field_stage(bench, monkeypatch):
    import document_ai.classify as classifier

    instrument = SimpleNamespace(calls=[])
    categories = [{"code": "U02"}]

    def classify(pages, catalog, **kwargs):
        assert catalog is categories
        assert kwargs["restrict_types_to_group"] and kwargs["shortlist"]
        instrument.calls.extend([
            {"max_tokens": 1000, "seconds": 2, "prompt_tokens": 10, "output_tokens": 5},
            {"max_tokens": 2600, "seconds": 7, "prompt_tokens": 20, "output_tokens": 8},
        ])
        return {"category_code": "U02", "type_id": "U02-D01", "fields": [{"label": "Số", "value": "123"}]}

    monkeypatch.setattr(classifier, "classify", classify)
    row = {"id": "one", "kind": "filled", "expected_type_id": "U02-D01",
           "expected_fields": {"Số": "123"}, "pages": [{"page": 1, "text": "Số 123"}]}
    result = bench.run_classify(instrument, row, shortlist=True, categories=categories)
    assert result["steps"] == {"group": 2, "type": None, "fields": 7, "field_calls": 1}
    assert result["fields"][0]["in_ocr"]
    assert result["prompt_tokens"] == 30


def test_summary_counts_wrong_missing_and_failures_in_denominator(bench):
    def doc(seconds, prediction, error=None):
        return {"kind": "filled", "seconds": seconds, "error": error,
                "predicted_group": "U02", "predicted_type_id": "U02-D01", "expected_type_id": "U02-D01",
                "fields": [{"truth": "123", "pred": prediction, "in_ocr": True}],
                "steps": {"group": 1, "type": None, "fields": 2}, "prompt_tokens": 10, "output_tokens": 5}

    score = bench.summarize([doc(1, "123"), doc(2, "124"), doc(10, "", "invalid JSON")])["all"]
    assert score["documents"] == score["truth_fields"] == 3
    assert score["errors"] == 1
    assert score["field_correct"] == score["field_wrong"] == score["field_missed"] == 0.333
    assert score["seconds_p90"] == 10


def test_comparison_rejects_different_inputs_or_incomplete_runs(bench):
    from copy import deepcopy
    from compare_models import validate_pair
    import hashlib
    import json

    catalog = []
    metadata = {"complete": True, "document_ids": [], "input_sha256": "same",
                "catalog_sha256": hashlib.sha256(json.dumps(catalog).encode()).hexdigest(),
                "prompt": "production", "shortlist": True, "restrict_types_to_group": True,
                "thinking": False, "temperature": 0, "versions": {}}
    baseline = {"metadata": metadata, "documents": []}
    candidate = deepcopy(baseline)
    validate_pair(baseline, candidate, catalog)
    candidate["metadata"]["input_sha256"] = "different"
    with pytest.raises(ValueError, match="input_sha256"):
        validate_pair(baseline, candidate, catalog)
    candidate = deepcopy(baseline)
    candidate["metadata"]["complete"] = False
    with pytest.raises(ValueError, match="chưa hoàn tất"):
        validate_pair(baseline, candidate, catalog)


def test_field_score_excludes_labels_the_catalog_never_asks_for(bench):
    from compare_models import field_counts

    data = {"documents": [{"id": "one", "expected_type_id": "A", "fields": [
        {"label": "Name", "truth": "Nguyễn An", "pred": "nguyễn an", "in_ocr": True},
        {"label": "Date", "truth": "01/01/2026", "pred": "", "in_ocr": True},
    ]}]}
    catalog = [{"documentTypes": [{"id": "A", "fields": ["Name"]}]}]
    score = field_counts(data, catalog)
    assert score["n"] == score["correct"] == 1
    assert score["excluded"] == ["one: Date"]


def test_exclusive_benchmark_rejects_worker_and_records_late_restart(bench, monkeypatch):
    import bench_activity

    found = [{"pid": 123, "kind": "hoso_ai"}]
    monkeypatch.setattr(bench_activity, "model_processes", lambda: list(found))
    with pytest.raises(RuntimeError, match="chưa bắt đầu benchmark"):
        with bench_activity.ModelActivity(require_idle=True):
            pytest.fail("Không được chạy inference khi worker còn sống")
    found.clear()
    with bench_activity.ModelActivity(require_idle=True) as monitor:
        assert not monitor.report()["other_model_processes_detected"]
        found.append({"pid": 456, "kind": "document_ai.vlm:app"})
        monitor.observe()
        found.clear()
        monitor.observe()
        report = monitor.report()
        assert report["other_model_processes_detected"]
        assert report["events"][0]["pid"] == 456
        assert report["events"][0]["first_seen"] <= report["events"][0]["last_seen"]


def test_converted_model_identity_uses_source_receipt(tmp_path):
    import json
    from document_ai.config import model_identity

    path = tmp_path / "Qwen3-4B-Instruct-2507-ifstruct-4bit"
    path.mkdir()
    receipt = {"repo": "ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct", "revision": "00161de525486e01ba505e6c24f39472fdfe4a23"}
    (path / "conversion-receipt.json").write_text(json.dumps(receipt))
    (path / "README.md").write_text("# Converter's generated heading\n")
    assert model_identity(path) == {"name": path.name, **receipt}


def test_activity_monitor_distinguishes_inference_from_inspection(bench):
    from bench_activity import model_process_kind

    assert model_process_kind(["/venv/bin/python", "-m", "py_compile", "ai-worker/training/bench_pipeline.py"]) is None
    assert model_process_kind(["python", "-m", "hoso_ai", "status"]) is None
    assert model_process_kind(["python", "ai-worker/training/bench_pipeline.py", "report"]) is None
    assert model_process_kind(["python", "-u", "ai-worker/training/bench_pipeline.py", "llm"]) == "bench_pipeline.py"
    assert model_process_kind(["python", "-m", "hoso_ai", "run"]) == "hoso_ai"
    assert model_process_kind(["python", "-m", "uvicorn", "document_ai.vlm:app", "--port", "1234"]) == "document_ai.vlm:app"

