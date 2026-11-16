"""Chọn tài liệu để OCR: tách theo thủ tục (không trùng thủ tục giữa train và eval), tối đa 3 tài liệu/thủ tục."""
from __future__ import annotations

import argparse
import json
import random
from collections import defaultdict

import pypdfium2 as pdfium

from common import DATASET, WORK, procedure_of


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--train-procedures", type=int, default=80)
    parser.add_argument("--eval-procedures", type=int, default=20)
    parser.add_argument("--per-procedure", type=int, default=3)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    by_procedure: dict[str, list[dict]] = defaultdict(list)
    for path in sorted((DATASET / "ground-truth").glob("*.json")):
        truth = json.loads(path.read_text(encoding="utf-8"))
        filled = [f for f in truth["fields"] if str(f.get("value", "")).strip()]
        if not 2 <= len(filled) <= 14:
            continue
        pdf = DATASET / "documents" / f"{truth['document_id']}.pdf"
        with pdfium.PdfDocument(str(pdf)) as document:
            pages = len(document)
        if pages > 2:
            continue
        by_procedure[procedure_of(truth["document_id"])].append(
            {"document_id": truth["document_id"], "kind": truth["document_id"].split("-")[0], "pages": pages})

    rng = random.Random(args.seed)
    procedures = sorted(by_procedure)
    rng.shuffle(procedures)
    eval_set = procedures[:args.eval_procedures]
    train_set = procedures[args.eval_procedures:args.eval_procedures + args.train_procedures]
    selection = []
    for split, group in (("eval", eval_set), ("train", train_set)):
        for procedure in group:
            docs = by_procedure[procedure][:]
            rng.shuffle(docs)
            for doc in docs[:args.per_procedure]:
                selection.append({**doc, "split": split, "procedure": procedure})

    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "selection.json").write_text(json.dumps(selection, ensure_ascii=False, indent=1), encoding="utf-8")
    for split in ("eval", "train"):
        rows = [r for r in selection if r["split"] == split]
        print(split, "tài liệu:", len(rows), "| trang:", sum(r["pages"] for r in rows),
              "| form điền sẵn (pkt):", sum(r["kind"] == "pkt" for r in rows), "| tự dựng (mock):", sum(r["kind"] == "mock" for r in rows))
    assert not ({r["procedure"] for r in selection if r["split"] == "eval"} & {r["procedure"] for r in selection if r["split"] == "train"})


if __name__ == "__main__":
    main()
