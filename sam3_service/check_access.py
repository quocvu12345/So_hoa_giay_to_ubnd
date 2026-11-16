"""Report official model access without exposing any credential."""
import json
from datetime import datetime, timezone

from .config import MODEL_ID, MODEL_REVISION, SAM_HOME
from .documents import atomic_json


def main():
    from huggingface_hub import HfApi, get_token, get_hf_file_metadata, hf_hub_url
    report = {"model_id": MODEL_ID, "checked_at": datetime.now(timezone.utc).isoformat(), "account": None}
    if not get_token():
        report.update(status="not_logged_in", message="Chạy ./scripts/sam3.sh login trước.")
    else:
        try:
            report["account"] = HfApi().whoami()["name"]
            metadata = get_hf_file_metadata(hf_hub_url(MODEL_ID, "model.safetensors", revision=MODEL_REVISION), token=True)
            report.update(status="granted", checkpoint_bytes=metadata.size, message="Đã có quyền. Chạy ./scripts/sam3.sh download.")
        except Exception as error:
            response = getattr(error, "response", None)
            status = getattr(response, "status_code", None)
            report.update(status="not_granted" if status in (401, 403) else "check_failed", http_status=status,
                          message="Chưa tải được model. Nếu trang facebook/sam3 báo awaiting review thì cần chờ Meta duyệt." if status in (401, 403) else "Không kiểm tra được kết nối Hugging Face; thử lại sau.")
    atomic_json(SAM_HOME / "access-status.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
