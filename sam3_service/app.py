import json
import logging
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .config import MAX_UPLOAD, ROOT, RUNTIME, checkpoint_status, prepare_dirs
from .documents import atomic_json, document_path, get_document, inspect_document, render_page, sample_records, sha256, uploaded_records
from .inference import engine
from .compute import COMPUTE_LOCK
from . import inbox

logger = logging.getLogger("sam3")
prepare_dirs()
JOBS_LOCK = threading.Lock()
active_job = None
pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="sam3")


def now():
    return datetime.now(timezone.utc).isoformat()


@asynccontextmanager
async def lifespan(app):
    inbox.recover()
    for path in (RUNTIME / "jobs").glob("*/status.json"):
        state = json.loads(path.read_text(encoding="utf-8"))
        if state["status"] in {"queued", "running"}:
            state.update(status="failed", error="Dịch vụ đã dừng trong lúc xử lý. Hãy chạy lại.", finished_at=now())
            atomic_json(path, state)
    yield
    inbox.shutdown()
    pool.shutdown(wait=False, cancel_futures=True)


app = FastAPI(title="SAM 3 Local · Hồ sơ số", version="1.0.0", lifespan=lifespan)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"])
app.include_router(inbox.router)


@app.middleware("http")
async def local_requests(request: Request, call_next):
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        if origin and urlsplit(origin).netloc != request.headers.get("host"):
            return JSONResponse({"detail": "Chỉ nhận yêu cầu từ trang local cùng địa chỉ."}, status_code=403)
        if request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse({"detail": "Yêu cầu từ trang bên ngoài bị từ chối."}, status_code=403)
        try:
            if int(request.headers.get("content-length", "0")) > MAX_UPLOAD:
                return JSONResponse({"detail": "Tệp tối đa 40 MB."}, status_code=413)
        except ValueError:
            return JSONResponse({"detail": "Content-Length không hợp lệ."}, status_code=400)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def find_document(document_id):
    try:
        return get_document(document_id)
    except KeyError:
        raise HTTPException(404, "Không tìm thấy tài liệu.") from None


def public_document(record):
    return {key: value for key, value in record.items() if key not in {"filename", "local_path"}}


@app.get("/api/sam3/status")
def status():
    return {**engine.status(), "active_job_id": active_job, "sample_count": len(sample_records())}


@app.get("/api/sam3/documents")
def documents():
    return {"documents": [public_document(row) for row in uploaded_records() + sample_records()]}


@app.post("/api/sam3/documents", status_code=201)
@app.post("/api/inbox/documents", status_code=201)
async def upload_document(request: Request):
    document_id = "upload-" + uuid.uuid4().hex
    destination = RUNTIME / "uploads" / f"{document_id}.bin"
    # Body is the raw file, so the byte limit applies before any multipart spooling.
    try:
        total = 0
        with destination.open("xb") as output:
            async for chunk in request.stream():
                total += len(chunk)
                if total > MAX_UPLOAD:
                    raise HTTPException(413, "Tệp tối đa 40 MB.")
                output.write(chunk)
        info = inspect_document(destination)
        if request.url.path.startswith("/api/inbox/") and info["media_type"] != "application/pdf":
            raise HTTPException(400, "Danh sách scan chỉ nhận tệp PDF.")
        name = Path(unquote(request.headers.get("x-filename", "tai-lieu"))).name[:180]
        record = {
            "id": document_id, "title": name, "original_name": name, "filename": destination.name,
            "sha256": sha256(destination), "byte_size": total, **info,
            "document_form": "Chưa phân loại", "publisher": "Tệp bạn nạp trên máy này",
            "source_url": None, "retrieved_at": now(),
        }
        atomic_json(destination.with_suffix(".json"), record)
        return public_document(record)
    except BaseException as error:
        destination.unlink(missing_ok=True)
        if isinstance(error, HTTPException):
            raise
        if isinstance(error, Exception):
            raise HTTPException(400, "Không đọc được tệp. Dùng PDF không khóa hoặc ảnh PNG/JPEG/WEBP/TIFF một trang.") from None
        raise


@app.get("/api/sam3/documents/{document_id}/file")
def original_file(document_id: str):
    record = find_document(document_id)
    return FileResponse(document_path(record), media_type=record["media_type"], filename=record.get("original_name", document_id + ".pdf"), content_disposition_type="inline")


@app.get("/api/sam3/documents/{document_id}/preview")
def preview(document_id: str, page: int = Query(1, ge=1)):
    record = find_document(document_id)
    try:
        path = render_page(record, page)
    except ValueError as error:
        raise HTTPException(400, str(error)) from None
    return FileResponse(path, media_type="image/png")


class SegmentRequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9-]+$")
    page: int = Field(default=1, ge=1)
    prompt: str = Field(default="document", min_length=1, max_length=160)
    threshold: float = Field(default=0.5, ge=0.05, le=0.95, allow_inf_nan=False)

    @field_validator("prompt")
    @classmethod
    def clean_prompt(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Prompt không được để trống.")
        return value


def execute_job(job_id, record, payload):
    global active_job
    path = RUNTIME / "jobs" / job_id / "status.json"
    state = {"job_id": job_id, "status": "running", "started_at": now(), **payload.model_dump()}
    atomic_json(path, state)
    try:
        result = engine.run(job_id, record, payload.page, payload.prompt, payload.threshold)
        state.update(status="completed", result=result)
    except Exception as error:
        logger.exception("SAM 3 job failed: %s", job_id)
        message = str(error)[:1500]
        engine.last_error = message
        state.update(status="failed", error=message)
    finally:
        state["finished_at"] = now()
        try:
            atomic_json(path, state)
        finally:
            with JOBS_LOCK:
                active_job = None
            COMPUTE_LOCK.release()


@app.post("/api/sam3/jobs", status_code=202)
def segment(payload: SegmentRequest):
    global active_job
    record = find_document(payload.document_id)
    if payload.page > record["page_count"]:
        raise HTTPException(400, "Số trang nằm ngoài tài liệu.")
    if not checkpoint_status()["checkpoint_present"]:
        raise HTTPException(503, "Chưa tải trọng số SAM 3. Xin quyền model rồi chạy ./scripts/sam3.sh login và ./scripts/sam3.sh download.")
    with JOBS_LOCK:
        if active_job:
            raise HTTPException(409, "Đang xử lý một trang. Chờ hoàn tất trước khi chạy tiếp.")
        if not COMPUTE_LOCK.acquire(blocking=False):
            raise HTTPException(409, "Máy đang đọc PDF. Chờ hoàn tất trước khi chạy SAM 3.")
        try:
            job_id = uuid.uuid4().hex
            path = RUNTIME / "jobs" / job_id
            path.mkdir()
            state = {"job_id": job_id, "status": "queued", "created_at": now(), **payload.model_dump()}
            atomic_json(path / "status.json", state)
            active_job = job_id
            pool.submit(execute_job, job_id, record, payload)
        except BaseException:
            active_job = None
            COMPUTE_LOCK.release()
            raise
    return state


def job_directory(job_id):
    if len(job_id) != 32 or any(c not in "0123456789abcdef" for c in job_id):
        raise HTTPException(404, "Không tìm thấy lần chạy.")
    path = RUNTIME / "jobs" / job_id
    if not (path / "status.json").is_file():
        raise HTTPException(404, "Không tìm thấy lần chạy.")
    return path


@app.get("/api/sam3/jobs/{job_id}")
def job_status(job_id: str):
    return json.loads((job_directory(job_id) / "status.json").read_text(encoding="utf-8"))


@app.get("/api/sam3/jobs/{job_id}/artifacts/{filename}")
def artifact(job_id: str, filename: str):
    import re
    if filename not in {"overlay.jpg", "result.json"} and not re.fullmatch(r"mask-[1-9][0-9]?\.png", filename):
        raise HTTPException(404, "Không tìm thấy kết quả.")
    path = job_directory(job_id) / filename
    if not path.is_file():
        raise HTTPException(404, "Kết quả chưa có.")
    return FileResponse(path, filename=filename if filename == "result.json" else None)


@app.get("/")
def home():
    return RedirectResponse("/scan-inbox.html")


@app.get("/{page_name}.html")
def project_page(page_name: str):
    if page_name not in {"index", "quan-ly-ho-so", "nghiep-vu-vai-tro", "sam3-lab", "scan-inbox"}:
        raise HTTPException(404)
    return FileResponse(ROOT / f"{page_name}.html")


app.mount("/assets", StaticFiles(directory=ROOT / "assets"), name="assets")

# Public source documents and the offline inventory, separate from OCR samples.
if (ROOT / "data/official-forms/index.html").is_file():
    app.mount("/official-forms", StaticFiles(directory=ROOT / "data/official-forms", html=True), name="official-forms")

if (ROOT / "data/form-test-data/index.html").is_file():
    app.mount("/form-test-data", StaticFiles(directory=ROOT / "data/form-test-data", html=True), name="form-test-data")

if (ROOT / "data/vietnamese-form-dataset").is_dir():
    app.mount("/vietnamese-form-dataset", StaticFiles(directory=ROOT / "data/vietnamese-form-dataset", html=True), name="vietnamese-form-dataset")

if (ROOT / "data/tuliem-dossiers").is_dir():
    app.mount("/tuliem-dossiers", StaticFiles(directory=ROOT / "data/tuliem-dossiers", html=True), name="tuliem-dossiers")

if (ROOT / "data/tuliem-dossiers-full").is_dir():
    app.mount("/tuliem-dossiers-full", StaticFiles(directory=ROOT / "data/tuliem-dossiers-full", html=True), name="tuliem-dossiers-full")
