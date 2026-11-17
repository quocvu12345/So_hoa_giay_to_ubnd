"""Chuyển checkpoint Qwen text đã xác minh thành MLX 4-bit, giữ tokenizer gốc."""
import argparse
import hashlib
import importlib.metadata
import json
import os
import shutil
from datetime import datetime, timezone

from .config import AI_HOME, MODEL_ROOT, OPTIONAL_MODELS

TARGETS = {
    "ifstruct": ("ifstruct_source", "Qwen3-4B-Instruct-2507-ifstruct-4bit"),
    "bkee": ("bkee_source", "Qwen3-4B-BKEE-Entity-Extraction-4bit"),
}


def convert_checkpoint(model):
    source_key, name = TARGETS[model]
    repo, revision, directory, _ = OPTIONAL_MODELS[source_key]
    source, target = MODEL_ROOT / directory, MODEL_ROOT / name
    staged = MODEL_ROOT / (name + ".converting")
    if target.exists() or staged.exists():
        raise SystemExit(f"Không ghi đè model hoặc bản chuyển dở: {target}, {staged}")
    receipt = json.loads((AI_HOME / "download-receipt.json").read_text())["models"][source_key]
    if receipt["revision"] != revision:
        raise SystemExit(f"Nguồn chưa đúng revision; tải bằng --model {source_key}")
    for name, meta in receipt["weights"].items():
        with (source / name).open("rb") as handle:
            if hashlib.file_digest(handle, "sha256").hexdigest() != meta["sha256"]:
                raise SystemExit(f"Trọng số nguồn bị thay đổi: {name}")
    os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", TOKENIZERS_PARALLELISM="false")
    from mlx_lm.convert import convert

    convert(str(source), str(staged), quantize=True, q_bits=4, q_group_size=64,
            q_mode="affine", trust_remote_code=False)
    # Giữ nguyên tokenizer và template của checkpoint, không dựng lại từ lớp tokenizer.
    for name in ("tokenizer.json", "tokenizer_config.json", "vocab.json", "merges.txt", "chat_template.jinja", "generation_config.json", "LICENSE"):
        if (source / name).exists():
            shutil.copyfile(source / name, staged / name)
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", choices=TARGETS, required=True)
    convert_checkpoint(parser.parse_args().model)


if __name__ == "__main__":
    main()
