#!/usr/bin/env python3
"""Build reproducible, raster-only handwriting fixtures for EVERY catalogue type.

Synthetic font strokes, not actual human handwriting. The answer key is separate
from PDFs and never passed to the extraction worker. Originals are not modified.
Run with /Volumes/quocDisk/AI/document-samples/venv/bin/python.
"""
import argparse
import base64
import hashlib
import html
import json
import os
from pathlib import Path
import random
import re
import sys

import pymupdf
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from document_ai.classify import catalog

DATA = ROOT / "data/filled-samples"
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/Volumes/quocDisk/AI/sam3/cache/playwright")


def write_json(path, value):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(path)


# Every value is invented. TEST identifiers deliberately cannot be mistaken for
# issued identification numbers. Related vehicle forms use the same people/asset.
VALUES = {
    "Người ký": "Nguyễn Minh Quân", "Ngày ban hành/lập": "12/11/2026",
    "Ngày, giờ lập": "09 giờ 30 phút, ngày 12/11/2026", "Địa điểm": "Phòng họp số 2, phường Minh Họa",
    "Thành phần tham gia": "Nguyễn Minh Quân; Trần Thị Hà; Lê Văn Bình",
    "Tài liệu liên quan": "Kế hoạch số 12/KH-TEST ngày 10/11/2026",
    "Kỳ lập": "Tháng 11/2026", "Số thứ tự dòng": "01", "Đối tượng hoặc mã mục": "TEST-DT-001",
    "Giá trị từng cột": "Số lượng: 12; đã hoàn thành: 9; đang xử lý: 3",
    "Ngày lập": "12/11/2026", "Giấy tờ kèm theo": "Bản kê thông tin; tài liệu đối chiếu TEST-001",
    "Loại yêu cầu": "Tiếp nhận và kiểm tra hồ sơ", "Người đề nghị": "Nguyễn Thị Mai",
    "Người tiếp nhận": "Trần Thị Hà", "Năm/quyển sổ": "2026 / Quyển 02", "Số thứ tự đăng ký": "015",
    "Ngày đăng ký": "12/11/2026", "Số trang": "15", "Ngày chứng từ": "12/11/2026",
    "Bên thu/chi": "Bên chi: Lê Văn Bình; bên thu: Nguyễn Minh Quân",
    "Nội dung thanh toán": "Thanh toán vật tư văn phòng tháng 11/2026", "Số tiền": "2.450.000",
    "Đơn vị tiền tệ": "VND", "Ngày ký": "12/11/2026",
    "Các bên ký kết": "Bên A: Nguyễn Minh Quân; bên B: Lê Văn Bình",
    "Giá trị": "25.000.000 đồng", "Thời hạn thực hiện": "Từ 12/11/2026 đến 12/12/2026",
    "Vị trí hoặc công trình": "Nhà sinh hoạt số 3, phường Minh Họa", "Tỷ lệ nếu có": "1/500",
    "Ngày lập/chụp": "12/11/2026", "Số tờ": "01",
    "Người để lại di sản": "Nguyễn Văn An", "Ngày mất": "15/02/2025",
    "Quan hệ với người để lại di sản": "Con ruột", "Giấy chứng tử": "TEST-CT-015, cấp ngày 17/02/2025",
    "Mô tả di sản": "Thửa đất 128, tờ bản đồ 09, diện tích 120,5 m² tại 18 đường Mẫu, phường Minh Họa",
    "Số giấy chứng nhận": "TEST-GCN-001", "Số thửa đất": "128", "Số tờ bản đồ": "09",
    "Diện tích đất": "120,5 m²", "Địa chỉ thửa đất": "18 đường Mẫu, phường Minh Họa",
    "Giấy tờ định danh người đề nghị": "TEST-TK-01", "Địa chỉ người đề nghị": "18 đường Mẫu, phường Minh Họa",
    "Ngày sinh người đề nghị": "21/04/1990", "Người đề nghị nhận thừa kế": "Nguyễn Thị Mai",
    "Người đồng thừa kế": "Nguyễn Văn Minh", "Căn cứ thừa kế": "Quan hệ cha con theo giấy khai sinh TEST-KS-01",
    "Người tường trình": "Nguyễn Thị Mai", "Giấy tờ định danh người tường trình": "TEST-TK-01",
    "Địa chỉ người tường trình": "18 đường Mẫu, phường Minh Họa",
    "Cha mẹ người để lại di sản": "Cha: Nguyễn Văn Đức, mất năm 2000; mẹ: Lê Thị Sen, mất năm 2008",
    "Vợ hoặc chồng người để lại di sản": "Trần Thị Lan, mất ngày 20/06/2020",
    "Các con của người để lại di sản": "Nguyễn Thị Mai; Nguyễn Văn Minh",
    "Địa chỉ bất động sản": "18 đường Mẫu, phường Minh Họa",
    "Người lập di chúc": "Phạm Văn Phúc", "Ngày sinh": "10/02/1960",
    "Giấy tờ định danh người lập di chúc": "TEST-DC-01", "Địa chỉ người lập di chúc": "56 đường Mẫu, phường Minh Họa",
    "Người hưởng di sản": "Phạm Thị Ngọc", "Nội dung phân chia di sản": "Phạm Thị Ngọc được hưởng toàn bộ di sản nêu trên",
    "Người làm chứng": "Đỗ Văn Sơn; Vũ Thị Hạnh", "Người quản lý di sản": "Phạm Thị Ngọc",
    "Người nhận di sản": "Nguyễn Thị Mai", "Giấy tờ định danh người nhận di sản": "TEST-TK-01",
    "Bên chuyển nhượng": "Nguyễn Văn Thành", "Giấy tờ định danh bên chuyển nhượng": "TEST-DAT-A",
    "Địa chỉ bên chuyển nhượng": "18 đường Mẫu, phường Minh Họa",
    "Bên nhận chuyển nhượng": "Lê Văn Bình", "Giấy tờ định danh bên nhận chuyển nhượng": "TEST-DAT-B",
    "Địa chỉ bên nhận chuyển nhượng": "25 đường Thử Nghiệm, phường Minh Họa",
    "Giá chuyển nhượng": "850.000.000 đồng", "Phương thức thanh toán": "Chuyển khoản một lần",
    "Ngày lập hợp đồng": "10/11/2026", "Tên chủ xe": "Trần Văn Hòa",
    "Địa chỉ chủ xe": "30 đường Mẫu, phường Minh Họa", "Mã định danh chủ xe": "TEST-XE-A",
    "Người làm thủ tục": "Trần Văn Hòa", "Loại đăng ký": "Đăng ký sang tên xe",
    "Biển số cũ": "TEST-001", "Biển số mới": "TEST-002", "Biển số xe": "TEST-001",
    "Nhãn hiệu": "HONDA", "Số loại": "VISION", "Loại xe": "Mô tô hai bánh", "Màu sơn": "Đỏ đen",
    "Số máy": "TESTMAY000123", "Số khung": "TESTKHUNG00456", "Ngày kê khai": "12/11/2026",
    "Lý do thu hồi": "Chuyển quyền sở hữu xe", "Chủ xe mới": "Lê Thị Thu",
    "Địa chỉ chủ xe mới": "42 đường Thử Nghiệm, phường Minh Họa",
    "Bên bán xe": "Trần Văn Hòa", "Giấy tờ định danh bên bán": "TEST-XE-A",
    "Địa chỉ bên bán": "30 đường Mẫu, phường Minh Họa", "Bên mua xe": "Lê Thị Thu",
    "Giấy tờ định danh bên mua": "TEST-XE-B", "Địa chỉ bên mua": "42 đường Thử Nghiệm, phường Minh Họa",
    "Số giấy đăng ký xe": "TEST-DKX-001", "Giá mua bán": "25.000.000 đồng",
}


