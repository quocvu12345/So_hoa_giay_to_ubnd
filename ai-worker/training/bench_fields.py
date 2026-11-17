"""So sánh trích trường với schema đã biết, cùng OCR; tùy chọn thử ảnh riêng cho NuExtract.

Không gọi phân loại và không ghi CSDL. Đáp án chỉ dùng sau inference để chấm.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import math
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path

from common import REPO, WORK, read_jsonl
from bench_pipeline import folded, system_state
from compare_models import field_counts
from document_ai.config import model_identity
from document_ai.field_extract import FieldExtractor, MODEL_NAMES
from document_ai.prompts import SHORT_MAX_TOKENS


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def score_document(row, result):
    verified = {f["label"]: f["value"] for f in result.get("fields", [])}
    raw = {f["label"]: f["value"] for f in result.get("raw_fields", [])}
    text = folded("\n".join(p["text"] for p in row["pages"]))
    fields = [{"label": k, "truth": v, "pred": verified.get(k, ""), "raw_pred": raw.get(k, ""),
               "in_ocr": bool(v) and folded(v) in text} for k, v in (row.get("expected_fields") or {}).items()]
    return {"id": row["id"], "kind": row["kind"], "expected_type_id": row["expected_type_id"],
            "fields": fields, "result": result, "seconds": result["seconds"]}


def summarize(docs, catalog):
    times = sorted(d["seconds"] for d in docs)
    raw_docs = [{**d, "fields": [{**f, "pred": f["raw_pred"]} for f in d["fields"]]} for d in docs]
    return {"documents": len(docs), "labelled_documents": sum(bool(d["fields"]) for d in docs),
            "verified": field_counts({"documents": docs}, catalog),
            "raw": field_counts({"documents": raw_docs}, catalog),
            "seconds_median": round(statistics.median(times), 3) if times else None,
            "seconds_p90": times[math.ceil(len(times) * .9) - 1] if times else None,
            "documents_with_errors": sum(bool(d["result"]["errors"]) for d in docs),
            "calls_at_token_limit": sum(c["reached_token_limit"] for d in docs for c in d["result"]["calls"]),
            "peak_mlx_gib": max((d["result"]["peak_mlx_gib"] for d in docs), default=0)}


def render_images(row, manifest):
    import pypdfium2 as pdfium
    path = REPO / manifest[row["id"]]["local_path"]
    images = []
    with pdfium.PdfDocument(str(path)) as pdf:
        for info in row["pages"]:
            page = pdf[info["page"] - 1]
            try:
                bitmap = page.render(scale=1280 / max(page.get_size()))
                try:
                    images.append(bitmap.to_pil().convert("RGB").copy())
                finally:
                    bitmap.close()
            finally:
                page.close()
    return images, hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", choices=MODEL_NAMES, required=True)
    parser.add_argument("--input", type=Path, default=WORK / "bench/qwen4b-paired-input.jsonl")
    parser.add_argument("--catalog", type=Path, default=WORK / "bench/qwen4b-catalog.json")
    parser.add_argument("--vision", action="store_true", help="Chỉ 3 mẫu hand-sim, ảnh có cạnh dài 1280 px")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit(f"Kết quả đã tồn tại, dùng đường dẫn khác: {args.output}")
    rows = read_jsonl(args.input)
    if any(r.get("error") or not r.get("pages") for r in rows):
        raise ValueError("Đầu vào chứa tài liệu OCR lỗi hoặc không có trang")
    if args.vision:
        rows = [r for r in rows if r["id"].endswith("-hand-sim")]
    if args.limit:
        rows = rows[:args.limit]
    if not rows:
        raise ValueError("Không có tài liệu để đo")
    catalog = json.loads(args.catalog.read_text())
    types = {t["id"]: t for c in catalog for t in c["documentTypes"]}
    manifest = {d["id"]: d for d in json.loads((REPO / "data/citizen-samples/manifest.json").read_text())["documents"]}
    metadata = {"engine": args.engine, "mode": "images" if args.vision else "cached_ocr",
                "task": "known_schema_field_extraction", "thinking": False, "temperature": 0,
                "batch_size": 10, "max_tokens_per_call": SHORT_MAX_TOKENS,
                "prompt": "nuextract_native_verbatim" if args.engine == "nuextract" else "qwen_short",
                "input_sha256": digest(rows), "catalog_sha256": digest(catalog),
                "document_ids": [r["id"] for r in rows], "system_before": system_state(),
                "versions": {p: importlib.metadata.version(p) for p in ("mlx", "mlx-lm", "mlx-vlm", "transformers")}}
    for package in ("torch", "torchvision"):
        try:
            metadata["versions"][package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            metadata["versions"][package] = None
    extractor = FieldExtractor(args.engine, vision=args.vision)
    import mlx.core as mx
    mx.reset_peak_memory()
    metadata.update(identity=model_identity(extractor.path), load_seconds=round(extractor.load_seconds, 3))
    receipt = extractor.path / "conversion-receipt.json"
    if receipt.exists():
        metadata["conversion"] = json.loads(receipt.read_text())
    docs = []
    def save(complete):
        metadata.update(complete=complete, date=time.strftime("%F %T"), system_after=system_state())
        args.output.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.output.with_suffix(".tmp")
        temporary.write_text(json.dumps({"metadata": metadata, "summary": summarize(docs, catalog), "documents": docs}, ensure_ascii=False, indent=2))
        temporary.replace(args.output)
    print(f"{args.engine}: nạp {extractor.load_seconds:.2f}s; {len(rows)} tài liệu", flush=True)
    try:
        for row in rows:
            schema = types[row["expected_type_id"]]
            images, pdf_digest = render_images(row, manifest) if args.vision else (None, None)
            started_at = datetime.now(timezone.utc).isoformat()
            try:
                result = extractor.extract(row["pages"], schema["fields"], schema["name"], images)
            finally:
                for im in images or []:
                    im.close()
            result.update(started_at=started_at, finished_at=datetime.now(timezone.utc).isoformat())
            if pdf_digest:
                result["pdf_sha256"] = pdf_digest
                result["image_longest_side"] = 1280
            docs.append(score_document(row, result))
            save(False)
            print(f"[{len(docs)}/{len(rows)}] {row['id']}: {result['seconds']}s, {len(result['errors'])} lỗi", flush=True)
        save(True)
        print(json.dumps(summarize(docs, catalog), ensure_ascii=False), flush=True)
    finally:
        extractor.close()


if __name__ == "__main__":
    main()
