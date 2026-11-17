"""Chuyển checkpoint NuExtract đã xác minh sang MLX 4-bit, giữ cả vision tower và template gốc."""
import hashlib
import importlib.metadata
import json
import os
import shutil
from datetime import datetime, timezone

from .config import AI_HOME, MODEL_ROOT, OPTIONAL_MODELS, local_environment

NAME = "NuExtract3-kie-vi-4bit"


def main():
    repo, revision, directory, _ = OPTIONAL_MODELS["nuextract_source"]
    source = MODEL_ROOT / directory
    target = MODEL_ROOT / NAME
    staged = MODEL_ROOT / (NAME + ".converting")
    if target.exists() or staged.exists():
        raise SystemExit(f"Không ghi đè model đã có hoặc bản chuyển dở: {target}, {staged}")
    receipt = json.loads((AI_HOME / "download-receipt.json").read_text())["models"]["nuextract_source"]
    if receipt["revision"] != revision:
        raise SystemExit("Nguồn chưa đúng revision đã ghim; tải bằng --model nuextract_source")
    for name, meta in receipt["weights"].items():
        with (source / name).open("rb") as f:
            if hashlib.file_digest(f, "sha256").hexdigest() != meta["sha256"]:
                raise SystemExit(f"Nguồn bị thay đổi: {name}")
    os.environ.update(local_environment())
    from mlx_vlm.convert import convert

    convert(str(source), str(staged), quantize=True, q_bits=4, q_group_size=64,
            q_mode="affine", trust_remote_code=False)
    # Không dùng chat template chung của Qwen: NuExtract cần template/instructions riêng.
    shutil.copyfile(source / "chat_template.jinja", staged / "chat_template.jinja")
    (staged / "README.md").write_text(f"# {repo}\n\nLocal MLX 4-bit conversion of revision {revision}.\n")
    digests = {}
    for path in sorted(staged.glob("*.safetensors")):
        with path.open("rb") as f:
            digests[path.name] = {"sha256": hashlib.file_digest(f, "sha256").hexdigest(), "bytes": path.stat().st_size}
    if not digests:
        raise RuntimeError("Không có trọng số sau khi chuyển")
    provenance = {"repo": repo, "revision": revision, "converted_at": datetime.now(timezone.utc).isoformat(),
                  "quantization": {"bits": 4, "group_size": 64, "mode": "affine", "vision": "mlx-vlm default: unquantized"},
                  "versions": {p: importlib.metadata.version(p) for p in ("mlx", "mlx-vlm", "transformers", "torch", "torchvision")},
                  "source_weights": receipt["weights"], "weights": digests}
    (staged / "conversion-receipt.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2))
    staged.rename(target)
    print(f"Ready: {target}")


if __name__ == "__main__":
    main()