def value_for(label, category, doc_type, sequence):
    dynamic = {
        "Số/ký hiệu nếu có": f"{sequence:03d}/TEST", "Số chứng từ": f"TEST-CT-{sequence:03d}",
        "Số hợp đồng": f"TEST-HD-{sequence:03d}",
        "Cơ quan ban hành/lập": "Đơn vị mô phỏng phường Minh Họa", "Đơn vị lập": "Đơn vị mô phỏng phường Minh Họa",
        "Trích yếu hoặc nội dung chính": f"{doc_type['name']} về {category['title'].lower()} tại phường Minh Họa",
        "Nội dung, kết quả": f"Đã kiểm tra 12 hồ sơ về {category['title'].lower()}; 9 hồ sơ đủ thông tin, 3 hồ sơ cần bổ sung",
        "Nội dung đề nghị": f"Đề nghị tiếp nhận {doc_type['name'].lower()} và kiểm tra giấy tờ kèm theo",
        "Tên bảng/danh sách": doc_type["name"], "Tên sổ": doc_type["name"], "Tên bản vẽ/ảnh": doc_type["name"],
        "Đối tượng hoặc trích yếu": f"Hồ sơ TEST-{sequence:03d} của Nguyễn Thị Mai",
        "Nội dung hợp đồng": f"Thực hiện {doc_type['name'].lower()} tại phường Minh Họa",
    }
    if label in dynamic:
        return dynamic[label]
    if label in VALUES:
        value = VALUES[label]
        if doc_type["id"] == "U27-D12":
            value = {"Tên chủ xe": "Lê Thị Thu", "Địa chỉ chủ xe": VALUES["Địa chỉ chủ xe mới"],
                     "Mã định danh chủ xe": "TEST-XE-B", "Người làm thủ tục": "Lê Thị Thu"}.get(label, value)
        if doc_type["id"] == "U09-D13" and label == "Mô tả di sản":
            value = "Nhà và đất 90 m² tại 56 đường Mẫu, phường Minh Họa; giấy chứng nhận TEST-GCN-DC01"
        if doc_type["id"] != "U09-D13" and label == "Nội dung phân chia di sản":
            value = "Nguyễn Thị Mai và Nguyễn Văn Minh mỗi người nhận một nửa di sản"
        if doc_type["id"].startswith("U27-") and label == "Giấy tờ kèm theo":
            value = "Đăng ký xe TEST-DKX-001; biển số TEST-001; hợp đồng mua bán ngày 10/11/2026"
        return value
    # Detailed personal subfields appended to the catalogue, preserving old labels.
    if label == "Ngày sinh người tường trình":
        return "21/04/1990"
    if label == "Ngày sinh chủ xe mới" or (label == "Ngày sinh chủ xe" and doc_type["id"] == "U27-D12"):
        return "22/08/1988"
    if label.startswith("Ngày sinh"):
        return "15/03/1982" if any(s in label for s in ("bán", "chuyển nhượng", "chủ xe")) and "nhận" not in label else "22/08/1988"
    if label.startswith("Ngày cấp"):
        return "12/05/2020"
    if label.startswith("Nơi cấp"):
        return "Cơ quan cấp giấy tờ mô phỏng"
    if label.startswith("Số điện thoại"):
        return "0000000000"
    if label.startswith("Ngày sinh người đồng"):
        return "17/09/1993"
    raise ValueError(f"Chưa có dữ liệu giả lập cho trường {label!r}")


