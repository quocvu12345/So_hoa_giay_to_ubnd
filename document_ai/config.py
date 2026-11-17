import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AI_HOME = Path(os.environ.get("DOCUMENT_AI_HOME", "/Volumes/quocDisk/AI/paddleocr")).resolve()
MODEL_ROOT = AI_HOME / "models"
MODELS = {
    "ocr": ("PaddlePaddle/PaddleOCR-VL-1.6", "132c45f52c0a26ed5a6b2f6bd8e3985794cc27dd", "PaddleOCR-VL-1.6", "model.safetensors"),
    "layout": ("PaddlePaddle/PP-DocLayoutV3", "241f8bdfc77a7c7bee915a5057aaee58c235a8d3", "PP-DocLayoutV3", "inference.pdiparams"),
    "orientation": ("PaddlePaddle/PP-LCNet_x1_0_doc_ori", "d3b95a6dff5fe8a94f2748e12b61cb26818a0df8", "PP-LCNet_x1_0_doc_ori", "inference.pdiparams"),
    # Mô hình phân loại/trích trường mặc định (AI-14, chốt 17/11/2026): Qwen3-1.7B vì máy Mac M4 16 GB chưa đủ cho mô hình lớn hơn.
    # Có phần cứng tốt hơn thì đổi bằng HOSO_AI_CLASSIFIER_MODEL (xem classifier_name), không sửa mã.
    "classifier": ("mlx-community/Qwen3-1.7B-4bit", "3b1b1768f8f8cf8351c712464f906e86c2b8269e", "Qwen3-1.7B-4bit", "model.safetensors"),
}
# Downloaded separately for image + text evaluation; not required by the PDF pipeline.
OPTIONAL_MODELS = {
    # Bản lớn hơn đã dùng trước đây; tải bằng `python -m document_ai.download --model classifier_4b` rồi đặt HOSO_AI_CLASSIFIER_MODEL=Qwen3-4B-Instruct-2507-4bit.
    "classifier_4b": ("mlx-community/Qwen3-4B-Instruct-2507-4bit", "50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b", "Qwen3-4B-Instruct-2507-4bit", "model.safetensors"),
    "qwen_vl": ("mlx-community/Qwen3-VL-8B-Instruct-4bit", "defcdea7cc7a4b0858fea563cbbce171d328e457", "Qwen3-VL-8B-Instruct-4bit", "model.safetensors.index.json"),
}


# Mô hình phân loại/trích trường chọn bằng cấu hình (AI-13): tên thư mục trong MODEL_ROOT. Mặc định giữ bản đã dùng từ đầu.
CLASSIFIER_ENV = "HOSO_AI_CLASSIFIER_MODEL"
DEFAULT_CLASSIFIER = MODELS["classifier"][2]
# RAM ước tính khi nạp (GB), cho ModelScheduler quyết định giữ hay bỏ mô hình; số đo thật ghi ở docs/tasks/ai.md (AI-12).
CLASSIFIER_APPROX_GB = {"Qwen3-4B-Instruct-2507-4bit": 3.0, "Qwen3-1.7B-4bit": 2.0}
CLASSIFIER_GB_ENV = "HOSO_AI_CLASSIFIER_GB"
SHORTLIST_ENV = "HOSO_AI_SHORTLIST"


def classifier_name(env=None):
    """Tên thư mục mô hình phân loại đang chọn. Chỉ nhận tên đơn (không đường dẫn) để cấu hình không trỏ ra ngoài thư mục mô hình."""
    env = os.environ if env is None else env
    name = (env.get(CLASSIFIER_ENV) or DEFAULT_CLASSIFIER).strip()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", name):
        raise ValueError(f"{CLASSIFIER_ENV} chỉ nhận tên thư mục trong {MODEL_ROOT} (không có đường dẫn): {name!r}")
    return name


def shortlist_enabled(env=None):
    """AI-20: thu hẹp ứng viên bằng từ khóa trước khi hỏi mô hình. Giá trị on/off."""
    env = os.environ if env is None else env
    return (env.get(SHORTLIST_ENV) or "off").strip().lower() in ("on", "1", "true", "yes")


def classifier_path(name=None):
    return MODEL_ROOT / (name or classifier_name())


