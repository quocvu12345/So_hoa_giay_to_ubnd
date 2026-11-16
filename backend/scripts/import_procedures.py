#!/usr/bin/env python3
"""Nạp thủ tục hành chính cấp xã từ data/official-forms vào PostgreSQL (migration 011). CHẠY LẠI ĐƯỢC.

  python import_procedures.py --database-url postgresql://quoc@127.0.0.1:5432/hoso_dev \
      [--source ../../data/official-forms] [--storage-root ../../data/blobs]

Nạp: procedures (861 mục), procedure_lifecycle_events (32), paper_types, procedure_components, form_templates và liên kết thành phần↔mẫu.
Tệp mẫu được sao vào kho tệp theo mã băm (blobs/ab/cd/<sha256>), đúng bố cục API dùng, sau khi kiểm SHA-256 khớp với danh mục nguồn.
Chạy lại: xóa và nạp lại thành phần, liên kết, lịch sử hiệu lực; thủ tục, loại giấy và mẫu cập nhật theo khóa. Không đụng tới hồ sơ hay giấy tờ.
Cần: pip install 'psycopg[binary]'
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import uuid
from collections import defaultdict
from pathlib import Path

KIND = {"blank_form": "blank_form", "procedure_pdf": "guide_pdf", "electronic_form": "eform_json"}
LIFECYCLE = {"repealed": "repealed", "replaced": "replaced", "repealed_for_period": "repealed"}   # "bãi bỏ trong một giai đoạn": cảnh báo như bãi bỏ


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lstrip("-•").strip()).casefold()


def load(source: Path) -> dict:
    read = lambda name: json.loads((source / name).read_text(encoding="utf-8"))
    return {"library": read("library.json"), "components": read("components.json"), "papers": read("papers.json"),
            "files": read("files.json"), "lifecycle": read("lifecycle.json")}


def import_data(conn, data: dict, source: Path, storage_root: Path | None, log=print) -> dict:
    stats: dict[str, int] = defaultdict(int)
    entries = data["library"]["entries"]
    lifecycle = {x["procedure_code"]: LIFECYCLE.get(x["status"], "unverified") for x in data["lifecycle"]}

    with conn.transaction():
        cur = conn.cursor()
        # --- thủ tục ---
        for e in entries:
            detail = (e.get("details") or [{}])[0] if e.get("details") else {}
            status = lifecycle.get(e["procedure_code"]) or ("unverified" if e.get("status") == "missing_detail" else "active")
            cur.execute("""
                INSERT INTO hoso.procedures(id, procedure_code, name, domain, managing_agency, execution_level, competent_authority, fees, receiving_location,
                  ministry_decision, hanoi_decision, workflow_decision, delegation_decision, delegation_expiry, source_url, source_page, lifecycle_status, collected_at)
                VALUES (%(id)s,%(code)s,%(name)s,%(domain)s,%(agency)s,%(level)s,%(authority)s,%(fees)s,%(place)s,%(m)s,%(h)s,%(w)s,%(d)s,%(dx)s,%(url)s,%(page)s,%(status)s,%(at)s)
                ON CONFLICT (id) DO UPDATE SET procedure_code=EXCLUDED.procedure_code, name=EXCLUDED.name, domain=EXCLUDED.domain, managing_agency=EXCLUDED.managing_agency,
                  execution_level=EXCLUDED.execution_level, competent_authority=EXCLUDED.competent_authority, fees=EXCLUDED.fees, receiving_location=EXCLUDED.receiving_location,
                  ministry_decision=EXCLUDED.ministry_decision, hanoi_decision=EXCLUDED.hanoi_decision, workflow_decision=EXCLUDED.workflow_decision,
                  delegation_decision=EXCLUDED.delegation_decision, delegation_expiry=EXCLUDED.delegation_expiry, source_url=EXCLUDED.source_url,
                  source_page=EXCLUDED.source_page, lifecycle_status=EXCLUDED.lifecycle_status, collected_at=EXCLUDED.collected_at""",
                {"id": e["id"], "code": e["procedure_code"], "name": e["name"], "domain": e.get("domain"), "agency": e.get("managing_agency"),
                 "level": e.get("execution_level"), "authority": e.get("competent_authority"), "fees": e.get("fees"), "place": e.get("receiving_location"),
                 "m": e.get("ministry_decision"), "h": e.get("hanoi_decision"), "w": e.get("workflow_decision"), "d": e.get("delegation_decision"),
                 "dx": e.get("delegation_expiry"), "url": detail.get("source_url") or e.get("inventory_source_url"), "page": e.get("source_page"),
                 "status": status, "at": e.get("checked_at")})
            stats["procedures"] += 1

        # --- lịch sử hiệu lực (nạp lại toàn bộ) ---
        cur.execute("DELETE FROM hoso.procedure_lifecycle_events")
        for x in data["lifecycle"]:
            cur.execute("INSERT INTO hoso.procedure_lifecycle_events(procedure_code, status, label, note, evidence, effective_from, reviewed_on) VALUES (%s,%s,%s,%s,%s::jsonb,%s,%s)",
                        (x["procedure_code"], LIFECYCLE.get(x["status"], "unverified"), x["label"], x.get("note", ""), json.dumps(x.get("evidence", []), ensure_ascii=False),
                         x.get("effective_from"), x.get("reviewed_on")))
            stats["lifecycle_events"] += 1

        # --- loại giấy ---
        for p in data["papers"]:
            names = p.get("names") or [p["code"]]
            cur.execute("INSERT INTO hoso.paper_types(code, canonical_name, names) VALUES (%s,%s,%s::jsonb) ON CONFLICT (code) DO UPDATE SET canonical_name=EXCLUDED.canonical_name, names=EXCLUDED.names",
                        (p["code"], names[0], json.dumps(names, ensure_ascii=False)))
            stats["paper_types"] += 1
        known_papers = {p["code"] for p in data["papers"]}

        # --- thành phần (nạp lại). Nguồn đầy đủ là chi tiết từng mục (5.596 dòng); components.json chỉ có phần Hà Nội nên chỉ dùng làm dự phòng. ---
        cur.execute("DELETE FROM hoso.procedure_components")
        cur.execute("DELETE FROM hoso.procedure_templates")
        fallback: dict[str, list[dict]] = defaultdict(list)
        for c in data["components"]:
            fallback[c["procedure_code"]].append(c)
        component_ids: dict[tuple[str, str], list[tuple[str, str]]] = defaultdict(list)   # (procedure_id, tên chuẩn hóa) → [(id, mục)]
        for e in entries:
            rows = next((d["components"] for d in (e.get("details") or []) if d.get("components")), None) or fallback.get(e["procedure_code"], [])
            if not rows:
                stats["procedures_without_components"] += 1
            for c in rows:
                cid = str(uuid.uuid4())
                paper = c.get("component_code") if c.get("component_code") in known_papers else None
                cur.execute("""INSERT INTO hoso.procedure_components(id, procedure_id, section, position, name, paper_code, original_quantity, copy_quantity, required_as_published, has_electronic_form)
                               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                            (cid, e["id"], c.get("section") or "", c["position"], c["name"], paper, c.get("original_quantity") or 0, c.get("copy_quantity") or 0,
                             bool(c.get("required_as_published")), bool(c.get("has_electronic_form"))))
                component_ids[(e["id"], norm(c["name"]))].append((cid, c.get("section") or ""))
                stats["components"] += 1

        # --- mẫu biểu: sao vào kho theo mã băm, lưu một dòng cho mỗi nội dung khác nhau ---
        template_ids: dict[str, str] = {}
        for f in data["files"]:
            if f.get("status") != "downloaded" or not f.get("sha256"):
                stats["files_not_available"] += 1
                continue
            path = source / f["local_path"]
            if not path.is_file():
                stats["files_missing_on_disk"] += 1
                continue
            sha = f["sha256"].lower()
            if sha in template_ids:
                continue
            storage_key = None
            if storage_root is not None:
                actual = hashlib.sha256(path.read_bytes()).hexdigest()
                if actual != sha:
                    stats["files_hash_mismatch"] += 1
                    log(f"  ! mã băm không khớp, bỏ qua: {f['filename']}")
                    continue
                storage_key = f"blobs/{sha[:2]}/{sha[2:4]}/{sha}"
                target = storage_root.joinpath(*storage_key.split("/"))
                if not target.exists():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(path, target)
                    stats["blobs_copied"] += 1
            tid = str(uuid.uuid4())
            cur.execute("""INSERT INTO hoso.form_templates(id, kind, filename, sha256, byte_size, media_type, storage_key, source_url)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                           ON CONFLICT (sha256) DO UPDATE SET filename=EXCLUDED.filename, storage_key=coalesce(EXCLUDED.storage_key, hoso.form_templates.storage_key)
                           RETURNING id""",
                        (tid, KIND.get(f["kind"], "blank_form"), f["filename"], sha, f.get("bytes") or path.stat().st_size, f.get("media_type") or "application/octet-stream",
                         storage_key, next((r.get("source_url") for r in f.get("references", []) if isinstance(r, dict) and r.get("source_url")), None)))
            template_ids[sha] = str(cur.fetchone()[0])
            stats["form_templates"] += 1

        # --- liên kết thành phần ↔ mẫu (khớp theo tên thành phần trong cùng thủ tục) ---
        linked: set[tuple[str, str]] = set()
        linked_procedures: set[tuple[str, str]] = set()
        procedure_ids = {e["id"] for e in entries}
        for f in data["files"]:
            sha = (f.get("sha256") or "").lower()
            if sha not in template_ids:
                continue
            for ref in f.get("references", []):
                if isinstance(ref, str):           # PDF hướng dẫn / biểu mẫu điện tử: tham chiếu là mã thủ tục, gắn với cả thủ tục
                    if ref in procedure_ids and (ref, template_ids[sha]) not in linked_procedures:
                        linked_procedures.add((ref, template_ids[sha]))
                        cur.execute("INSERT INTO hoso.procedure_templates(procedure_id, template_id) VALUES (%s,%s) ON CONFLICT DO NOTHING", (ref, template_ids[sha]))
                        stats["procedure_template_links"] += 1
                    continue
                matches = component_ids.get((ref.get("procedure_id"), norm(ref.get("component", ""))), [])
                section_matches = [m for m in matches if m[1] == (ref.get("section") or "")] or matches
                if not section_matches:
                    stats["links_unmatched"] += 1
                    continue
                for cid, _ in section_matches:
                    if (cid, template_ids[sha]) not in linked:
                        linked.add((cid, template_ids[sha]))
                        cur.execute("INSERT INTO hoso.procedure_component_templates(component_id, template_id) VALUES (%s,%s) ON CONFLICT DO NOTHING", (cid, template_ids[sha]))
                        stats["component_template_links"] += 1
    return dict(stats)


def main() -> int:
    import psycopg

    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--database-url", required=True)
    parser.add_argument("--source", type=Path, default=here.parents[1] / "data/official-forms")
    parser.add_argument("--storage-root", type=Path, default=here.parents[1] / "data/blobs", help="Thư mục gốc của Storage:Root; đặt 'none' để không sao tệp")
    args = parser.parse_args()
    storage = None if str(args.storage_root) == "none" else args.storage_root
    data = load(args.source)
    with psycopg.connect(args.database_url) as conn:
        stats = import_data(conn, data, args.source, storage)
    for key, value in sorted(stats.items()):
        print(f"{key:32} {value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
