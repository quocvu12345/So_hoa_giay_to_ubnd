import io
import json
import os
import tempfile
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from sam3_service import app as service
from sam3_service.documents import inspect_document, render_page, sample_records, sha256
from sam3_service.config import ROOT, RUNTIME
from sam3_service.inference import clipped_box


def png_bytes():
    output = io.BytesIO()
    Image.new("RGB", (120, 80), "white").save(output, format="PNG")
    return output.getvalue()


def upload(client, name="test.png"):
    response = client.post("/api/sam3/documents", content=png_bytes(), headers={"x-filename": name})
    assert response.status_code == 201
    return response.json()


def test_sample_provenance_hash_and_real_pdf_preview(client):
    records = sample_records()
    assert len(records) >= 19
    for record in records:
        path = ROOT / record["local_path"]
        assert sha256(path) == record["sha256"]
        assert inspect_document(path)["page_count"] == record["page_count"]
    pdf = next(r for r in records if r["id"] == "public-002")
    response = client.get(f'/api/sam3/documents/{pdf["id"]}/preview?page=2')
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    with Image.open(io.BytesIO(response.content)) as image:
        assert max(image.size) <= 1600
        assert min(image.size) > 100
    assert client.get(f'/api/sam3/documents/{pdf["id"]}/preview?page=99999').status_code == 400


def test_upload_preview_and_safe_filename(client):
    doc = upload(client, "../../outside.png")
    assert doc["original_name"] == "outside.png"
    assert doc["page_count"] == 1
    assert doc["sha256"]
    assert "filename" not in doc
    assert client.get(f'/api/sam3/documents/{doc["id"]}/preview').status_code == 200
    original = client.get(f'/api/sam3/documents/{doc["id"]}/file')
    assert original.content == png_bytes()
    assert not (RUNTIME.parent / "outside.png").exists()


def test_reject_bad_or_oversized_upload_without_leaving_file(client, monkeypatch):
    before = list((RUNTIME / "uploads").glob("*"))
    assert client.post("/api/sam3/documents", content=b"<html>not a document</html>").status_code == 400
    assert list((RUNTIME / "uploads").glob("*")) == before
    monkeypatch.setattr(service, "MAX_UPLOAD", 8)
    assert client.post("/api/sam3/documents", content=b"0123456789").status_code == 413
    assert list((RUNTIME / "uploads").glob("*")) == before


def test_invalid_page_prompt_and_missing_checkpoint(client, monkeypatch):
    doc = upload(client)
    payload = {"document_id": doc["id"], "prompt": "stamp"}
    monkeypatch.setattr(service, "checkpoint_status", lambda: {"checkpoint_present": False})
    assert client.post("/api/sam3/jobs", json=payload).status_code == 503
    assert client.post("/api/sam3/jobs", json={**payload, "page": 2}).status_code == 400
    assert client.post("/api/sam3/jobs", json={**payload, "prompt": "   "}).status_code == 422
    assert client.post("/api/sam3/jobs", json={**payload, "threshold": 2}).status_code == 422
    assert client.post("/api/sam3/jobs", json={**payload, "document_id": "../secret"}).status_code == 422


def test_cross_site_upload_and_unknown_paths_rejected(client):
    assert client.post("/api/sam3/documents", content=png_bytes(), headers={"Origin": "https://example.com"}).status_code == 403
    assert client.get("/api/sam3/documents/upload-invalid/file").status_code == 404
    assert client.get("/api/sam3/jobs/not-a-job").status_code == 404
    assert client.get("/sam3_service/config.py").status_code == 404


def test_failed_inference_is_visible_and_releases_worker(client, monkeypatch):
    import threading
    entered, release = threading.Event(), threading.Event()
    def fail(*args):
        entered.set()
        assert release.wait(5)
        raise RuntimeError("Test-only model load failure")
    monkeypatch.setattr(service, "checkpoint_status", lambda: {"checkpoint_present": True})
    monkeypatch.setattr(service.engine, "run", fail)
    doc = upload(client)
    payload = {"document_id": doc["id"], "prompt": "stamp"}
    response = client.post("/api/sam3/jobs", json=payload)
    assert response.status_code == 202
    assert entered.wait(5)
    assert client.post("/api/sam3/jobs", json=payload).status_code == 409
    release.set()
    job_id = response.json()["job_id"]
    for _ in range(100):
        state = client.get(f"/api/sam3/jobs/{job_id}").json()
        if state["status"] == "failed":
            break
        time.sleep(0.02)
    assert state["status"] == "failed"
    assert "Test-only" in state["error"]
    assert "result" not in state
    assert service.active_job is None
    assert client.get(f"/api/sam3/jobs/{job_id}/artifacts/overlay.jpg").status_code == 404


def test_project_routes_and_status(client):
    for page in ("sam3-lab", "index", "quan-ly-ho-so", "nghiep-vu-vai-tro"):
        assert client.get(f"/{page}.html").status_code == 200
    state = client.get("/api/sam3/status").json()
    assert state["sample_count"] >= 19
    assert state["model_id"] == "facebook/sam3"
    assert state["engine"] == "transformers.Sam3Model"


def test_stamp_at_page_edge_does_not_export_out_of_bounds_coordinates():
    # Actual first inference extended the right-edge stamp 2.56 px past the page.
    box = clipped_box([1071.85, 606.50, 1162.56, 795.97], 1160, 1600)
    assert box == [1071.85, 606.50, 1160, 795.97]
    assert clipped_box([-4, -7, 100, 80], 120, 80) == [0, 0, 100, 80]