def installed_classifiers():
    """Thư mục mô hình sinh văn bản đang có sẵn (có config.json và trọng số) để báo lỗi cấu hình sai kèm gợi ý."""
    if not MODEL_ROOT.is_dir():
        return []
    return sorted(p.name for p in MODEL_ROOT.iterdir() if p.is_dir() and (p / "config.json").is_file() and any(p.glob("*.safetensors"))
                  and p.name.startswith("Qwen"))


def check_classifier(name):
    """Dừng sớm với thông báo rõ nếu thiếu mô hình, thay vì để job đầu tiên lỗi."""
    path = classifier_path(name)
    if not ((path / "config.json").is_file() and any(path.glob("*.safetensors"))):
        raise FileNotFoundError(f"Không thấy mô hình phân loại {name!r} trong {MODEL_ROOT}. Đang có: {', '.join(installed_classifiers()) or '(không có)'}.")
    return path


def classifier_approx_gb(name, env=None):
    env = os.environ if env is None else env
    if env.get(CLASSIFIER_GB_ENV):
        return float(env[CLASSIFIER_GB_ENV])
    return CLASSIFIER_APPROX_GB.get(name, 3.0)


def classifier_label(name):
    """Tên hiển thị ghi vào kết quả, lấy từ mô hình thật đang chạy chứ không ghi cố định."""
    base = name[:-len("-4bit")] if name.endswith("-4bit") else name
    return f"{base} · MLX 4-bit" if name.endswith("-4bit") else base


def model_identity(path):
    """Mã định danh mô hình để ghi vào job: repo (từ tiêu đề README do công cụ tải ghi) và phiên bản cố định (commit)."""
    path = Path(path)
    repo = next((line[2:].strip() for line in (path / "README.md").read_text(encoding="utf-8").splitlines() if line.startswith("# ")), "") \
        if (path / "README.md").is_file() else ""
    revision = ""
    for meta in sorted((path / ".cache/huggingface/download").glob("*.metadata")):
        first = meta.read_text(encoding="utf-8").splitlines()[:1]
        if first and re.fullmatch(r"[0-9a-f]{40}", first[0]):
            revision = first[0]
            break
    return {"name": path.name, "repo": repo or f"mlx-community/{path.name}", "revision": revision}


def model_version(path):
    identity = model_identity(path)
    return f"{identity['name']}@{identity['revision'][:7]}" if identity["revision"] else identity["name"]


def model_path(name):
    if name == "classifier":
        return classifier_path()      # theo cấu hình; đường dẫn đã ghim để tải về là MODEL_ROOT / MODELS["classifier"][2] (xem download.py)
    return MODEL_ROOT / {**MODELS, **OPTIONAL_MODELS}[name][2]


def local_environment():
    env = os.environ.copy()
    env.update({
        "HF_HOME": str(AI_HOME / "cache/huggingface"),
        "PADDLE_PDX_CACHE_HOME": str(AI_HOME / "cache/paddlex"),
        "PADDLE_HOME": str(AI_HOME / "cache/paddle"),
        "XDG_CACHE_HOME": str(AI_HOME / "cache"),
        "TMPDIR": str(AI_HOME / "tmp"),
        "HF_HUB_DISABLE_TELEMETRY": "1",
        "HF_HUB_OFFLINE": "1",
        "TRANSFORMERS_OFFLINE": "1",
        "PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK": "True",
        "TOKENIZERS_PARALLELISM": "false",
        "OMP_NUM_THREADS": "4",
    })
    return env


def readiness():
    missing = [name for name, spec in MODELS.items() if name != "classifier" and not (model_path(name) / spec[3]).is_file()]
    label = DEFAULT_CLASSIFIER
    try:
        label = classifier_name()
        check_classifier(label)
    except (FileNotFoundError, ValueError):
        missing.append("classifier")
    return {"ready": not missing and (AI_HOME / "venv/bin/python").is_file(),
            "missing_models": missing, "model_directory": str(MODEL_ROOT),
            "ocr_model": "PaddleOCR-VL-1.6", "layout_model": "PP-DocLayoutV3",
            "classification_model": classifier_label(label), "local_only": True}
