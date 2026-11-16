import io
import json

from PIL import Image

from document_ai.classify import catalog, classification_context, evidence_fields, type_candidates
from sam3_service.config import ROOT, RUNTIME
from sam3_service import inbox
from sam3_service.compute import COMPUTE_LOCK


def upload_pdf(client):
    source = (ROOT / "data/sam3/documents/badinh-001.pdf").read_bytes()
    response = client.post("/api/inbox/documents", content=source, headers={"x-filename": "test.pdf"})
    assert response.status_code == 201
    return response.json()


def test_pdf_inbox_rejects_disguised_image_and_preserves_original(client):
    image = io.BytesIO()
    Image.new("RGB", (30, 30), "white").save(image, "PNG")
    before = set((RUNTIME / "uploads").iterdir())
    assert client.post("/api/inbox/documents", content=image.getvalue(), headers={"x-filename": "fake.pdf"}).status_code == 400
    assert set((RUNTIME / "uploads").iterdir()) == before
    doc = upload_pdf(client)
    response = client.get(f'/api/sam3/documents/{doc["id"]}/file')
    assert response.content == (ROOT / "data/sam3/documents/badinh-001.pdf").read_bytes()
    assert response.headers["content-disposition"].startswith("inline")
    assert all(r["media_type"] == "application/pdf" for r in client.get("/api/inbox/documents").json()["documents"])


def test_deletion_is_reversible_and_blocks_extraction(client):
    doc = upload_pdf(client)
    endpoint = f'/api/inbox/documents/{doc["id"]}'
    assert client.delete(endpoint).status_code == 200
    assert not any(r["id"] == doc["id"] for r in client.get("/api/inbox/documents").json()["documents"])
    assert client.post(endpoint + "/extract").status_code == 410
    assert client.post(endpoint + "/restore").status_code == 200
    assert any(r["id"] == doc["id"] for r in client.get("/api/inbox/documents").json()["documents"])


def filing_payload():
    invitation = next(t for c in catalog() for t in c["documentTypes"] if t["id"] == "U01-D06")
    return {"category_code": "U21", "type_id": "U01-D06", "title": "Giấy mời làm việc về giáo dục",
            "new_case_title": "Hồ sơ giáo dục", "role": "clerk", "reviewed": False,
            "fields": [{"label": label, "value": "Sửa từ bản gốc" if i == 0 else ""} for i, label in enumerate(invitation["fields"])]}


def test_filing_separates_document_form_from_case_topic_and_retries_once(client):
    doc = upload_pdf(client)
    url = f'/api/inbox/documents/{doc["id"]}/file'
    payload = filing_payload()
    response = client.post(url, json=payload)
    assert response.status_code == 201
    receipt = response.json()
    assert receipt["case"]["categoryCode"] == "U21"
    assert receipt["document"]["typeId"] == "U01-D06"
    assert receipt["document"]["fields"][0]["value"] == "Sửa từ bản gốc"
    assert receipt["document"]["sourceSha256"] == doc["sha256"]
    assert receipt["document"]["reviewed"] is False
    assert client.post(url, json=payload).json() == receipt
    placements = client.get("/api/inbox/placements").json()["placements"]
    assert sum(p["document_id"] == doc["id"] for p in placements) == 1
    # Filing receipt persists to disk, independently of browser localStorage.
    assert json.loads((RUNTIME / "inbox.json").read_text())["documents"][doc["id"]]["placement"] == receipt
    assert client.delete(f'/api/inbox/documents/{doc["id"]}').status_code == 409


def test_filing_validates_type_fields_scope_and_destination(client):
    doc = upload_pdf(client)
    url = f'/api/inbox/documents/{doc["id"]}/file'
    payload = filing_payload()
    assert client.post(url, json={**payload, "type_id": "invented"}).status_code == 422
    assert client.post(url, json={**payload, "fields": []}).status_code == 422
    assert client.post(url, json={**payload, "fields": payload["fields"] + [payload["fields"][0]]}).status_code == 422
    assert client.post(url, json={**payload, "role": "employee", "department": "ht"}).status_code == 403
    target = {"id": "example-case", "code": "EX-01", "title": "Có sẵn", "categoryCode": "U21", "year": 2026, "workflow": "archived"}
    assert client.post(url, json={**payload, "target_case": target}).status_code == 422
    target["workflow"] = "draft"
    response = client.post(url, json={**payload, "target_case": target})
    assert response.status_code == 201
    assert response.json()["case"]["id"] == "example-case"


