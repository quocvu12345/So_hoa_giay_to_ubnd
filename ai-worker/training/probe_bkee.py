"""Thử giao diện NER gốc trên ba dòng OCR; không dùng nhãn trường làm đáp án NER."""
import argparse
import hashlib
import json
import os
import time
from pathlib import Path

from common import MODELS, WORK, read_jsonl
from bench_activity import ModelActivity
from document_ai.config import model_identity

SYSTEM = "Trích xuất các đề cập thực thể từ câu tiếng Việt đã cho. Hãy suy nghĩ theo từng bước."
SELECTION = {
    "citizen-land-hand-sim": "- Họ tên ông:",
    "citizen-inheritance-hand-sim": "II. Ông (A)",
    "citizen-vehicle-hand-sim": "Tên chủ xe:",
}


def entities_object(answer):
    """Chỉ dùng chẩn đoán: prompt gốc cho phép văn bản giải thích trước JSON."""
    decoder = json.JSONDecoder()
    for i, char in enumerate(answer):
        if char != "{":
            continue
        try:
            value, _ = decoder.raw_decode(answer[i:])
        except ValueError:
            continue
        if (isinstance(value, dict) and isinstance(value.get("entities"), list)
                and all(isinstance(e, dict) and isinstance(e.get("text"), str)
                        and isinstance(e.get("type"), str) for e in value["entities"])):
            return value
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", choices=MODELS, default="qwen3-4b-bkee")
    parser.add_argument("--input", type=Path, default=WORK / "bench/qwen4b-paired-input.jsonl")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit(f"Không ghi đè kết quả: {args.output}")
    rows = {r["id"]: r for r in read_jsonl(args.input)}
    samples = []
    for doc_id, prefix in SELECTION.items():
        matches = [{"id": doc_id, "page": p["page"], "text": line}
                   for p in rows[doc_id]["pages"] for line in p["text"].splitlines()
                   if line.startswith(prefix)]
        if not matches:
            raise ValueError(f"Không tìm thấy dòng OCR: {doc_id}, {prefix}")
        samples.append(matches[0])
    os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", TOKENIZERS_PARALLELISM="false")
    import mlx.core as mx
    from mlx_lm import generate, load
    from mlx_lm.sample_utils import make_sampler

    metadata = {"task": "native_sentence_ner_diagnostic", "system": SYSTEM,
                "source": "https://huggingface.co/hadeseus/qwen3-4b-bkee-entity-extraction",
                "temperature": 0, "max_tokens": 2048,
                "input_file_sha256": hashlib.sha256(args.input.read_bytes()).hexdigest(),
                "identity": model_identity(MODELS[args.model]),
                "note": "Không có nhãn NER; JSON hợp lệ và span có trong OCR không phải độ chính xác."}
    results = []
    with ModelActivity(require_idle=True) as activity:
        start = time.perf_counter()
        model, tokenizer = load(str(MODELS[args.model]))
        metadata["load_seconds"] = round(time.perf_counter() - start, 3)
        for sample in samples:
            prompt = tokenizer.apply_chat_template([
                {"role": "system", "content": SYSTEM}, {"role": "user", "content": sample["text"]}
            ], tokenize=False, add_generation_prompt=True)
            start = time.perf_counter()
            answer = generate(model, tokenizer, prompt=prompt, max_tokens=2048,
                              sampler=make_sampler(0), verbose=False)
            seconds = round(time.perf_counter() - start, 3)
            parsed = entities_object(answer)
            results.append({**sample, "answer": answer, "parsed": parsed, "seconds": seconds,
                            "output_tokens": len(tokenizer.encode(answer)),
                            "all_spans_in_input": (all(e["text"] in sample["text"] for e in parsed["entities"])
                                                   if parsed is not None else None)})
            print(f"{sample['id']}: {seconds}s; entities={parsed}", flush=True)
        metadata["peak_mlx_gib"] = round(mx.get_peak_memory() / 1024 ** 3, 3)
    metadata.update(gpu_activity=activity.report(), complete=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"metadata": metadata, "samples": results}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
