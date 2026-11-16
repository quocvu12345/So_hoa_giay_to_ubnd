"""Đọc tệp từ kho theo storage_key do API .NET sinh (blobs/ab/cd/<sha256>), kiểm tra SHA-256 trước khi xử lý.

Worker chỉ đọc tệp gốc; không bao giờ sửa hay xóa trong kho.
"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

_KEY = re.compile(r"^blobs/([0-9a-f]{2})/([0-9a-f]{2})/([0-9a-f]{64})$")


class StorageError(Exception):
    pass


class LocalBlobStorage:
    def __init__(self, root: Path):
        self.root = root

    def path_for(self, storage_key: str) -> Path:
        match = _KEY.match(storage_key)
        if not match or not match.group(3).startswith(match.group(1) + match.group(2)):
            raise StorageError("Khóa tệp không hợp lệ.")
        return self.root.joinpath(*storage_key.split("/"))

    def open_verified(self, storage_key: str, sha256: str) -> Path:
        path = self.path_for(storage_key)
        if not path.is_file():
            raise StorageError("Không thấy tệp trong kho.")
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1 << 20), b""):
                digest.update(chunk)
        if digest.hexdigest() != sha256.lower():
            raise StorageError("Mã băm tệp không khớp; tệp có thể đã bị thay đổi.")
        return path
