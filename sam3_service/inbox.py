import json
import os
import signal
import subprocess
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from document_ai.classify import catalog
from document_ai.config import AI_HOME, local_environment, readiness
from .compute import COMPUTE_LOCK
from .config import ROOT, RUNTIME
from .documents import atomic_json, document_path, get_document, sample_records, uploaded_records

router = APIRouter(prefix="/api/inbox")
LOCK = threading.RLock()
POOL = ThreadPoolExecutor(max_workers=1, thread_name_prefix="document-ai")
PROCESS = None
ACTIVE = None


def now():
    return datetime.now(timezone.utc).isoformat()


def store_path():
    return RUNTIME / "inbox.json"


def read_store():
    path = store_path()
    return json.loads(path.read_text()) if path.is_file() else {"documents": {}}


def metadata(document_id):
    return read_store()["documents"].get(document_id, {})


def pdf_record(document_id, include_deleted=False):
    try:
        record = get_document(document_id)
    except KeyError:
        raise HTTPException(404, "Không tìm thấy PDF.") from None
    if record["media_type"] != "application/pdf":
        raise HTTPException(400, "Danh sách scan chỉ nhận PDF.")
    with LOCK:
        if metadata(document_id).get("deleted_at") and not include_deleted:
            raise HTTPException(410, "PDF đã được xóa khỏi danh sách.")
    return record


def recover():
    (RUNTIME / "extractions").mkdir(parents=True, exist_ok=True)
    for path in (RUNTIME / "extractions").glob("*/status.json"):
        state = json.loads(path.read_text())
        if state["status"] in {"queued", "running"}:
            state.update(status="failed", error="Dịch vụ đã dừng. Bấm lấy dữ liệu để thử lại.", finished_at=now())
            atomic_json(path, state)


def shutdown():
    if PROCESS and PROCESS.poll() is None:
        os.killpg(PROCESS.pid, signal.SIGTERM)
    POOL.shutdown(wait=False, cancel_futures=True)


@router.get("/status")
def ai_status():
    return {**readiness(), "active_job_id": ACTIVE, "busy": COMPUTE_LOCK.locked()}


@router.get("/sample-catalog.csv")
def sample_catalog_csv():
    path = ROOT / "data/filled-samples/inventory.csv"
    if not path.is_file():
        raise HTTPException(404, "Chưa tạo bộ mẫu điền sẵn.")
    return FileResponse(path, media_type="text/csv; charset=utf-8", filename="danh-muc-giay-to-gia-lap.csv")


@router.get("/documents")
def list_documents():
    with LOCK:
        states = read_store()["documents"]
    result = []
    for row in uploaded_records() + sample_records():
        meta = states.get(row["id"], {})
        if row["media_type"] != "application/pdf" or meta.get("deleted_at"):
            continue
        result.append({**{k: v for k, v in row.items() if k not in {"filename", "local_path"}},
                       "extraction_job_id": meta.get("extraction_job_id"),
                       "filed_case": meta.get("placement", {}).get("case", {}).get("title"),
                       "filed_case_id": meta.get("placement", {}).get("case", {}).get("id")})
    return {"documents": result}


@router.delete("/documents/{document_id}")
def delete_document(document_id: str):
    pdf_record(document_id)
    with LOCK:
        data = read_store()
        meta = data["documents"].setdefault(document_id, {})
        if meta.get("placement"):
            raise HTTPException(409, "PDF đã nằm trong hồ sơ. Quản lý giấy tờ từ hồ sơ đó.")
        if ACTIVE and meta.get("extraction_job_id") == ACTIVE:
            raise HTTPException(409, "Chờ lấy dữ liệu hoàn tất rồi xóa PDF.")
        meta["deleted_at"] = now()
        atomic_json(store_path(), data)
    return {"deleted": True, "document_id": document_id, "can_restore": True}


@router.post("/documents/{document_id}/restore")
def restore_document(document_id: str):
    pdf_record(document_id, include_deleted=True)
    with LOCK:
        data = read_store()
        data["documents"].setdefault(document_id, {}).pop("deleted_at", None)
        atomic_json(store_path(), data)
    return {"restored": True}


def job_dir(job_id):
    if len(job_id) != 32 or any(c not in "0123456789abcdef" for c in job_id):
        raise HTTPException(404, "Không tìm thấy lần đọc PDF.")
    path = RUNTIME / "extractions" / job_id
    if not (path / "status.json").is_file():
        raise HTTPException(404, "Không tìm thấy lần đọc PDF.")
    return path


