"""Đường ống huấn luyện chạy một mạch, thiết kế để chạy tách phiên (nohup/start_new_session):
   đợi OCR xong → dựng dữ liệu → LoRA (mlx_lm.lora) → chấm điểm bản đã huấn luyện trên tập eval.
Ghi cấu hình và nhật ký vào $DOCUMENT_AI_HOME/training/runs/<tag>/ để tái lập.

  python pipeline_train.py --model qwen3-1.7b --tag lora-qwen3-1.7b
"""
from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import time
from pathlib import Path

from common import MODELS, WORK, read_jsonl

HERE = Path(__file__).resolve().parent
PY = sys.executable


def run(cmd: list[str], log: Path) -> int:
    print("▶", " ".join(cmd), flush=True)
    with log.open("w") as handle:
        return subprocess.call(cmd, stdout=handle, stderr=subprocess.STDOUT, cwd=HERE, env={**os.environ, "HF_HUB_OFFLINE": "1", "TOKENIZERS_PARALLELISM": "false"})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=MODELS, required=True)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--epochs", type=float, default=1.0)
    parser.add_argument("--learning-rate", type=float, default=5e-5)
    parser.add_argument("--num-layers", type=int, default=16)
    parser.add_argument("--max-seq-length", type=int, default=1280)
    parser.add_argument("--expected-docs", type=int, default=285)
    args = parser.parse_args()
    run_dir = WORK / "runs" / args.tag
    run_dir.mkdir(parents=True, exist_ok=True)

    # 1. Đợi OCR xong (hoặc tiến trình OCR đã kết thúc).
    while len(read_jsonl(WORK / "ocr.jsonl")) < args.expected_docs:
        time.sleep(20)
    print("OCR xong", flush=True)

    # 2. Dữ liệu huấn luyện.
    if run([PY, "build_sft.py"], run_dir / "build_sft.log") != 0:
        return 1
    train = sum(1 for _ in (WORK / "sft/train.jsonl").open(encoding="utf-8"))
    iters = max(20, math.ceil(train / args.batch_size * args.epochs))
    config = {**vars(args), "model_path": str(MODELS[args.model]), "train_samples": train, "iters": iters,
              "started": time.strftime("%Y-%m-%d %H:%M:%S")}
    (run_dir / "config.json").write_text(json.dumps(config, ensure_ascii=False, indent=1), encoding="utf-8")

    # 3. Huấn luyện LoRA (mặt nạ lời nhắc: chỉ tính loss trên câu trả lời).
    adapter = run_dir / "adapter"
    train_cmd = [str(Path(PY).parent / "mlx_lm.lora"), "--model", str(MODELS[args.model]), "--train", "--data", str(WORK / "sft"),
                 "--iters", str(iters), "--batch-size", str(args.batch_size), "--num-layers", str(args.num_layers),
                 "--max-seq-length", str(args.max_seq_length), "--mask-prompt", "--grad-checkpoint", "--adapter-path", str(adapter),
                 "--learning-rate", str(args.learning_rate), "--steps-per-eval", str(max(10, iters // 5)), "--val-batches", "15",
                 "--save-every", str(max(10, iters // 5)), "--steps-per-report", "10", "--seed", "7"]
    if run(train_cmd, run_dir / "train.log") != 0:
        print("Huấn luyện lỗi, xem train.log", flush=True)
        return 2

    # 4. Chấm điểm trên tập eval (thủ tục không có trong huấn luyện), lời nhắc ngắn đúng như lúc huấn luyện.
    code = run([PY, "eval_extract.py", "--model", args.model, "--prompt", "short", "--adapter", str(adapter), "--tag", args.tag], run_dir / "eval.log")
    print("Xong" if code == 0 else "Chấm điểm lỗi", flush=True)
    return code


if __name__ == "__main__":
    sys.exit(main())
