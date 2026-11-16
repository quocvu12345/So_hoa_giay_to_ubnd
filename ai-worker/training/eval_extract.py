"""Chấm điểm một model trích trường trên tập eval (thủ tục không có trong tập huấn luyện).
Mọi model đều đi qua cùng bộ lọc bằng chứng `evidence_fields` như bản chạy thật: giá trị không có trong văn bản bị bỏ.

  python eval_extract.py --model qwen3-4b   --prompt production --tag base-qwen3-4b
  python eval_extract.py --model qwen3.5-2b --prompt short      --tag lora --adapter <thư mục>
"""
from __future__ import annotations

import argparse
import json
import statistics
import time
from collections import defaultdict

from common import MODELS, WORK, read_jsonl

from build_sft import BATCH, document_text, fields_of
from document_ai.classify import evidence_fields, folded, parse_json
from prompts import SYSTEM_PRODUCTION, SYSTEM_SHORT, production_user, short_user


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=MODELS, required=True)
    parser.add_argument("--prompt", choices=("production", "short"), required=True)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--adapter")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--split", default="eval")
    args = parser.parse_args()

    from mlx_lm import load
    from mlx_lm.generate import stream_generate
    from mlx_lm.sample_utils import make_sampler

    began = time.perf_counter()
    model, tokenizer = load(str(MODELS[args.model]), adapter_path=args.adapter)
    load_seconds = time.perf_counter() - began
    system, build, max_tokens = (SYSTEM_PRODUCTION, production_user, 2600) if args.prompt == "production" else (SYSTEM_SHORT, short_user, 1200)
    sampler = make_sampler(temp=0)

    rows = [r for r in read_jsonl(WORK / "ocr.jsonl") if r["split"] == args.split and not r["error"] and r["pages"]]
    rows = rows[:args.limit] if args.limit else rows
    docs, calls, bad_json, tokens_out, tokens_in, peak = [], 0, 0, 0, 0, 0.0
    for row in rows:
        text = document_text(row)
        pages = [{"page": p["page"], "text": p["text"]} for p in row["pages"]]
        truth, _ = fields_of(row["document_id"])
        labels = [l for l, _ in truth]
        raw, doc_started = [], time.perf_counter()
        for start in range(0, len(labels), BATCH):
            chunk = labels[start:start + BATCH]
            prompt = tokenizer.apply_chat_template(
                [{"role": "system", "content": system}, {"role": "user", "content": build("Giấy tờ trong hồ sơ", chunk, text)}],
                add_generation_prompt=True, tokenize=False, enable_thinking=False)
            answer, last = "", None
            for last in stream_generate(model, tokenizer, prompt, max_tokens=max_tokens, sampler=sampler):
                answer += last.text
            calls += 1
            tokens_in += last.prompt_tokens
            tokens_out += last.generation_tokens
            peak = max(peak, last.peak_memory)
            try:
                batch = parse_json(answer).get("fields")
                raw.extend(f for f in batch if isinstance(f, dict) and f.get("label") in chunk)
            except (ValueError, TypeError, AttributeError):
                bad_json += 1
        seconds = time.perf_counter() - doc_started
        predicted = {f["label"]: f["value"] for f in evidence_fields(raw, text, labels, pages)}
        haystack = folded(text)
        docs.append({"document_id": row["document_id"], "kind": row["kind"], "seconds": round(seconds, 1),
                     "fields": [{"label": l, "truth": v, "pred": predicted.get(l, ""),
                                 "in_ocr": bool(v) and folded(v) in haystack} for l, v in truth]})
        print(f"{len(docs)}/{len(rows)} {row['document_id']} {seconds:.0f}s", flush=True)

    summary = score(docs)
    summary.update({"tag": args.tag, "model": args.model, "prompt": args.prompt, "adapter": args.adapter, "documents": len(docs),
                    "llm_calls": calls, "invalid_json_calls": bad_json, "load_seconds": round(load_seconds, 1),
                    "seconds_per_doc_median": round(statistics.median(d["seconds"] for d in docs), 1),
                    "prompt_tokens_per_doc": round(tokens_in / len(docs)), "output_tokens_per_doc": round(tokens_out / len(docs)),
                    "peak_memory_gb": round(peak, 2)})
    out = WORK / "eval"
    out.mkdir(exist_ok=True)
    (out / f"{args.tag}.json").write_text(json.dumps({"summary": summary, "documents": docs}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=1))


def score(docs: list[dict]) -> dict:
    def tally(items: list[dict]) -> dict:
        counts = defaultdict(int)
        for doc in items:
            for f in doc["fields"]:
                if f["truth"]:
                    counts["truth_fields"] += 1
                    counts["in_ocr"] += f["in_ocr"]
                    right = folded(f["pred"]) == folded(f["truth"])
                    counts["correct"] += right
                    counts["correct_in_ocr"] += right and f["in_ocr"]
                    counts["wrong"] += bool(f["pred"]) and not right
                    counts["missing_in_ocr"] += f["in_ocr"] and not f["pred"]
                else:
                    counts["blank_fields"] += 1
                    counts["blank_filled"] += bool(f["pred"])
        c = counts
        rate = lambda a, b: round(a / b, 3) if b else None
        return {"truth_fields": c["truth_fields"], "readable_by_ocr": rate(c["in_ocr"], c["truth_fields"]),
                "correct_of_all": rate(c["correct"], c["truth_fields"]), "correct_of_readable": rate(c["correct_in_ocr"], c["in_ocr"]),
                "wrong_value_rate": rate(c["wrong"], c["truth_fields"]), "missed_readable": rate(c["missing_in_ocr"], c["in_ocr"]),
                "blank_fields": c["blank_fields"], "blank_but_filled": c["blank_filled"]}
    return {"all": tally(docs), **{kind: tally([d for d in docs if d["kind"] == kind]) for kind in ("mock", "pkt")}}


if __name__ == "__main__":
    main()
