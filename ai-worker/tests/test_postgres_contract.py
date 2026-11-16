"""Hợp đồng worker Python ↔ PostgreSQL thật (docs/03 mục 8): chạy PostgresRepository và cả vòng Worker trên CSDL đã migrate.

Bỏ qua khi không có PostgreSQL. Cách chạy:
  HOSO_AI_TEST_ADMIN_URL=postgresql://hoso_admin@127.0.0.1:55432/postgres \\
  HOSO_AI_TEST_TEMPLATE=<csdl đã chạy migration 000–020> pytest tests/test_postgres_contract.py
Mỗi test tạo CSDL riêng bằng CREATE DATABASE ... TEMPLATE nên không làm bẩn mẫu.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import uuid
from pathlib import Path

import pytest

psycopg = pytest.importorskip("psycopg")
from psycopg.conninfo import make_conninfo  # noqa: E402

from hoso_ai.contracts import JobType, PageResult, Progress, Stage  # noqa: E402
from hoso_ai.engines.factory import build_engines  # noqa: E402
from hoso_ai.queue.postgres import PostgresRepository  # noqa: E402
from hoso_ai.queue.repository import JobCancelled, JobLost  # noqa: E402
from hoso_ai.runtime.scheduler import ModelScheduler  # noqa: E402
from hoso_ai.settings import Settings  # noqa: E402
from hoso_ai.storage import LocalBlobStorage  # noqa: E402
from hoso_ai.worker import Worker  # noqa: E402

ADMIN = os.environ.get("HOSO_AI_TEST_ADMIN_URL")
TEMPLATE = os.environ.get("HOSO_AI_TEST_TEMPLATE")
SAMPLE = Path(__file__).resolve().parents[2] / "database" / "samples" / "public-016.pdf"
pytestmark = pytest.mark.skipif(not (ADMIN and TEMPLATE), reason="Cần HOSO_AI_TEST_ADMIN_URL và HOSO_AI_TEST_TEMPLATE")


@pytest.fixture
def db_url():
    name = "hoso_ai_test_" + uuid.uuid4().hex[:10]
    with psycopg.connect(ADMIN, autocommit=True) as admin:
        admin.execute(f'CREATE DATABASE "{name}" TEMPLATE "{TEMPLATE}"')
    yield make_conninfo(ADMIN, dbname=name)
    with psycopg.connect(ADMIN, autocommit=True) as admin:
        admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')


@pytest.fixture
def repo(db_url):
    repository = PostgresRepository(db_url)
    yield repository
    repository.close()


def put_blob(root: Path, source: Path) -> tuple[str, str]:
    """Đặt tệp vào kho đúng bố cục API .NET: blobs/ab/cd/<sha256>."""
    data = source.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    key = f"blobs/{sha[:2]}/{sha[2:4]}/{sha}"
    target = root.joinpath(*key.split("/"))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return key, sha


def enqueue(db_url: str, root: Path, options: dict | None = None, job_type: str = "read_classify") -> dict:
    key, sha = put_blob(root, SAMPLE)
    ids = {"document": str(uuid.uuid4()), "file": str(uuid.uuid4()), "job": str(uuid.uuid4())}
    with psycopg.connect(db_url, autocommit=True) as conn:
        conn.execute("INSERT INTO hoso.documents(id, origin, title, document_form, intake_status) VALUES (%s,'internal','Thử hợp đồng','Chưa xác định','inbox')", (ids["document"],))
        conn.execute("INSERT INTO hoso.files(id, document_id, file_role, original_name, media_type, byte_size, sha256, storage_key, version_no) "
                     "VALUES (%s,%s,'scan','thu.pdf','application/pdf',%s,%s,%s,1)", (ids["file"], ids["document"], SAMPLE.stat().st_size, sha, key))
        conn.execute("INSERT INTO hoso.ocr_jobs(id, file_id, job_type, options, priority) VALUES (%s,%s,%s,%s::jsonb,3)",
                     (ids["job"], ids["file"], job_type, json.dumps(options or {"classify": True, "correlation_id": "c-123"})))
    return {**ids, "sha": sha, "key": key}


def scalar(db_url: str, sql: str, *params):
    with psycopg.connect(db_url) as conn:
        return conn.execute(sql, params).fetchone()[0]


def test_danh_muc_doc_tu_csdl_khop_38_nhom_427_loai_2624_truong(repo):
    catalog = repo.catalog()
    assert len(catalog.work_groups) == 38
    assert len(catalog.document_types) == 427
    assert sum(len(t.fields) for t in catalog.document_types.values()) == 2624
    assert catalog.document_types["U15-D07"].work_group_code == "U15"


def test_lay_viec_cap_nhat_tien_do_ghi_trang_va_ket_qua(repo, db_url, tmp_path):
    ids = enqueue(db_url, tmp_path)
    job = repo.claim("worker-a")
    assert job is not None and job.id == ids["job"]
    assert (job.file_id, job.document_id, job.storage_key, job.sha256) == (ids["file"], ids["document"], ids["key"], ids["sha"])
    assert job.job_type == JobType.READ_CLASSIFY and job.attempt == 1 and job.correlation_id == "c-123"
    assert repo.claim("worker-b") is None, "không giao một việc cho hai worker"
    assert scalar(db_url, "SELECT status FROM hoso.ocr_jobs WHERE id = %s", ids["job"]) == "running"

    repo.heartbeat(job, "worker-a", Progress(Stage.OCR, 1, 2))
    assert scalar(db_url, "SELECT processed_pages FROM hoso.ocr_jobs WHERE id = %s", ids["job"]) == 1
    assert scalar(db_url, "SELECT stage FROM hoso.ocr_jobs WHERE id = %s", ids["job"]) == "ocr"

    repo.save_page(job, PageResult(1, "ocr", "Biên bản kiểm tra hiện trạng đất", "", [{"label": "text"}], "completed", 12.5))
    repo.save_page(job, PageResult(1, "ocr", "Biên bản kiểm tra hiện trạng đất (đọc lại)", "", [], "completed", 9.0))   # ghi đè, không trùng khóa
    assert list(repo.completed_pages(job)) == [1]
    assert repo.completed_pages(job)[1].text.endswith("(đọc lại)")
    assert scalar(db_url, "SELECT count(*) FROM hoso.ocr_pages WHERE job_id = %s", ids["job"]) == 1
    # tìm không dấu trên cột sinh sẵn
    assert scalar(db_url, "SELECT count(*) FROM hoso.ocr_pages WHERE search_vector @@ plainto_tsquery('simple', hoso.f_unaccent('hien trang dat'))") == 1

    repo.save_quality(job, 1, ("blurry",))
    assert scalar(db_url, "SELECT quality_status FROM hoso.page_images WHERE file_id = %s AND page_no = 1", ids["file"]) == "suspect"
    repo.save_quality(job, 1, ())
    assert scalar(db_url, "SELECT quality_status FROM hoso.page_images WHERE file_id = %s AND page_no = 1", ids["file"]) == "ok"

    repo.complete(job, "worker-a", ("Trang 2 mờ",), True)
    assert scalar(db_url, "SELECT status FROM hoso.ocr_jobs WHERE id = %s", ids["job"]) == "completed"
    assert scalar(db_url, "SELECT warnings->>0 FROM hoso.ocr_jobs WHERE id = %s", ids["job"]) == "Trang 2 mờ"
    assert scalar(db_url, "SELECT locked_by IS NULL FROM hoso.ocr_jobs WHERE id = %s", ids["job"])


def test_huy_giua_chung_va_mat_quyen_giu_viec(repo, db_url, tmp_path):
    ids = enqueue(db_url, tmp_path)
    job = repo.claim("worker-a")
    with psycopg.connect(db_url, autocommit=True) as conn:
        conn.execute("UPDATE hoso.ocr_jobs SET status = 'cancelled' WHERE id = %s", (ids["job"],))
    with pytest.raises(JobCancelled):
        repo.heartbeat(job, "worker-a", Progress(Stage.OCR, 0, 2))
    with pytest.raises(JobLost):
        repo.heartbeat(job, "worker-khac", Progress(Stage.OCR, 0, 2))


def test_loi_thi_thu_lai_roi_het_luot_va_nha_viec_khi_tat(repo, db_url, tmp_path):
    ids = enqueue(db_url, tmp_path)
    job = repo.claim("worker-a")
    repo.fail(job, "worker-a", "Lỗi tạm", retry=True)
    assert scalar(db_url, "SELECT status FROM hoso.ocr_jobs WHERE id = %s", ids["job"]) == "queued"
    job = repo.claim("worker-a")
    assert job.attempt == 2
    repo.release(job, "worker-a")
    assert scalar(db_url, "SELECT status FROM hoso.ocr_jobs WHERE id = %s", ids["job"]) == "queued"
    job = repo.claim("worker-a")
    repo.fail(job, "worker-a", "Tệp hỏng", retry=False)
    assert scalar(db_url, "SELECT status FROM hoso.ocr_jobs WHERE id = %s", ids["job"]) == "failed"
    assert scalar(db_url, "SELECT error_message FROM hoso.ocr_jobs WHERE id = %s", ids["job"]) == "Tệp hỏng"


def test_thu_hoi_job_treo_toi_da_ba_lan(repo, db_url, tmp_path):
    ids = enqueue(db_url, tmp_path)
    for expected in ("queued", "queued", "failed"):
        job = repo.claim("worker-chet")
        assert job is not None
        with psycopg.connect(db_url, autocommit=True) as conn:
            conn.execute("UPDATE hoso.ocr_jobs SET heartbeat_at = now() - interval '10 minutes' WHERE id = %s", (ids["job"],))
            rows = conn.execute("SELECT new_status FROM hoso.requeue_stale_jobs()").fetchall()
        assert rows == [(expected,)]
    assert scalar(db_url, "SELECT status FROM hoso.ocr_jobs WHERE id = %s", ids["job"]) == "failed"
    assert scalar(db_url, "SELECT attempt FROM hoso.ocr_jobs WHERE id = %s", ids["job"]) == 3


def test_notify_job_queued_danh_thuc_worker_dang_cho(repo, db_url, tmp_path):
    import threading
    import time

    done = threading.Event()
    threading.Thread(target=lambda: (repo.wait_for_work(10), done.set()), daemon=True).start()
    time.sleep(0.5)
    started = time.time()
    enqueue(db_url, tmp_path)
    assert done.wait(5), "worker phải được đánh thức bởi NOTIFY job_queued, không phải chờ hết chu kỳ"
    assert time.time() - started < 5


def test_worker_that_doc_pdf_that_trong_kho_dung_bo_cuc_va_ghi_ket_qua_vao_csdl(db_url, tmp_path):
    root = tmp_path / "blobs"
    ids = enqueue(db_url, root)
    settings = Settings.from_env({
        "HOSO_AI_PROFILE": "fake", "HOSO_AI_STORAGE_ROOT": str(root), "HOSO_AI_WORK_ROOT": str(tmp_path / "work"),
        "HOSO_AI_DATABASE_URL": db_url, "HOSO_AI_WORKER_ID": "worker-hop-dong", "HOSO_AI_HEARTBEAT_SECONDS": "5",
    })
    repository = PostgresRepository(db_url)
    try:
        scheduler = ModelScheduler(settings.model_budget_gb)
        worker = Worker(settings, repository, build_engines(settings), LocalBlobStorage(root), scheduler)
        assert worker.run_once() is True
        assert worker.run_once() is False, "hết việc"
    finally:
        repository.close()

    assert scalar(db_url, "SELECT status FROM hoso.ocr_jobs WHERE id = %s", ids["job"]) == "completed"
    assert scalar(db_url, "SELECT count(*) FROM hoso.ocr_pages WHERE job_id = %s", ids["job"]) >= 1
    assert scalar(db_url, "SELECT count(*) FROM hoso.ai_suggestions WHERE job_id = %s AND model_key = 'fake'", ids["job"]) == 1
    assert scalar(db_url, "SELECT count(*) FROM hoso.page_images WHERE file_id = %s", ids["file"]) >= 0


def test_role_worker_khong_doc_duoc_nguoi_dung_va_phan_quyen(db_url):
    with psycopg.connect(db_url, autocommit=True) as conn:
        conn.execute("SET ROLE hoso_ai_worker")
        assert conn.execute("SELECT count(*) FROM hoso.work_groups").fetchone()[0] == 38
        for table in ("users", "user_roles", "dossiers", "audit_events", "access_events", "delegations"):
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                conn.execute(f"SELECT 1 FROM hoso.{table} LIMIT 1")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute("DELETE FROM hoso.files")
