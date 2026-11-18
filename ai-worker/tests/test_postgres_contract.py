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

from hoso_ai.contracts import JobType, PageResult, Progress, Stage, Suggestion  # noqa: E402
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
    for conn in (repository._main, repository._side):
        conn.execute("SET ROLE hoso_ai_worker")
    yield repository
    repository.close()


def put_blob(root: Path, source: Path, salt: str = "") -> tuple[str, str]:
    """Đặt tệp vào kho đúng bố cục API .NET: blobs/ab/cd/<sha256>. salt: thêm vài byte cuối để có tệp khác mã băm (mỗi tệp quét chỉ được nạp một lần)."""
    data = source.read_bytes() + salt.encode()
    sha = hashlib.sha256(data).hexdigest()
    key = f"blobs/{sha[:2]}/{sha[2:4]}/{sha}"
    target = root.joinpath(*key.split("/"))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return key, sha


def enqueue(db_url: str, root: Path, options: dict | None = None, job_type: str = "read_classify", salt: str = "") -> dict:
    key, sha = put_blob(root, SAMPLE, salt)
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
    assert job.priority == 3, "mức ưu tiên đi cùng job để chọn kiểu lời nhắc"
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

    assert scalar(db_url, "SELECT model_version FROM hoso.ocr_jobs WHERE id = %s", ids["job"]) == "unspecified"
    repo.complete(job, "worker-a", ("Trang 2 mờ",), True, "ocr=PaddleOCR-VL-1.6@132c45f classifier=Qwen3-1.7B-4bit@3b1b176")
    assert scalar(db_url, "SELECT model_version FROM hoso.ocr_jobs WHERE id = %s", ids["job"]) == "ocr=PaddleOCR-VL-1.6@132c45f classifier=Qwen3-1.7B-4bit@3b1b176"
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
    for conn in (repository._main, repository._side):
        conn.execute("SET ROLE hoso_ai_worker")
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
    # Bản giả trích được trường từ chữ OCR giả: mỗi giá trị kèm trang, vùng nguồn theo tỉ lệ trang và độ tin cậy (BE-114 đọc các cột này).
    with psycopg.connect(db_url) as conn:
        rows = conn.execute(
            "SELECT f.value, f.quote, f.source_pages, f.source_region, f.confidence, f.quote_verified FROM hoso.ai_field_suggestions f "
            "JOIN hoso.ai_suggestions s ON s.id = f.suggestion_id WHERE s.job_id = %s AND f.value <> ''", (ids["job"],)).fetchall()
    assert rows, "bản giả phải trích được ít nhất một trường"
    for value, quote, pages, region, confidence, verified in rows:
        assert verified and quote and pages == [region["page"]]
        assert all(0 <= region[k] <= 1 for k in ("x", "y", "width", "height"))
        assert 0.5 <= float(confidence) <= 0.99


def test_role_worker_khong_doc_duoc_nguoi_dung_va_phan_quyen(db_url):
    with psycopg.connect(db_url, autocommit=True) as conn:
        conn.execute("SET ROLE hoso_ai_worker")
        assert conn.execute("SELECT count(*) FROM hoso.work_groups").fetchone()[0] == 38
        for table in ("users", "user_roles", "dossiers", "audit_events", "access_events", "delegations"):
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                conn.execute(f"SELECT 1 FROM hoso.{table} LIMIT 1")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute("DELETE FROM hoso.files")


@pytest.mark.parametrize("operation", ["complete", "fail", "release", "save_page", "save_suggestion", "save_quality"])
def test_huy_job_khong_bi_worker_ghi_de(repo, db_url, tmp_path, operation):
    ids = enqueue(db_url, tmp_path)
    job = repo.claim("worker-a")
    with psycopg.connect(db_url, autocommit=True) as conn:
        conn.execute("UPDATE hoso.ocr_jobs SET status='cancelled', finished_at=now() WHERE id=%s", (job.id,))
    actions = {
        "complete": lambda: repo.complete(job, "worker-a", (), True),
        "fail": lambda: repo.fail(job, "worker-a", "lỗi", True),
        "release": lambda: repo.release(job, "worker-a"),
        "save_page": lambda: repo.save_page(job, PageResult(1, "ocr", "kết quả muộn")),
        "save_suggestion": lambda: repo.save_suggestion(job, Suggestion("fake", None, None, "", "", "", "", False, False)),
        "save_quality": lambda: repo.save_quality(job, 1, ()),
    }
    with pytest.raises(JobCancelled):
        actions[operation]()
    assert scalar(db_url, "SELECT status FROM hoso.ocr_jobs WHERE id=%s", ids["job"]) == "cancelled"
    assert scalar(db_url, "SELECT count(*) FROM hoso.ocr_pages WHERE job_id=%s", job.id) == 0
    assert scalar(db_url, "SELECT count(*) FROM hoso.ai_suggestions WHERE job_id=%s", job.id) == 0
    assert scalar(db_url, "SELECT count(*) FROM hoso.page_images WHERE file_id=%s", job.file_id) == 0