def test_extraction_checks_readiness_and_shared_compute_lock(client, monkeypatch):
    doc = upload_pdf(client)
    url = f'/api/inbox/documents/{doc["id"]}/extract'
    monkeypatch.setattr(inbox, "readiness", lambda: {"ready": False})
    assert client.post(url).status_code == 503
    monkeypatch.setattr(inbox, "readiness", lambda: {"ready": True})
    with COMPUTE_LOCK:
        assert client.post(url).status_code == 409
    assert client.get("/api/inbox/jobs/../secret").status_code == 404


def test_generated_values_require_source_evidence():
    fields = evidence_fields([
        {"label": "Người ký", "value": "Nguyễn Văn A", "quote": "Chủ tịch"},
        {"label": "Ngày ban hành/lập", "value": "12/8/2025", "quote": "ngày 12/8/2025"},
    ], "Chủ tịch. Giấy mời ngày 12/8/2025.", ["Người ký", "Ngày ban hành/lập"])
    assert fields[0]["value"] == ""
    assert fields[1]["value"] == "12/8/2025"
    assert all(f["uncertain"] for f in fields)
    incomplete = evidence_fields([
        {"label": "Số/ký hiệu nếu có", "value": "/GM-UBND Ba Dinh", "quote": "Số: /GM-UBND Ba Dinh"},
        {"label": "Người ký", "value": "THỦ TƯỚNG CHÍNH PHỦ", "quote": "THỦ TƯỚNG CHÍNH PHỦ"},
    ], "Số: /GM-UBND Ba Dinh\nTHỦ TƯỚNG CHÍNH PHỦ", ["Số/ký hiệu nếu có", "Người ký"])
    assert all(not f["value"] for f in incomplete)
    invitation = "ỦY BAN NHÂN DÂN\nBa Dinh, ngày tháng 8 năm 2025\nGIẤY MỜI\nThời gian: Vào lúc 15 giờ, ngày 12/8/2025."
    event_date = evidence_fields([{"label": "Ngày ban hành/lập", "value": "12/8/2025", "quote": "ngày 12/8/2025"}], invitation, ["Ngày ban hành/lập"])
    assert event_date[0]["value"] == ""


def test_invitation_cannot_become_inspection_minutes():
    categories = catalog()
    education = next(c for c in categories if c["code"] == "U21")
    candidates = type_candidates(categories, education, "Giấy mời")
    assert any(t["id"] == "U01-D06" for t in candidates)
    assert all("Giấy mời" in t["name"] for t in candidates)
    assert not any(t["id"] == "U21-D05" for t in candidates)


def test_citizen_form_blank_slots_are_not_personal_data():
    text = "Hôm nay, ngày.....tháng.....năm.....\nDiện tích: 120,5 m²\nSố giấy tờ: …………\nGiá: 850.000.000 đồng"
    labels = ["Ngày lập hợp đồng", "Diện tích đất", "Giấy tờ định danh", "Giá chuyển nhượng"]
    values = ["ngày.....tháng.....năm.....", "120,5 m²", "…………", "850.000.000 đồng"]
    fields = evidence_fields([{"label": label, "value": value, "quote": value}
                              for label, value in zip(labels, values)], text, labels)
    assert [f["value"] for f in fields] == ["", "120,5 m²", "", "850.000.000 đồng"]


def test_long_pdf_classification_reports_excerpts_from_all_pages():
    pages = [{"page": i, "text": f"START-{i} " + "word " * 2000 + f" END-{i}"} for i in range(1, 8)]
    text, excerpted = classification_context(pages)
    assert excerpted
    for i in range(1, 8):
        assert f"[Trang {i}]" in text and f"END-{i}" in text
    assert all(len(p["text"]) > 10000 for p in pages)


def test_inbox_route_is_default(client):
    assert client.get("/", follow_redirects=False).headers["location"] == "/scan-inbox.html"
    assert client.get("/scan-inbox.html").status_code == 200