def execute(job_id, record):
    global ACTIVE, PROCESS
    path = job_dir(job_id)
    state = json.loads((path / "status.json").read_text())
    state.update(status="running", started_at=now())
    atomic_json(path / "status.json", state)
    try:
        from .inference import engine
        engine.unload()
        with (path / "worker.log").open("w") as log:
            PROCESS = subprocess.Popen(
                [str(AI_HOME / "venv/bin/python"), "-m", "document_ai.worker", str(document_path(record)), "--output", str(path)],
                cwd=ROOT, env=local_environment(), stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            try:
                code = PROCESS.wait(timeout=max(600, record["page_count"] * 300))
            except subprocess.TimeoutExpired:
                os.killpg(PROCESS.pid, signal.SIGTERM)
                PROCESS.wait(timeout=15)
                raise RuntimeError("Quá thời gian đọc PDF. Kết quả từng trang đã đọc được vẫn được giữ.") from None
            if code != 0 or not (path / "result.json").is_file():
                raise RuntimeError("Chưa đọc được PDF. Xem worker.log trong thư mục kết quả hoặc thử lại.")
        result = json.loads((path / "result.json").read_text())
        result.update(document_id=record["id"], source_sha256=record["sha256"], job_id=job_id)
        atomic_json(path / "result.json", result)
        state.update(status="completed", all_pages_read=result["all_pages_read"])
    except Exception as error:
        state.update(status="failed", error=str(error)[:1500])
    finally:
        state["finished_at"] = now()
        try:
            atomic_json(path / "status.json", state)
        finally:
            with LOCK:
                PROCESS = None
                ACTIVE = None
            COMPUTE_LOCK.release()


@router.post("/documents/{document_id}/extract", status_code=202)
def extract(document_id: str, retry: bool = False):
    global ACTIVE
    record = pdf_record(document_id)
    with LOCK:
        meta = metadata(document_id)
        previous = meta.get("extraction_job_id")
        if previous:
            state = json.loads((job_dir(previous) / "status.json").read_text())
            if state["status"] in {"queued", "running"} or (state["status"] == "completed" and not retry):
                return state
        if not readiness()["ready"]:
            raise HTTPException(503, "Chưa có đủ model local. Chạy ./scripts/setup-document-ai.sh.")
        if not COMPUTE_LOCK.acquire(blocking=False):
            raise HTTPException(409, "Máy đang chạy AI. Chờ lần đọc hiện tại hoàn tất rồi thử lại.")
        try:
            job_id = uuid.uuid4().hex
            path = RUNTIME / "extractions" / job_id
            path.mkdir(parents=True)
            state = {"job_id": job_id, "document_id": document_id, "status": "queued", "created_at": now(), "page_count": record["page_count"]}
            atomic_json(path / "status.json", state)
            data = read_store()
            data["documents"].setdefault(document_id, {})["extraction_job_id"] = job_id
            atomic_json(store_path(), data)
            ACTIVE = job_id
            POOL.submit(execute, job_id, record)
        except BaseException:
            ACTIVE = None
            COMPUTE_LOCK.release()
            raise
    return state


@router.get("/jobs/{job_id}")
def extraction_status(job_id: str):
    path = job_dir(job_id)
    state = json.loads((path / "status.json").read_text())
    if (path / "progress.json").is_file():
        state["progress"] = json.loads((path / "progress.json").read_text())
    if state["status"] == "completed":
        state["result"] = json.loads((path / "result.json").read_text())
    return state


@router.get("/jobs/{job_id}/text")
def full_text(job_id: str):
    path = job_dir(job_id) / "full-text.txt"
    if not path.is_file():
        raise HTTPException(404, "Chưa có nội dung.")
    return FileResponse(path, media_type="text/plain; charset=utf-8", filename="noi-dung-pdf.txt")


@router.get("/placements")
def placements():
    with LOCK:
        return {"placements": [meta["placement"] for meta in read_store()["documents"].values() if meta.get("placement")]}


class FieldValue(BaseModel):
    label: str = Field(min_length=1, max_length=250)
    value: str = Field(max_length=2000)


class TargetCase(BaseModel):
    id: str = Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9-]+$")
    code: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=180)
    categoryCode: str
    year: int = Field(ge=1900, le=2100)
    workflow: Literal["draft", "returned"] = "draft"
    assignee: Literal["cv-01", "cv-02"] = "cv-01"
    location: str = Field(default="", max_length=100)
    notes: str = Field(default="", max_length=1000)


