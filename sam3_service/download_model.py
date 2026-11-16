"""Download only the official image checkpoint after the user has access."""
import json
from datetime import datetime, timezone

from .config import MODEL_DIR, MODEL_FILES, MODEL_ID, MODEL_REVISION, SAM_HOME
from .documents import atomic_json, sha256


def main():
    from huggingface_hub import snapshot_download
    from huggingface_hub.errors import GatedRepoError, HfHubHTTPError
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    try:
        snapshot_download(
            repo_id=MODEL_ID, revision=MODEL_REVISION, local_dir=MODEL_DIR,
            allow_patterns=[*MODEL_FILES, "LICENSE", "README.md"], max_workers=2,
        )
    except (GatedRepoError, HfHubHTTPError) as error:
        status = getattr(getattr(error, "response", None), "status_code", None)
        if status in (401, 403) or isinstance(error, GatedRepoError):
            raise SystemExit("Chưa có quyền tải facebook/sam3. Mở https://huggingface.co/facebook/sam3 để xin quyền; sau khi được duyệt, chạy ./scripts/sam3.sh login rồi chạy lại ./scripts/sam3.sh download. Không gửi token vào chat.") from None
        raise
    files = {name: {"bytes": (MODEL_DIR / name).stat().st_size, "sha256": sha256(MODEL_DIR / name)} for name in MODEL_FILES}
    receipt = {"model_id": MODEL_ID, "revision": MODEL_REVISION, "downloaded_at": datetime.now(timezone.utc).isoformat(), "files": files}
    atomic_json(MODEL_DIR / "download-receipt.json", receipt)
    print(f"Đã tải và kiểm tra trọng số tại {MODEL_DIR}. Chạy ./scripts/sam3.sh serve")


if __name__ == "__main__":
    main()
