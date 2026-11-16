import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAM_HOME = Path(os.environ.get("SAM3_HOME", "/Volumes/quocDisk/AI/sam3")).resolve()
DATA = Path(os.environ.get("SAM3_DATA_DIR", str(ROOT / "data/sam3"))).resolve()
RUNTIME = Path(os.environ.get("SAM3_RUNTIME_DIR", str(DATA / "runtime"))).resolve()
MODEL_DIR = SAM_HOME / "models/facebook-sam3"
MODEL_ID = "facebook/sam3"
# Pin the reviewed official checkpoint, not a third-party mirror.
MODEL_REVISION = "3c879f39826c281e95690f02c7821c4de09afae7"
MODEL_FILES = (
    "config.json", "model.safetensors", "processor_config.json", "tokenizer.json",
    "tokenizer_config.json", "special_tokens_map.json", "vocab.json", "merges.txt",
)
MAX_UPLOAD = 40 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
MAX_PAGE_EDGE = 1600
for key, value in {
    "HF_HOME": SAM_HOME / "cache/huggingface",
    "TORCH_HOME": SAM_HOME / "cache/torch",
    "TMPDIR": SAM_HOME / "tmp",
    "PYTORCH_ENABLE_MPS_FALLBACK": "1",
    "HF_HUB_DISABLE_TELEMETRY": "1",
    "TOKENIZERS_PARALLELISM": "false",
}.items():
    os.environ.setdefault(key, str(value))


def prepare_dirs():
    for path in (DATA, RUNTIME / "uploads", RUNTIME / "previews", RUNTIME / "jobs", SAM_HOME / "tmp"):
        path.mkdir(parents=True, exist_ok=True)


def checkpoint_status():
    missing = [name for name in MODEL_FILES if not (MODEL_DIR / name).is_file()]
    return {"checkpoint_present": not missing, "missing_files": missing, "model_dir": str(MODEL_DIR)}