def document_html(category, doc_type, values, font):
    rng = random.Random(doc_type["id"])
    def handwriting(value):
        words = []
        for word in value.split():
            style = f"transform:translateY({rng.uniform(-0.7,0.7):.2f}px) rotate({rng.uniform(-1.6,1.6):.2f}deg);opacity:{rng.uniform(.88,1):.2f}"
            words.append(f'<span style="{style}">{html.escape(word)}</span>')
        return " ".join(words)
    groups = doc_type.get("fieldGroups") or [{"title": "Thông tin kê khai", "fields": doc_type["fields"]}]
    sections = []
    for group in groups:
        fields = ''.join(f'<div class="field"><div class="label">{html.escape(label)}</div><div class="value">{handwriting(values[label])}</div></div>' for label in group["fields"])
        sections.append(f'<section><h2>{html.escape(group["title"])}</h2><div class="grid">{fields}</div></section>')
    return f'''<!doctype html><html lang="vi"><meta charset="utf-8"><style>
    @font-face{{font-family:Hand;src:url(data:font/ttf;base64,{font})}}
    @page{{size:A4;margin:16mm 17mm}}*{{box-sizing:border-box}}body{{margin:0;color:#171717;font:13px/1.3 "Times New Roman",serif}}
    .banner{{font:10px Arial;color:#8c2e26;border-bottom:1px solid #ccc;padding-bottom:7px}}header{{text-align:center;margin:17px 0}}
    h1{{font-size:18px;margin:16px 0 7px;text-transform:uppercase}}h2{{font-size:13px;margin:13px 0 6px;border-bottom:1px solid #bbb;padding-bottom:4px}}
    .topic{{font-size:11px}}.grid{{display:grid;grid-template-columns:1fr 1fr;gap:7px 18px}}.field{{break-inside:avoid;min-width:0}}
    .label{{font-size:12px}}.value{{font:19px/1.22 Hand;color:#183f83;border-bottom:1px dotted #aaa;min-height:26px;padding:2px 0 4px;overflow-wrap:anywhere}}
    .value span{{display:inline-block}}section{{break-inside:auto}}h2{{break-after:avoid}}footer{{margin-top:18px;font-size:10px;color:#666}}
    </style><body><div class="banner">DỮ LIỆU GIẢ LẬP · MẪU KIỂM THỬ OCR · KHÔNG PHẢI HỒ SƠ THẬT</div>
    <header><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b>Độc lập – Tự do – Hạnh phúc</b>
    <h1>{html.escape(doc_type['name'])}</h1><div class="topic">Nội dung công việc: {html.escape(category['title'])}</div></header>
    {''.join(sections)}<footer>Thông tin được tạo giả lập để kiểm tra nhập liệu. Chưa ký, chưa xác nhận.<br>
    Bố cục kiểm thử dẫn xuất từ danh mục; không thay thế biểu mẫu chính thức.</footer></body></html>'''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--types", nargs="*")
    args = parser.parse_args()
    for folder in ("pdf", "sources", "previews"):
        (DATA / folder).mkdir(parents=True, exist_ok=True)
    font = base64.b64encode((ROOT / "data/citizen-samples/fonts/PatrickHand-Regular.ttf").read_bytes()).decode()
    rows, answers, inventory = [], {}, []
    existing = json.loads((DATA / "manifest.json").read_text())["documents"] if (DATA / "manifest.json").exists() else []
    existing_answers = json.loads((DATA / "answers.json").read_text()) if (DATA / "answers.json").exists() else {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.route("http://**/*", lambda r: r.abort())
        page.route("https://**/*", lambda r: r.abort())
        sequence = 0
        for category in catalog():
            for doc_type in category["documentTypes"]:
                sequence += 1
                identity = "filled-" + doc_type["id"].lower()
                inventory.append({"category": category["code"], "group": category["title"], "type_id": doc_type["id"], "name": doc_type["name"], "field_count": len(doc_type["fields"]), "document_id": identity})
                if args.types and doc_type["id"] not in args.types:
                    continue
                values = {f: value_for(f, category, doc_type, sequence) for f in doc_type["fields"]}
                markup = document_html(category, doc_type, values, font)
                (DATA / "sources" / f"{identity}.html").write_text(markup)
                page.set_content(markup)
                page.evaluate("document.fonts.ready")
                vector = page.pdf(print_background=True, prefer_css_page_size=True)
                destination = DATA / "pdf" / f"{identity}.pdf"
                with pymupdf.open(stream=vector, filetype="pdf") as source, pymupdf.open() as scan:
                    for i, original in enumerate(source):
                        bitmap = original.get_pixmap(dpi=170)
                        if doc_type["id"] in {"U27-D14", "U27-D12", "U27-D13", "U15-D14", "U09-D11", "U09-D12", "U09-D13"}:
                            bitmap.save(DATA / "previews" / f"{identity}-p{i+1}.png")
                        sheet = scan.new_page(width=original.rect.width, height=original.rect.height)
                        sheet.insert_image(sheet.rect, stream=bitmap.tobytes("png"))
                    scan.set_metadata({"title": doc_type["name"] + " — GIẢ LẬP", "subject": "Synthetic handwriting font; OCR test only"})
                    scan.save(destination, deflate=True)
                    count = len(scan)
                digest = hashlib.sha256(destination.read_bytes()).hexdigest()
                rows.append({"id": identity, "title": f"{doc_type['name']} · {category['code']} · đã điền giả lập", "dataset": "filled-catalog-v1",
                             "sample_kind": "synthetic_filled_handwriting", "publisher": "Bộ mẫu giả lập local", "document_form": doc_type["name"],
                             "suggested_work_group": category["code"], "expected_type_id": doc_type["id"], "page_count": count,
                             "local_path": str(destination.relative_to(ROOT)), "media_type": "application/pdf", "byte_size": destination.stat().st_size,
                             "sha256": digest, "original_name": destination.name, "label_review_status": "synthetic",
                             "verification": "Dữ liệu giả; chữ mô phỏng bằng font có biến thiên nét. Không phải chữ viết tay người thật hay mẫu chính thức."})
                answers[identity] = {"expected_type_id": doc_type["id"], "expected_fields": values, "source_sha256": digest}
                if sequence % 50 == 0:
                    print(f"Đã tạo {sequence} loại", flush=True)
        browser.close()
    replaced = {r["id"] for r in rows}
    rows = [r for r in existing if r["id"] not in replaced] + rows
    write_json(DATA / "manifest.json", {"dataset": "filled-catalog-v1", "documents": rows})
    write_json(DATA / "answers.json", {**existing_answers, **answers})
    write_json(DATA / "inventory.json", inventory)
    (DATA / "inventory.csv").write_text("Mã nhóm,Mã loại,Tên giấy tờ,Số trường,PDF\n" + "\n".join(
        ','.join('"' + str(v).replace('"','""') + '"' for v in [r['category'],r['type_id'],r['name'],r['field_count'],r['document_id']+'.pdf']) for r in inventory), encoding="utf-8-sig")
    print(f"Hoàn tất: {len(rows)} PDF, {sum(r['page_count'] for r in rows)} trang; danh mục {len(inventory)} loại.")


if __name__ == "__main__":
    main()
