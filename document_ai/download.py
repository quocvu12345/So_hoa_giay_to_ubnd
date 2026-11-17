"""Explicit online download step. Inference uses local paths and offline mode."""
import argparse
import fnmatch
import hashlib
import json
import os
from datetime import datetime, timezone

from .config import AI_HOME, MODEL_ROOT, MODELS


def main():
    specs = MODELS
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", action="append", choices=list(specs),
                        help="Download only this model; repeat to select several. Default: all models. "
                             "The classifier is a BF16 source: convert it afterwards with `python -m document_ai.convert`.")
    args = parser.parse_args()
    os.environ["HF_HOME"] = str(AI_HOME / "cache/huggingface")
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ.pop("HF_HUB_OFFLINE", None)
    from huggingface_hub import HfApi, snapshot_download
    receipt_path = AI_HOME / "download-receipt.json"
    receipt = json.loads(receipt_path.read_text()) if receipt_path.is_file() else {"models": {}}
    patterns = ["*.json", "*.safetensors", "*.txt", "*.model", "*.jinja", "*.pdiparams", "*.yml", "README.md", "LICENSE*"]
    for name in dict.fromkeys(args.model or MODELS):
        repo, revision, directory, weights = specs[name]
        print(f"Downloading {repo} @ {revision}", flush=True)
        path = MODEL_ROOT / directory     # thư mục đã ghim của đúng mô hình đang tải, không phụ thuộc cấu hình HOSO_AI_CLASSIFIER_MODEL
        info = HfApi().model_info(repo, revision=revision, files_metadata=True, token=False)
        if info.sha != revision:
            raise ValueError("Model revision did not match the pinned commit.")
        snapshot_download(repo, revision=revision, local_dir=path, token=False,
                          allow_patterns=patterns, max_workers=2)
        print("Download finished; verifying file sizes and SHA-256...", flush=True)
        digests = {}
        for remote in info.siblings:
            if not any(fnmatch.fnmatch(remote.rfilename, pattern) for pattern in patterns):
                continue
            file = path / remote.rfilename
            if not file.is_file() or (remote.size is not None and file.stat().st_size != remote.size):
                raise ValueError(f"Missing or incomplete model file: {remote.rfilename}")
            if remote.lfs or file.suffix in {".safetensors", ".pdiparams"}:
                with file.open("rb") as handle:
                    digest = hashlib.file_digest(handle, "sha256").hexdigest()
                if remote.lfs and digest != remote.lfs.sha256:
                    raise ValueError(f"SHA-256 mismatch: {remote.rfilename}")
                digests[remote.rfilename] = {"sha256": digest, "bytes": file.stat().st_size,
                                            "matches_source": bool(remote.lfs)}
            else:
                data = file.read_bytes()
                git_hash = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
                if remote.blob_id and git_hash != remote.blob_id:
                    raise ValueError(f"Git blob checksum mismatch: {remote.rfilename}")
        if not (path / weights).is_file():
            raise ValueError(f"Model weights/index missing: {weights}")
        timestamp = datetime.now(timezone.utc).isoformat()
        receipt["downloaded_at"] = timestamp
        receipt["models"][name] = {"repo": repo, "revision": revision, "directory": str(path), "weights": digests}
        receipt["models"][name]["verified_at"] = timestamp
        temporary = receipt_path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(receipt, ensure_ascii=False, indent=2))
        temporary.replace(receipt_path)
        print(f"Ready: {directory}", flush=True)


if __name__ == "__main__":
    main()