def test_worker_cu_khong_ghi_sau_khi_job_da_duoc_thu_hoi(repo, db_url, tmp_path):
    enqueue(db_url, tmp_path)
    old = repo.claim("worker-a")
    repo.release(old, "worker-a")
    current = repo.claim("worker-a")  # cùng worker ID nhưng khác lượt chạy
    for action in (
        lambda: repo.heartbeat(old, "worker-a", Progress(Stage.DONE, 1, 1)),
        lambda: repo.save_page(old, PageResult(1, "ocr", "kết quả cũ")),
        lambda: repo.complete(old, "worker-a", (), True),
    ):
        with pytest.raises(JobLost):
            action()
    repo.save_page(current, PageResult(1, "ocr", "kết quả mới"))
    assert repo.completed_pages(current)[1].text == "kết quả mới"


def test_heartbeat_truoc_khi_biet_so_trang(repo, db_url, tmp_path):
    enqueue(db_url, tmp_path)
    job = repo.claim("worker-a")
    repo.heartbeat(job, "worker-a", Progress(Stage.PREPARING, 0, 0))
    assert scalar(db_url, "SELECT page_count FROM hoso.ocr_jobs WHERE id=%s", job.id) is None


def test_loai_giay_to_chua_co_truong_van_co_trong_danh_muc(repo, db_url):
    with psycopg.connect(db_url, autocommit=True) as conn:
        conn.execute("INSERT INTO hoso.document_types(code,name,work_group_code) VALUES ('U02-TEST','Loại mới','U02')")
    assert repo.catalog().document_types["U02-TEST"].fields == ()


# ---- AI-15: khay nền và nhường chỗ (migration 032) ------------------------------------------------------------------------------

def set_priority(db_url: str, job_id: str, priority: int, raised: bool = False) -> None:
    with psycopg.connect(db_url, autocommit=True) as conn:
        conn.execute("UPDATE hoso.ocr_jobs SET priority = %s, prioritized_at = CASE WHEN %s THEN clock_timestamp() ELSE prioritized_at END WHERE id = %s",
                     (priority, raised, job_id))


def test_thu_tu_lay_viec_theo_muc_roi_luc_nang_muc_va_ngoai_khung_gio_bo_qua_khay_nen(repo, db_url, tmp_path):
    a, b, c = (enqueue(db_url, tmp_path, salt=f"\n% {n}") for n in range(3))
    for item in (a, b):
        set_priority(db_url, item["job"], 7)
    set_priority(db_url, c["job"], 3)
    set_priority(db_url, b["job"], 1, raised=True)       # b tải sau a nhưng được bấm "Trích xuất ngay"

    assert repo.claim("worker-a", exclude_priority_from=7).id == b["job"]        # mức 1 trước mức 3
    assert repo.claim("worker-a", exclude_priority_from=7).id == c["job"]
    assert repo.claim("worker-a", exclude_priority_from=7) is None, "ngoài khung giờ không lấy việc nền"
    assert repo.claim("worker-a").id == a["job"], "trong khung giờ thì lấy"


def test_nang_muc_sau_cung_dung_sau_viec_nang_truoc_du_tai_len_truoc(repo, db_url, tmp_path):
    first, second = enqueue(db_url, tmp_path, salt="\n% 1"), enqueue(db_url, tmp_path, salt="\n% 2")
    for item in (first, second):
        set_priority(db_url, item["job"], 7)
    set_priority(db_url, second["job"], 1, raised=True)
    set_priority(db_url, first["job"], 1, raised=True)     # first được nâng SAU second
    assert [repo.claim("w").id, repo.claim("w").id] == [second["job"], first["job"]]


def test_viec_nen_nhuong_cho_viec_uu_tien_giu_trang_va_khong_tinh_lan_thu(repo, db_url, tmp_path):
    background, urgent = enqueue(db_url, tmp_path, salt="\n% 1"), enqueue(db_url, tmp_path, salt="\n% 2")
    set_priority(db_url, background["job"], 7)
    set_priority(db_url, urgent["job"], 7)
    job = repo.claim("worker-a")
    assert job.id == background["job"] and job.priority == 7 and job.attempt == 1
    repo.save_page(job, PageResult(1, "ocr", "trang một", "", [], "completed", 5.0))

    assert repo.should_yield(job, "worker-a", 7) is None, "chưa có việc ưu tiên nào đang chờ"
    set_priority(db_url, urgent["job"], 1, raised=True)
    assert repo.should_yield(job, "worker-a", 7) == urgent["job"]
    assert repo.should_yield(job, "worker-khac", 7) is None, "chỉ worker đang giữ việc mới được nhường"

    set_priority(db_url, background["job"], 1, raised=True)        # chính nó cũng bị nâng: không nhường nữa
    assert repo.should_yield(job, "worker-a", 7) is None
    set_priority(db_url, background["job"], 7)

    repo.yield_job(job, "worker-a")
    row = psycopg.connect(db_url).execute("SELECT status, locked_by, attempt, preempted_count FROM hoso.ocr_jobs WHERE id = %s", (job.id,)).fetchone()
    assert row == ("queued", None, 1, 1), "về hàng đợi, attempt không lặp lại, đếm một lần nhường"
    assert list(repo.completed_pages(job)) == [1], "trang đã đọc được giữ"
    assert repo.claim("worker-a").id == urgent["job"]
    again = repo.claim("worker-a")
    assert (again.id, again.attempt, again.preempted) == (background["job"], 2, 1), "attempt không bao giờ lặp lại: bản cũ không thể nhầm với lần giữ mới"
    with pytest.raises(JobLost):
        repo.yield_job(job, "worker-a")        # bản job cũ (attempt cũ) không còn quyền


