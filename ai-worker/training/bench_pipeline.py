"""AI-12: đo từng bước của luồng AI thật trên máy hiện tại (Mac M4 16 GB), cho Qwen3-4B và Qwen3-1.7B.

Ba pha, chạy riêng để không tranh bộ nhớ (trừ pha `coresident` cố ý chạy chung):

  python bench_pipeline.py ocr        [--filled 36]        # đọc chữ, lưu cache bench/ocr.jsonl (chạy tiếp được)
  python bench_pipeline.py llm        --model qwen3-4b     # chạy ĐÚNG document_ai.classify.classify() trên chữ đã cache
  python bench_pipeline.py coresident --model qwen3-1.7b   # OCR + LLM cùng nằm trong bộ nhớ, đo RAM và swap
  python bench_pipeline.py report                          # gộp kết quả thành bảng

Dữ liệu (đều là bản GIẢ LẬP hoặc mẫu công khai, không phải giấy tờ thật của dân):
  - data/filled-samples: PDF điền bằng font mô phỏng, 1 trang, mỗi loại giấy tờ một bản, có expected_type_id/expected_fields;
  - data/citizen-samples: 11 PDF có expected_type_id (mẫu trống công khai, bản mô phỏng điền tay).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import statistics
import subprocess
import sys
import time
from collections import defaultdict

import psutil
from common import REPO, WORK, MODELS, append_jsonl, read_jsonl

from hoso_ai.engines.mlx import PaddleVlMlxOcr
from hoso_ai.engines.pdfium import PdfiumReader

BENCH = WORK / "bench"


def gb(value: float) -> float:
    return round(value / 1024 ** 3, 2)


def tree_rss() -> int:
    me = psutil.Process(os.getpid())
    return sum(p.memory_info().rss for p in [me, *me.children(recursive=True)])


def system_state() -> dict:
    vm, swap = psutil.virtual_memory(), psutil.swap_memory()
    return {"available_gb": gb(vm.available), "swap_used_gb": gb(swap.used), "swap_out_gb_total": gb(swap.sout)}


def folded(value) -> str:
    from document_ai.classify import folded as f
    return f(value)


# ----------------------------------------------------------------------------- dữ liệu

def select_documents(filled: int) -> list[dict]:
    answers = json.loads((REPO / "data/filled-samples/answers.json").read_text(encoding="utf-8"))
    manifest = {d["id"]: d for d in json.loads((REPO / "data/filled-samples/manifest.json").read_text(encoding="utf-8"))["documents"]}
    ids = sorted(answers)
    step = max(1, len(ids) // filled)
    docs = [{"id": i, "kind": "filled", "pdf": REPO / manifest[i]["local_path"], "pages": manifest[i]["page_count"],
             "expected_type_id": answers[i]["expected_type_id"], "expected_fields": answers[i]["expected_fields"]}
            for i in ids[::step][:filled]]
    citizen = json.loads((REPO / "data/citizen-samples/manifest.json").read_text(encoding="utf-8"))["documents"]
    truth = json.loads((REPO / "data/citizen-samples/ground-truth.json").read_text(encoding="utf-8"))
    for d in citizen:
        if not d.get("expected_type_id"):
            continue    # gói trộn nhiều giấy tờ cần tách, không có một loại duy nhất
        docs.append({"id": d["id"], "kind": "citizen", "pdf": REPO / d["local_path"], "pages": d["page_count"],
                     "expected_type_id": d["expected_type_id"], "expected_fields": truth.get(d["id"], {}).get("expected_fields")})
    return docs


# ----------------------------------------------------------------------------- pha OCR

def phase_ocr(args) -> None:
    BENCH.mkdir(exist_ok=True)
    out = BENCH / "ocr.jsonl"
    done = {r["id"] for r in read_jsonl(out)}
    todo = [d for d in select_documents(args.filled) if d["id"] not in done]
    print(f"OCR: đã có {len(done)}, còn {len(todo)} tài liệu", flush=True)
    if not todo:
        return
    engine, reader = PaddleVlMlxOcr(WORK / "ocr-server"), PdfiumReader()
    before = system_state()
    began = time.perf_counter()
    engine.load()
    load_seconds = round(time.perf_counter() - began, 1)
    after = system_state()
    meta = {"load_seconds": load_seconds, "rss_after_load_gb": gb(tree_rss()),
            "available_before_gb": before["available_gb"], "available_after_load_gb": after["available_gb"]}
    print("nạp OCR", meta, flush=True)
    append_jsonl(BENCH / "ocr-meta.jsonl", {"at": time.strftime("%F %T"), **meta})
    images, peak_rss = BENCH / "images", 0
    try:
        for index, doc in enumerate(todo, 1):
            pages, error = [], None
            for page_no in range(1, doc["pages"] + 1):
                try:
                    render_began = time.perf_counter()
                    image = reader.render(doc["pdf"], page_no, images)
                    render_seconds = time.perf_counter() - render_began
                    ocr_began = time.perf_counter()
                    text, _ = engine.read(image, 300)
                    pages.append({"page": page_no, "text": text, "ocr_seconds": round(time.perf_counter() - ocr_began, 2),
                                  "render_seconds": round(render_seconds, 2)})
                except Exception as exc:    # một trang lỗi không làm hỏng cả lô
                    error = f"{type(exc).__name__}: {exc}"
                    break
                finally:
                    shutil.rmtree(images, ignore_errors=True)
                peak_rss = max(peak_rss, tree_rss())
            append_jsonl(out, {"id": doc["id"], "kind": doc["kind"], "expected_type_id": doc["expected_type_id"],
                               "expected_fields": doc["expected_fields"], "pages": pages, "error": error, "peak_rss_gb": gb(peak_rss)})
            seconds = sum(p["ocr_seconds"] for p in pages)
            print(f"[{index}/{len(todo)}] {doc['id']} {len(pages)} trang {seconds:.0f}s", flush=True)
    finally:
        engine.unload()


# ----------------------------------------------------------------------------- pha LLM

class Instrumented:
    """Thay mlx_lm.load/generate bằng bản đo thời gian, để chạy NGUYÊN hàm classify() của bản chạy thật."""

    def __init__(self, model_key: str):
        import mlx.core as mx
        import mlx_lm

        self.mx, self.mlx_lm = mx, mlx_lm
        self.calls: list[dict] = []
        self.label = model_key
        began = time.perf_counter()
        self.model, self.tokenizer = mlx_lm.load(str(MODELS[model_key]))
        self.load_seconds = round(time.perf_counter() - began, 1)
        self._real_generate = mlx_lm.generate
        mlx_lm.load = lambda path, **kwargs: (self.model, self.tokenizer)
        mlx_lm.generate = self.generate

    def render(self, system, prompt):
        """Giống ClassifierModel.render của bản chạy thật: tắt chế độ suy nghĩ qua mẫu chat."""
        return self.tokenizer.apply_chat_template(
            [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            add_generation_prompt=True, tokenize=False, enable_thinking=False)

    def generate(self, model, tokenizer, prompt, **kwargs):
        began = time.perf_counter()
        answer = self._real_generate(model, tokenizer, prompt=prompt, **kwargs)
        self.calls.append({"seconds": round(time.perf_counter() - began, 2),
                           "prompt_tokens": len(tokenizer.encode(prompt)), "output_tokens": len(tokenizer.encode(answer)),
                           "max_tokens": kwargs.get("max_tokens")})
        return answer

    def peak_gb(self) -> float:
        return gb(self.mx.get_peak_memory())


def run_classify(instrument: Instrumented, row: dict, restrict: bool = True, prompt_style: str = "production", shortlist: bool = False) -> dict:
    from document_ai.classify import classify

    pages = [{"page": p["page"], "text": p["text"]} for p in row["pages"]]
    instrument.calls.clear()
    began = time.perf_counter()
    error, result = None, {}
    try:
        # restrict=True là cách worker thật gọi (QwenMlxClassifier): chỉ chọn loại trong nhóm đã chọn. False là bản thí điểm cũ, chọn trong mọi nhóm có tên giống.
        result = classify(pages, restrict_types_to_group=restrict, llm=instrument, prompt_style=prompt_style, shortlist=shortlist)
    except Exception as exc:
        error = f"{type(exc).__name__}: {str(exc)[:200]}"
    seconds = round(time.perf_counter() - began, 2)
    calls = list(instrument.calls)
    steps = {"group": calls[0]["seconds"] if calls else None, "type": calls[1]["seconds"] if len(calls) > 1 else None,
             "fields": round(sum(c["seconds"] for c in calls[2:]), 2), "field_calls": max(0, len(calls) - 2)}
    predicted = {f["label"]: f["value"] for f in result.get("fields", [])}
    truth = row.get("expected_fields") or {}
    return {"id": row["id"], "kind": row["kind"], "seconds": seconds, "steps": steps, "error": error,
            "expected_type_id": row["expected_type_id"], "predicted_type_id": result.get("type_id"),
            "predicted_group": result.get("category_code"),
            "fields": [{"label": k, "truth": v, "pred": predicted.get(k, ""),
                        "in_ocr": bool(v) and folded(v) in folded("\n".join(p["text"] for p in row["pages"]))} for k, v in truth.items()],
            "prompt_tokens": sum(c["prompt_tokens"] for c in calls), "output_tokens": sum(c["output_tokens"] for c in calls)}


def phase_llm(args) -> None:
    rows = [r for r in read_jsonl(BENCH / "ocr.jsonl") if r["pages"] and not r["error"]]
    rows = rows[:args.limit] if args.limit else rows
    instrument = Instrumented(args.model)
    instrument.mx.reset_peak_memory()
    print(f"{args.model}: nạp {instrument.load_seconds}s, {len(rows)} tài liệu", flush=True)
    docs = []
    for index, row in enumerate(rows, 1):
        doc = run_classify(instrument, row, restrict=not args.legacy_catalog_scope, prompt_style=args.prompt, shortlist=args.shortlist)
        docs.append(doc)
        mark = "đúng" if doc["predicted_type_id"] == doc["expected_type_id"] else f"SAI ({doc['predicted_type_id']})"
        print(f"[{index}/{len(rows)}] {doc['id']} {doc['seconds']:.0f}s loại {mark}" + (f" LỖI {doc['error']}" if doc["error"] else ""), flush=True)
    summary = summarize(docs)
    summary.update({"model": args.model, "load_seconds": instrument.load_seconds, "peak_memory_gb": instrument.peak_gb(),
                    "documents": len(docs), "date": time.strftime("%F %T")})
    (BENCH / f"llm-{args.model}{args.tag}.json").write_text(json.dumps({"summary": summary, "documents": docs}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=1))


def rate(a, b):
    return round(a / b, 3) if b else None


def summarize(docs: list[dict]) -> dict:
    def part(items: list[dict]) -> dict:
        n = len(items)
        field = defaultdict(int)
        for d in items:
            for f in d["fields"]:
                if f["truth"]:
                    field["truth"] += 1
                    right = folded(f["pred"]) == folded(f["truth"])
                    field["correct"] += right
                    field["wrong"] += bool(f["pred"]) and not right
                    field["missed"] += not f["pred"]
                    field["readable"] += f["in_ocr"]
                    field["correct_readable"] += right and f["in_ocr"]
        seconds = [d["seconds"] for d in items]
        step = lambda key: [d["steps"][key] for d in items if d["steps"][key] is not None]
        return {"documents": n,
                "errors": sum(1 for d in items if d["error"]),
                "group_correct": rate(sum(1 for d in items if (d["predicted_group"] or "") == d["expected_type_id"].split("-")[0]), n),
                "type_correct": rate(sum(1 for d in items if d["predicted_type_id"] == d["expected_type_id"]), n),
                "truth_fields": field["truth"], "field_correct": rate(field["correct"], field["truth"]),
                "field_wrong": rate(field["wrong"], field["truth"]), "field_missed": rate(field["missed"], field["truth"]),
                "field_correct_of_readable": rate(field["correct_readable"], field["readable"]),
                "seconds_median": round(statistics.median(seconds), 1) if seconds else None,
                "seconds_p90": round(sorted(seconds)[int(len(seconds) * 0.9) - 1], 1) if seconds else None,
                "step_group_median": round(statistics.median(step("group")), 1) if step("group") else None,
                "step_type_median": round(statistics.median(step("type")), 1) if step("type") else None,
                "step_fields_median": round(statistics.median(step("fields")), 1) if step("fields") else None,
                "prompt_tokens_per_doc": round(statistics.mean(d["prompt_tokens"] for d in items)) if items else None,
                "output_tokens_per_doc": round(statistics.mean(d["output_tokens"] for d in items)) if items else None}
    return {"all": part(docs), **{kind: part([d for d in docs if d["kind"] == kind]) for kind in ("filled", "citizen") if any(d["kind"] == kind for d in docs)}}


# ----------------------------------------------------------------------------- pha chạy chung

def memory_pressure() -> str:
    try:
        text = subprocess.run(["memory_pressure"], capture_output=True, text=True, timeout=20).stdout
        return next((line.strip() for line in text.splitlines() if "free percentage" in line), "")
    except Exception:
        return ""


def phase_coresident(args) -> None:
    rows = [r for r in read_jsonl(BENCH / "ocr.jsonl") if r["pages"] and not r["error"] and r["kind"] == "filled"][:args.docs]
    pdfs = {d["id"]: d for d in select_documents(36)}
    engine, reader = PaddleVlMlxOcr(WORK / "ocr-server"), PdfiumReader()
    start = system_state()
    out = {"model": args.model, "start": start, "pressure_start": memory_pressure()}
    engine.load()
    out["after_ocr_load"] = {**system_state(), "rss_gb": gb(tree_rss())}
    instrument = Instrumented(args.model)
    instrument.mx.reset_peak_memory()
    out["after_llm_load"] = {**system_state(), "rss_gb": gb(tree_rss()), "llm_load_seconds": instrument.load_seconds}
    timings, images, peak_rss = [], BENCH / "images", 0
    try:
        for row in rows:
            doc = pdfs[row["id"]]
            began = time.perf_counter()
            image = reader.render(doc["pdf"], 1, images)
            text, _ = engine.read(image, 300)
            ocr_seconds = time.perf_counter() - began
            shutil.rmtree(images, ignore_errors=True)
            result = run_classify(instrument, {**row, "pages": [{"page": 1, "text": text}]})
            peak_rss = max(peak_rss, tree_rss())
            timings.append({"id": row["id"], "ocr_seconds": round(ocr_seconds, 1), "classify_seconds": result["seconds"],
                            "type_ok": result["predicted_type_id"] == row["expected_type_id"]})
            print(timings[-1], flush=True)
    finally:
        engine.unload()
    end = system_state()
    out.update({"peak_rss_gb": gb(peak_rss), "mlx_peak_gb": instrument.peak_gb(), "end": end, "pressure_end": memory_pressure(),
                "swap_out_during_gb": round(end["swap_out_gb_total"] - start["swap_out_gb_total"], 2),
                "min_ocr_seconds": min(t["ocr_seconds"] for t in timings) if timings else None,
                "median_total_seconds": round(statistics.median(t["ocr_seconds"] + t["classify_seconds"] for t in timings), 1) if timings else None,
                "timings": timings})
    (BENCH / f"coresident-{args.model}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in out.items() if k != "timings"}, ensure_ascii=False, indent=1))


# ----------------------------------------------------------------------------- báo cáo

def phase_report(_args) -> None:
    ocr = [r for r in read_jsonl(BENCH / "ocr.jsonl") if r["pages"]]
    seconds = [p["ocr_seconds"] for r in ocr for p in r["pages"]]
    print(f"OCR: {len(ocr)} tài liệu, {len(seconds)} trang; trung vị {statistics.median(seconds):.1f}s/trang, p90 {sorted(seconds)[int(len(seconds) * .9) - 1]:.1f}s")
    for path in sorted(BENCH.glob("llm-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        print("\n", path.name, json.dumps(data["summary"], ensure_ascii=False, indent=1))


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="phase", required=True)
    ocr = sub.add_parser("ocr"); ocr.add_argument("--filled", type=int, default=36); ocr.set_defaults(run=phase_ocr)
    llm = sub.add_parser("llm"); llm.add_argument("--model", choices=("qwen3-4b", "qwen3-1.7b"), required=True)
    llm.add_argument("--limit", type=int)
    llm.add_argument("--prompt", choices=("production", "short"), default="production", help="kiểu lời nhắc bước trích trường")
    llm.add_argument("--legacy-catalog-scope", action="store_true", help="chọn loại trong mọi nhóm như bản thí điểm cũ (không giống worker thật)")
    llm.add_argument("--shortlist", action="store_true", help="AI-20: chỉ đưa cho mô hình các nhóm/loại khớp từ khóa nhất")
    llm.add_argument("--tag", default="", help="hậu tố tên tệp kết quả"); llm.set_defaults(run=phase_llm)
    co = sub.add_parser("coresident"); co.add_argument("--model", choices=("qwen3-4b", "qwen3-1.7b"), required=True)
    co.add_argument("--docs", type=int, default=4); co.set_defaults(run=phase_coresident)
    sub.add_parser("report").set_defaults(run=phase_report)
    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    sys.exit(main())
