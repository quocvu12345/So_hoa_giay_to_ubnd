"""Gợi ý nhóm, loại, trường bằng document_ai.classify với danh mục lấy từ CSDL. Dùng chung cho mọi nơi chạy mô hình (MLX trên máy, Ollama qua mạng)."""
from __future__ import annotations

from ..catalog_rules import reconcile_type
from ..contracts import FieldSuggestion, PageResult, Suggestion
from ..field_values import clean_value
from ..queue.repository import Catalog


def suggest_with(llm, key: str, pages: list[PageResult], catalog: Catalog, prompt_style: str) -> Suggestion:
    """llm: đối tượng có .label và .complete(system, prompt, max_tokens) (xem document_ai.classify.ClassifierModel)."""
    from document_ai.classify import classify
    from document_ai.config import shortlist_enabled

    categories = [
        {"code": code, "title": title, "group": "", "documentTypes": [
            {"id": t.code, "name": t.name, "fields": [f.label for f in t.fields]}
            for t in catalog.document_types.values() if t.work_group_code == code
        ]}
        for code, title in catalog.work_groups.items()
    ]
    raw = classify([{"page": p.page_no, "text": p.text} for p in pages], categories,
                   restrict_types_to_group=True, llm=llm, prompt_style=prompt_style, shortlist=shortlist_enabled())
    group = raw.get("category_code")
    type_code, type_warning = reconcile_type(group, raw.get("type_id"), catalog)
    type_def = catalog.document_types.get(type_code) if type_code else None
    labels = {f.label: f.code for f in (type_def.fields if type_def else ())}
    types = {f.label: f.value_type for f in (type_def.fields if type_def else ())}
    fields, dropped = [], []
    for f in raw.get("fields", []):
        if f["label"] not in labels:
            continue
        # AI-23: đưa giá trị về dạng đúng kiểu trường; trích dẫn giữ nguyên văn làm dẫn chứng.
        value, reason = clean_value(types[f["label"]], f["label"], f.get("value", ""))
        if f.get("value") and not value:
            dropped.append(f"“{f['label']}”: giá trị AI đọc {reason}, nên để trống.")
            fields.append(FieldSuggestion(labels[f["label"]], f["label"], "", "", (), False))
            continue
        fields.append(FieldSuggestion(labels[f["label"]], f["label"], value, f.get("quote", "") if value else "",
                                      tuple(f.get("source_pages", [])) if value else (), bool(value)))
    warnings = tuple(raw.get("field_extraction_warnings", [])) + tuple(dropped) + ((type_warning,) if type_warning else ())
    return Suggestion(
        model_key=key,
        work_group_code=group,
        document_type_code=type_code,
        document_form=raw.get("document_form", "Chưa xác định"),
        title=raw.get("title", ""),
        reason=raw.get("reason", ""),
        quote=raw.get("quote", ""),
        evidence_verified=bool(raw.get("classification_evidence_verified")),
        mixed_documents=bool(raw.get("mixed_documents")),
        fields=tuple(fields),
        warnings=warnings,
    )