def test_vong_worker_that_nhuong_roi_chay_tiep_trang_con_thieu(db_url, tmp_path):
    from hoso_ai.engines.base import Engines
    from hoso_ai.engines.fake import FakeClassifier, FakeOcr
    from hoso_ai.engines.quality import PillowQualityChecker
    from hoso_ai.contracts import PageInfo
    sys_path = Path(__file__).parent
    import sys

    sys.path.insert(0, str(sys_path))
    from conftest import FakeReader

    storage_root = tmp_path / "blobs"
    background, urgent = enqueue(db_url, storage_root, salt="\n% 1"), enqueue(db_url, storage_root, salt="\n% 2")
    set_priority(db_url, background["job"], 7)
    set_priority(db_url, urgent["job"], 7)

    class OcrThenUrgent(FakeOcr):
        fired = False

        def read(self, image, timeout_seconds):
            result = super().read(image, timeout_seconds)
            if image.name == "page-2.png" and not self.fired:
                self.fired = True
                set_priority(db_url, urgent["job"], 1, raised=True)       # bấm "Trích xuất ngay" khi đang đọc trang 2
            return result

    settings = Settings.from_env({"HOSO_AI_PROFILE": "fake", "HOSO_AI_WORK_ROOT": str(tmp_path / "work"), "HOSO_AI_STORAGE_ROOT": str(storage_root),
                                  "HOSO_AI_WORKER_ID": "w1", "HOSO_AI_DATABASE_URL": db_url})
    repository = PostgresRepository(db_url)
    for conn in (repository._main, repository._side):
        conn.execute("SET ROLE hoso_ai_worker")
    ocr = OcrThenUrgent()
    pages = [PageInfo(n, "", has_images=True) for n in range(1, 6)]
    worker = Worker(settings, repository, Engines(FakeReader(pages), ocr, FakeClassifier(), PillowQualityChecker()), LocalBlobStorage(storage_root), ModelScheduler(6))
    try:
        assert worker.run_once()
        assert scalar(db_url, "SELECT status FROM hoso.ocr_jobs WHERE id = %s", background["job"]) == "queued"
        assert scalar(db_url, "SELECT preempted_count FROM hoso.ocr_jobs WHERE id = %s", background["job"]) == 1
        assert ocr.calls == ["page-1.png", "page-2.png"]
        assert worker.run_once()
        assert scalar(db_url, "SELECT status FROM hoso.ocr_jobs WHERE id = %s", urgent["job"]) == "completed"
        ocr.calls.clear()
        assert worker.run_once()
        assert ocr.calls == ["page-3.png", "page-4.png", "page-5.png"], "việc nền chạy tiếp, chỉ đọc các trang chưa đọc"
        assert scalar(db_url, "SELECT status FROM hoso.ocr_jobs WHERE id = %s", background["job"]) == "completed"
        assert scalar(db_url, "SELECT attempt - preempted_count FROM hoso.ocr_jobs WHERE id = %s", background["job"]) == 1, "chỉ một lần thử thật"
    finally:
        repository.close()


def test_thu_hoi_viec_treo_khong_tinh_cac_lan_nhuong_cho_(repo, db_url, tmp_path):
    ids = enqueue(db_url, tmp_path)
    set_priority(db_url, ids["job"], 7)
    for _ in range(2):          # hai lần nhường chỗ rồi một lần chạy thật bị treo: tổng attempt 3 nhưng chỉ 1 lần thử thật
        job = repo.claim("w")
        repo.yield_job(job, "w")
    repo.claim("w")
    with psycopg.connect(db_url, autocommit=True) as conn:
        conn.execute("UPDATE hoso.ocr_jobs SET heartbeat_at = now() - interval '10 minutes' WHERE id = %s", (ids["job"],))
        assert conn.execute("SELECT attempt, preempted_count FROM hoso.ocr_jobs WHERE id = %s", (ids["job"],)).fetchone() == (3, 2)
        assert [r[0] for r in conn.execute("SELECT new_status FROM hoso.requeue_stale_jobs()").fetchall()] == ["queued"], "chưa quá 3 lần thử thật"
        conn.execute("UPDATE hoso.ocr_jobs SET attempt = 5, status = 'running', locked_by = 'w', heartbeat_at = now() - interval '10 minutes' WHERE id = %s", (ids["job"],))
        assert [r[0] for r in conn.execute("SELECT new_status FROM hoso.requeue_stale_jobs()").fetchall()] == ["failed"], "5 - 2 = 3 lần thử thật thì thất bại"
