from __future__ import annotations

from pathlib import Path

import pytest

from hoso_ai.contracts import Job, PageInfo
from hoso_ai.queue.memory import InMemoryRepository
from hoso_ai.queue.repository import Catalog, DocumentTypeDef, FieldDef
from hoso_ai.settings import Settings

LONG_TEXT = "ỦY BAN NHÂN DÂN PHƯỜNG TỪ LIÊM. Kế hoạch thực hiện nhiệm vụ năm 2026 theo chỉ đạo của cấp trên. " * 2


class FakeReader:
    """PDF giả: trang 1 có lớp chữ sạch, trang 2 chứa ảnh, trang 3 chữ quá ngắn."""

    def __init__(self, pages: list[PageInfo] | None = None):
        self.pages = pages or [
            PageInfo(1, LONG_TEXT, has_images=False),
            PageInfo(2, LONG_TEXT, has_images=True),
            PageInfo(3, "Trang", has_images=False),
        ]
        self.rendered: list[int] = []

    def inspect(self, pdf: Path, max_pages: int) -> list[PageInfo]:
        return self.pages

    def render(self, pdf: Path, page_no: int, out_dir: Path) -> Path:
        from PIL import Image, ImageDraw

        out_dir.mkdir(parents=True, exist_ok=True)
        image = Image.new("RGB", (600, 800), "white")
        ImageDraw.Draw(image).rectangle((50, 50, 550, 400), fill="black")
        target = out_dir / f"page-{page_no}.png"
        image.save(target)
        self.rendered.append(page_no)
        return target


class FakeStorage:
    def __init__(self, path: Path, error: Exception | None = None):
        self.path, self.error = path, error

    def open_verified(self, storage_key: str, sha256: str) -> Path:
        if self.error:
            raise self.error
        return self.path


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings.from_env({
        "HOSO_AI_PROFILE": "fake",
        "HOSO_AI_WORK_ROOT": str(tmp_path / "work"),
        "HOSO_AI_STORAGE_ROOT": str(tmp_path / "blobs"),
        "HOSO_AI_WORKER_ID": "test-worker",
        "HOSO_AI_HEARTBEAT_SECONDS": "5",
        "HOSO_AI_MAX_ATTEMPTS": "3",
    })


@pytest.fixture
def catalog() -> Catalog:
    fields = (FieldDef("U02-D01-F1", "Số/ký hiệu", "text", True), FieldDef("U02-D01-F2", "Ngày ban hành/lập", "date", True))
    return Catalog({"U02": "Chỉ đạo, điều hành"}, {"U02-D01": DocumentTypeDef("U02-D01", "Kế hoạch", "U02", fields)})


@pytest.fixture
def repo(catalog: Catalog) -> InMemoryRepository:
    return InMemoryRepository(catalog)


def make_job(job_id: str = "job-1", **options) -> Job:
    return Job(id=job_id, file_id="file-1", document_id="doc-1", storage_key="blobs/aa/bb/" + "a" * 64,
               sha256="a" * 64, page_count=3, options=options)
