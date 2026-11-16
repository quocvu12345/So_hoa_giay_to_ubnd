import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AI_HOME = Path(os.environ.get("DOCUMENT_AI_HOME", "/Volumes/quocDisk/AI/paddleocr")).resolve()
MODEL_ROOT = AI_HOME / "models"
MODELS = {
    "ocr": ("PaddlePaddle/PaddleOCR-VL-1.6", "132c45f52c0a26ed5a6b2f6bd8e3985794cc27dd", "PaddleOCR-VL-1.6", "model.safetensors"),
    "layout": ("PaddlePaddle/PP-DocLayoutV3", "241f8bdfc77a7c7bee915a5057aaee58c235a8d3", "PP-DocLayoutV3", "inference.pdiparams"),
    "orientation": ("PaddlePaddle/PP-LCNet_x1_0_doc_ori", "d3b95a6dff5fe8a94f2748e12b61cb26818a0df8", "PP-LCNet_x1_0_doc_ori", "inference.pdiparams"),
    "classifier": ("mlx-community/Qwen3-4B-Instruct-2507-4bit", "50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b", "Qwen3-4B-Instruct-2507-4bit", "model.safetensors"),
}
# Downloaded separately for image + text evaluation; not required by the PDF pipeline.
OPTIONAL_MODELS = {
    "qwen_vl": ("mlx-community/Qwen3-VL-8B-Instruct-4bit", "defcdea7cc7a4b0858fea563cbbce171d328e457", "Qwen3-VL-8B-Instruct-4bit", "model.safetensors.index.json"),
}


def model_path(name):
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
    missing = [name for name, spec in MODELS.items() if not (model_path(name) / spec[3]).is_file()]
    return {"ready": not missing and (AI_HOME / "venv/bin/python").is_file(),
            "missing_models": missing, "model_directory": str(MODEL_ROOT),
            "ocr_model": "PaddleOCR-VL-1.6", "layout_model": "PP-DocLayoutV3",
            "classification_model": "Qwen3-4B-Instruct-2507 · MLX 4-bit", "local_only": True}
