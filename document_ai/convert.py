"""Chuyển mô hình phân loại (nguồn BF16 đã tải và xác minh) thành bản MLX 4-bit mà worker nạp, giữ tokenizer gốc.

Chạy sau `python -m document_ai.download`. Không ghi đè bản đã có; muốn chuyển lại thì xóa thư mục đích trước.
Bản 4-bit chạy độc lập với nguồn: chuyển xong có thể xóa thư mục BF16 (khoảng 7,5 GB) để lấy lại chỗ.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
import shutil
from datetime import datetime, timezone

from .config import AI_HOME, DEFAULT_CLASSIFIER, MODEL_ROOT, MODELS

SOURCE_KEY = "classifier"
TARGET = DEFAULT_CLASSIFIER


def convert_checkpoint(source_key=SOURCE_KEY, name=TARGET):
    repo, revision, directory, _ = MODELS[source_key]
    source, target = MODEL_ROOT / directory, MODEL_ROOT / name
    staged = MODEL_ROOT / (name + ".converting")
    if target.exists() or staged.exists():
        raise SystemExit(f"Không ghi đè model hoặc bản chuyển dở: {target}, {staged}")
    receipt_path = AI_HOME / "download-receipt.json"
    receipt = json.loads(receipt_path.read_text())["models"].get(source_key) if receipt_path.is_file() else None
    if not receipt or receipt["revision"] != revision:
        raise SystemExit(f"Chưa tải nguồn đúng revision; chạy: python -m document_ai.download --model {source_key}")
    for file, meta in receipt["weights"].items():
        with (source / file).open("rb") as handle:
            if hashlib.file_digest(handle, "sha256").hexdigest() != meta["sha256"]:
                raise SystemExit(f"Trọng số nguồn bị thay đổi: {file}")
    os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", TOKENIZERS_PARALLELISM="false")
    from mlx_lm.convert import convert

    convert(str(source), str(staged), quantize=True, q_bits=4, q_group_size=64,
            q_mode="affine", trust_remote_code=False)
    # Giữ nguyên tokenizer và template của checkpoint, không dựng lại từ lớp tokenizer.
    for file in ("tokenizer.json", "tokenizer_config.json", "vocab.json", "merges.txt", "chat_template.jinja", "generation_config.json", "LICENSE"):
        if (source / file).exists():
            shutil.copyfile(source / file, staged / file)
    (staged / "README.md").write_text(f"# {repo}\n\nLocal MLX 4-bit conversion of revision {revision}.\n")
    digests = {}
    for path in sorted(staged.glob("*.safetensors")):
        with path.open("rb") as handle:
            digests[path.name] = {"sha256": hashlib.file_digest(handle, "sha256").hexdigest(), "bytes": path.stat().st_size}
    if not digests:
        raise RuntimeError("Không có trọng số sau khi chuyển")
    provenance = {"repo": repo, "revision": revision, "converted_at": datetime.now(timezone.utc).isoformat(),
                  "quantization": {"bits": 4, "group_size": 64, "mode": "affine"},
                  "versions": {p: importlib.metadata.version(p) for p in ("mlx", "mlx-lm", "transformers")},
                  "source_weights": receipt["weights"], "weights": digests}
    (staged / "conversion-receipt.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2))
    staged.rename(target)
    print(f"Ready: {target}")


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    convert_checkpoint()


if __name__ == "__main__":
    main()
