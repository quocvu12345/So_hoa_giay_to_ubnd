"""Fetch a bounded, curated set of public documents, preserving provenance and hashes."""
import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, unquote

import httpx

from .config import DATA, ROOT, prepare_dirs
from .documents import atomic_json, inspect_document, render_page, sha256


def fetch_one(row, existing):
    destination = DATA / "documents" / (row["id"] + ".pdf")
    temporary = destination.with_suffix(".part")
    retrieved = datetime.now(timezone.utc).isoformat()
    previous = existing.get(row["id"])
    resolved_url = row["file_url"]
    try:
        if destination.exists():
            if not previous or sha256(destination) != previous["sha256"]:
                raise ValueError("Tệp có sẵn chưa có manifest khớp; giữ nguyên để đối chiếu.")
            retrieved = previous["retrieved_at"]
            resolved_url = previous.get("resolved_url", resolved_url)
        else:
            with httpx.stream("GET", row["file_url"], follow_redirects=True, timeout=45,
                              headers={"User-Agent": "HoSoLocalTest/1.0"}) as response:
                response.raise_for_status()
                resolved_url = str(response.url)
                # All supplied sources are public government publishers or their CDNs.
                if not urlsplit(resolved_url).hostname.endswith((".gov.vn", ".chinhphu.vn")):
                    raise ValueError("Máy chủ chuyển hướng ngoài danh sách nguồn công khai đã chọn.")
                size = 0
                with temporary.open("wb") as output:
                    for chunk in response.iter_bytes(65536):
                        size += len(chunk)
                        if size > 40 * 1024 * 1024:
                            raise ValueError("Tệp vượt 40 MB; bỏ khỏi bộ thử nhỏ.")
                        output.write(chunk)
            info = inspect_document(temporary)
            if info["media_type"] != "application/pdf":
                raise ValueError("Máy chủ không trả về PDF.")
            temporary.replace(destination)
        info = inspect_document(destination)
        return {
            **row, **info, "sha256": sha256(destination), "byte_size": destination.stat().st_size,
            "local_path": str(destination.relative_to(ROOT)), "retrieved_at": retrieved,
            "resolved_url": resolved_url, "original_name": unquote(Path(urlsplit(row["file_url"]).path).name),
            "label_origin": "curated_source_metadata", "label_review_status": "needs_review",
            "verification": "Đã tải, mở PDF và tính SHA-256. Nhãn lấy từ trang/tiêu đề nguồn; chưa xác thực chữ ký số hoặc hiệu lực pháp lý.",
        }, None
    except Exception as error:
        return None, {"id": row["id"], "source_url": row["source_url"], "error": str(error)}
    finally:
        temporary.unlink(missing_ok=True)


def existing_public_samples():
    metadata = {r["id"]: r for r in json.loads((ROOT / "database/data/public_documents.json").read_text())["records"]}
    files = json.loads((ROOT / "database/data/file_manifest.json").read_text())
    rows, errors = [], []
    for item in files:
        if not item["filename"].endswith(".pdf"):
            continue
        key = item["document_key"]
        info = metadata[key]
        candidates = [ROOT / "database/downloads" / item["filename"]]
        if item.get("included_path"):
            candidates.append(ROOT / "database" / item["included_path"])
        path = next((p for p in candidates if p.is_file() and sha256(p) == item["sha256"]), None)
        if path is None:
            errors.append({"id": key, "error": "Chưa có PDF khớp manifest; chạy database/scripts/fetch_sources.py."})
            continue
        details = inspect_document(path)
        rows.append({
            "id": key, "title": info["title"], "document_form": info["document_form"],
            "publisher": info["source"]["publisher"], "source_url": info["source"]["url"],
            "file_url": item["url"], "local_path": str(path.relative_to(ROOT)),
            "original_name": info["file"]["original_name"], "sha256": item["sha256"],
            "byte_size": path.stat().st_size, "retrieved_at": info["source"]["retrieved_at"],
            "database_file_id": item["file_id"], "verification": info["verification_note"],
            "label_origin": "existing_public_manifest", "label_review_status": "needs_review", **details,
        })
    return rows, errors


def main():
    prepare_dirs()
    (DATA / "documents").mkdir(exist_ok=True)
    manifest_path = DATA / "manifest.json"
    previous = json.loads(manifest_path.read_text())["documents"] if manifest_path.exists() else []
    previous = {r["id"]: r for r in previous}
    rows, errors = existing_public_samples()
    sources = json.loads((DATA / "public_sources.json").read_text())
    with ThreadPoolExecutor(max_workers=4) as pool:
        for record, error in pool.map(lambda row: fetch_one(row, previous), sources):
            if error:
                errors.append(error)
                print("FAILED", error["id"], error["error"], flush=True)
            else:
                rows.append(record)
                print("OK", record["id"], record["page_count"], "trang", flush=True)
    # Avoid duplicate file content in the selectable test corpus.
    unique = {r["sha256"]: r for r in reversed(rows)}
    rows = sorted(unique.values(), key=lambda row: row["id"])
    summary = {
        "document_count": len(rows), "page_count": sum(r["page_count"] for r in rows),
        "byte_size": sum(r["byte_size"] for r in rows), "publishers": dict(Counter(r["publisher"] for r in rows)),
        "document_forms": dict(Counter(r["document_form"] for r in rows)),
    }
    atomic_json(manifest_path, {"created_at": datetime.now(timezone.utc).isoformat(),
                "purpose": "Thử nghiệm local bằng tài liệu công khai; nhãn nguồn chưa phải bộ chuẩn đánh giá AI.",
                "summary": summary, "documents": rows})
    atomic_json(DATA / "download_report.json", {"errors": errors, "summary": summary})
    for row in rows:
        render_page(row, 1)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if errors:
        print(f"Có {len(errors)} nguồn không tải được; xem data/sam3/download_report.json.")


if __name__ == "__main__":
    main()