class FilingRequest(BaseModel):
    category_code: str
    type_id: str
    fields: list[FieldValue] = Field(max_length=80)
    title: str = Field(min_length=1, max_length=180)
    direction: Literal["Nội bộ", "Đến", "Đi"] = "Đến"
    target_case: TargetCase | None = None
    new_case_title: str = Field(default="", max_length=180)
    reviewed: bool = False
    assignee: Literal["cv-01", "cv-02"] = "cv-01"
    role: Literal["employee", "clerk"]
    department: str = Field(default="", max_length=20)


@router.post("/documents/{document_id}/file", status_code=201)
def file_document(document_id: str, payload: FilingRequest):
    record = pdf_record(document_id)
    category = next((c for c in catalog() if c["code"] == payload.category_code), None)
    doc_type = next((t for c in catalog() for t in c["documentTypes"] if t["id"] == payload.type_id), None)
    if not category or not doc_type:
        raise HTTPException(422, "Chọn nhóm hồ sơ và loại giấy tờ trong danh mục.")
    if payload.role == "employee" and category["owner"] != payload.department:
        raise HTTPException(403, "Chọn hồ sơ thuộc phòng/Ban của vai trò hiện tại.")
    if payload.target_case and (payload.target_case.categoryCode != category["code"] or
            (payload.role == "employee" and payload.target_case.assignee != payload.assignee)):
        raise HTTPException(422, "Hồ sơ đích không phù hợp với nhóm hoặc chuyên viên hiện tại.")
    if len({f.label for f in payload.fields}) != len(payload.fields) or set(f.label for f in payload.fields) != set(doc_type["fields"]):
        raise HTTPException(422, "Các trường không khớp loại giấy tờ đã chọn.")
    if not payload.title.strip() or (not payload.target_case and not payload.new_case_title.strip()):
        raise HTTPException(422, "Nhập tên giấy tờ và tên hồ sơ đích.")
    with LOCK:
        data = read_store()
        meta = data["documents"].setdefault(document_id, {})
        if meta.get("placement"):
            return meta["placement"]  # Retry after a lost response never duplicates a PDF.
        stamp = now()
        case = payload.target_case.model_dump() if payload.target_case else {
            "id": "scan-" + uuid.uuid4().hex, "code": "SCAN-" + datetime.now().strftime("%Y") + "-" + uuid.uuid4().hex[:8].upper(),
            "title": payload.new_case_title.strip(), "categoryCode": category["code"], "year": datetime.now().year,
            "workflow": "draft", "assignee": payload.assignee, "location": "", "notes": ""}
        case.update(status="review", updatedAt=stamp, dueDate="", documents=[], history=[])
        # Source references come from the saved extraction, never from browser input.
        extracted = {}
        extraction_id = meta.get("extraction_job_id")
        if extraction_id:
            result_path = job_dir(extraction_id) / "result.json"
            if result_path.is_file():
                original = json.loads(result_path.read_text())
                extracted = {f["label"]: f for f in (original.get("suggestion") or {}).get("fields", [])}
        fields = []
        for f in payload.fields:
            source = extracted.get(f.label, {})
            value = f.value.strip()
            fields.append({"label": f.label, "value": value, "uncertain": not payload.reviewed,
                           "quote": source.get("quote", ""), "source_pages": source.get("source_pages", []),
                           "extracted_value": source.get("value", ""), "edited": value != source.get("value", "")})
        doc = {"id": "pdf-" + document_id, "name": payload.title.strip(), "typeId": doc_type["id"],
               "direction": payload.direction, "sample": False, "reviewed": payload.reviewed,
               "fileName": record.get("original_name", record["id"] + ".pdf"), "fileType": "application/pdf",
               "sourceDocumentId": document_id, "sourceSha256": record["sha256"],
               "extractionJobId": meta.get("extraction_job_id"), "pageCount": record["page_count"],
               "sourceValues": [f["value"] for f in fields], "fields": fields}
        placement = {"document_id": document_id, "case": case, "document": doc, "filed_at": stamp}
        meta["placement"] = placement
        atomic_json(store_path(), data)
    return placement
