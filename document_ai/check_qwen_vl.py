"""Smoke-test the downloaded Qwen3-VL model on one local image, offline."""
import argparse
import json
import os
from pathlib import Path
import time

from .config import AI_HOME, OPTIONAL_MODELS, local_environment, model_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path, help="Local PNG/JPEG image of one page or region")
    parser.add_argument("--prompt", default="Đọc các trường đã điền trong ảnh. Chỉ trả JSON gồm tên trường và giá trị; không đoán ô trống hoặc chữ không đọc rõ.")
    parser.add_argument("--max-tokens", type=int, default=256)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not args.image.is_file():
        parser.error("Không tìm thấy ảnh local.")
    if not 1 <= args.max_tokens <= 1024:
        parser.error("--max-tokens phải từ 1 đến 1024.")
    path = model_path("qwen_vl")
    receipt_path = AI_HOME / "download-receipt.json"
    receipt = json.loads(receipt_path.read_text()).get("models", {}).get("qwen_vl", {}) if receipt_path.is_file() else {}
    if receipt.get("revision") != OPTIONAL_MODELS["qwen_vl"][1]:
        raise SystemExit("Chưa tải Qwen3-VL. Chạy ./scripts/document-ai.sh download --model qwen_vl")
    shards = {name: metadata for name, metadata in receipt["weights"].items() if name.endswith(".safetensors")}
    if len(shards) != 2:
        raise SystemExit("Thiếu thông tin kiểm tra hai shard trọng số MLX.")
    for shard, metadata in shards.items():
        if not (path / shard).is_file() or (path / shard).stat().st_size != metadata["bytes"]:
            raise SystemExit("Chưa đủ các shard trọng số. Chạy lại lệnh download.")
    os.environ.update(local_environment())
    from PIL import Image, ImageOps
    import mlx.core as mx
    from mlx_vlm import load, generate
    from mlx_vlm.prompt_utils import apply_chat_template
    from mlx_vlm.utils import load_config

    started = time.monotonic()
    with Image.open(args.image) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
    # A small single-image check for the M4 16 GB; not a full-resolution OCR benchmark.
    image.thumbnail((1280, 1280))
    model, processor = load(str(path))
    config = load_config(str(path))
    prompt = apply_chat_template(processor, config, args.prompt, num_images=1)
    result = generate(model, processor, prompt, image=image, max_tokens=args.max_tokens,
                      temperature=0.0, verbose=False)
    report = {"repo": OPTIONAL_MODELS["qwen_vl"][0], "revision": OPTIONAL_MODELS["qwen_vl"][1],
              "model_path": str(path), "image": str(args.image.resolve()), "image_size": list(image.size),
              "prompt": args.prompt, "text": result.text, "finish_reason": result.finish_reason,
              "prompt_tokens": result.prompt_tokens, "generated_tokens": result.generation_tokens,
              "elapsed_seconds": round(time.monotonic() - started, 2),
              "peak_mlx_memory_GB": round(mx.get_peak_memory() / 1e9, 3), "local_only": True,
              "requires_review": True}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
