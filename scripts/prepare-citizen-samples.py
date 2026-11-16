#!/usr/bin/env python3
"""Prepare PDF test fixtures from attributed public templates. No model is called.

Run with the sample-tools venv; see data/citizen-samples/README.md.
Public Word originals are retained. Converted PDFs are explicitly derivatives.
Synthetic handwriting uses a font and MUST NOT be scored as real handwriting.
"""
import base64
import hashlib
import html
import json
import os
from pathlib import Path
import shutil
import subprocess

from bs4 import BeautifulSoup
import pymupdf
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/citizen-samples"
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/Volumes/quocDisk/AI/sam3/cache/playwright")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def info(path):
    with pymupdf.open(path) as pdf:
        assert len(pdf) > 0
        return {"page_count": len(pdf), "first_page_size_pt": list(pdf[0].rect)[2:],
                "byte_size": path.stat().st_size, "sha256": digest(path),
                "local_path": str(path.relative_to(ROOT)), "media_type": "application/pdf"}


def render_html(browser, content, destination):
    page = browser.new_page()
    # The document and fonts are local; never fetch remote resources while converting.
    page.route("http://**/*", lambda route: route.abort())
    page.route("https://**/*", lambda route: route.abort())
    page.set_content(content)
    page.evaluate("document.fonts.ready")
    page.pdf(path=str(destination), format="A4", print_background=True,
             margin={"top": "12mm", "right": "15mm", "bottom": "12mm", "left": "15mm"})
    page.close()


def markup(path):
    text = path.read_text().replace("\x00", "")
    css = "<style>body{margin:0}table{max-width:100%}p{overflow-wrap:break-word} @page{size:A4}</style>"
    return text.replace("</head>", css + "</head>")


def fill_form(content, replacements):
    """Replace specific template paragraphs, asserting each printed label exists."""
    soup = BeautifulSoup(content, "html.parser")
    paragraphs = soup.select("body p")
    for index, expected_prefix, parts in replacements:
        p = paragraphs[index]
        assert p.get_text(" ", strip=True).startswith(expected_prefix), (index, expected_prefix)
        p.clear()
        for text, handwritten in parts:
            span = soup.new_tag("span")
            span.string = text
            if handwritten:
                span["class"] = "filled-hand"
            p.append(span)
    banner = soup.new_tag("p")
    banner["style"] = "font:11px Arial;color:#9a2525;border-bottom:1px solid;padding:6px 0"
    banner.string = "DỮ LIỆU GIẢ LẬP — chữ điền bằng font mô phỏng viết tay; không phải hồ sơ thật."
    soup.body.insert(0, banner)
    font = base64.b64encode((DATA / "fonts/PatrickHand-Regular.ttf").read_bytes()).decode()
    style = soup.new_tag("style")
    style.string = (f"@font-face{{font-family:HandSample;src:url(data:font/ttf;base64,{font})}}"
                    ".filled-hand{font:19px HandSample!important;color:#153e8a;padding:0 3px}"
                    "p:has(.filled-hand){line-height:1.35}")
    soup.head.append(style)
    return str(soup)


def line(index, prefix, *parts):
    return index, prefix, [(part, bool(i % 2)) for i, part in enumerate(parts)]


SCENARIOS = [
    ("citizen-land-contract", "citizen-land-hand-sim", "Chuyển nhượng đất — mô phỏng điền tay", [
        line(16, "- Họ tên ông", "- Họ tên ông: ", "Nguyễn Văn An"),
        line(17, "Sinh năm", "Sinh năm: ", "1970"),
        line(18, "Chứng minh", "Chứng minh nhân dân: ", "TEST-DAT-A"),
        line(22, "Thường trú", "Thường trú: ", "12 đường Mẫu, phường Minh Họa"),
        line(33, "Giấy chứng nhận", "Giấy chứng nhận quyền sử dụng đất số: ", "TEST-GCN-001"),
        line(46, "- Họ tên ông", "- Họ tên ông: ", "Lê Văn Bình"),
        line(47, "Sinh năm", "Sinh năm: ", "1985"),
        line(48, "Chứng minh", "Chứng minh nhân dân: ", "TEST-DAT-B"),
        line(52, "Thường trú", "Thường trú: ", "25 đường Thử Nghiệm, phường Minh Họa"),
        line(66, "- - Thửa số", "Thửa số: ", "128", " — Tờ bản đồ số: ", "09"),
        line(67, "- Địa chỉ", "Địa chỉ thửa đất: ", "12 đường Mẫu, phường Minh Họa"),
        line(68, "- Diện tích", "Diện tích: ", "120,5 m²"),
        line(71, "- Mục đích", "Mục đích sử dụng đất: ", "Đất ở"),
        line(76, "Giá chuyển", "Giá chuyển nhượng quyền sử dụng đất nêu trên là: ", "850.000.000 đồng"),
    ], {"Bên chuyển nhượng": "Nguyễn Văn An", "Bên nhận chuyển nhượng": "Lê Văn Bình",
        "Số thửa đất": "128", "Số tờ bản đồ": "09", "Diện tích đất": "120,5 m²",
        "Số giấy chứng nhận": "TEST-GCN-001", "Giá chuyển nhượng": "850.000.000 đồng"}),
    ("citizen-inheritance-kinship", "citizen-inheritance-hand-sim", "Thừa kế — mô phỏng điền tay quan hệ nhân thân", [
        line(12, "*", "* Tôi tên là: ", "Nguyễn Thị Mai", " — năm sinh: ", "1990"),
        line(13, "Giấy CMND", "Giấy CMND số: ", "TEST-TK-01", " — cấp ngày: ", "12/05/2020"),
        line(14, "Hiện thường", "Hiện thường trú: ", "18 đường Mẫu, phường Minh Họa"),
        line(15, "Là", "Là: ", "con", " của Ông (A): ", "Nguyễn Văn An", " — chết ngày: ", "15/02/2025"),
        line(16, "Và Bà", "Và Bà (B): ", "Trần Thị Lan", " — tình trạng: ", "còn sống"),
        line(30, "II.", "II. Ông (A) ", "Nguyễn Văn An", " và Bà (B) ", "Trần Thị Lan", " có ", "2", " người con có tên sau:"),
        line(31, "1.", "1. Họ tên: ", "Nguyễn Thị Mai", " — Năm sanh: ", "1990"),
        line(33, "2.", "2. Họ tên: ", "Nguyễn Văn Minh", " — Năm sanh: ", "1993"),
    ], {"Người tường trình": "Nguyễn Thị Mai", "Người để lại di sản": "Nguyễn Văn An",
        "Ngày mất": "15/02/2025", "Quan hệ với người để lại di sản": "con",
        # Two people having children together does not prove a spousal relationship.
        "Vợ hoặc chồng người để lại di sản": "",
        "Các con của người để lại di sản": "Nguyễn Thị Mai; Nguyễn Văn Minh"}),
    ("citizen-vehicle-recall", "citizen-vehicle-hand-sim", "Sang tên xe — mô phỏng điền tay ĐKX11", [
        line(8, "BIỂN SỐ", "BIỂN SỐ: ", "TEST-001", " — Màu biển: ", "Trắng"),
        line(9, "Tên chủ xe", "Tên chủ xe: ", "Trần Văn Hòa"),
        line(10, "Địa chỉ", "Địa chỉ: ", "30 đường Mẫu, phường Minh Họa"),
        line(11, "Mã định danh", "Mã định danh: ", "TEST-XE-A", " — Loại giấy tờ: ", "Căn cước"),
        line(13, "Người làm", "Người làm thủ tục: ", "Trần Văn Hòa"),
        line(17, "Lý do", "Lý do thu hồi: ", "Chuyển quyền sở hữu xe"),
        line(18, "Sang tên", "Sang tên cho chủ xe mới (nếu có): ", "Lê Thị Thu"),
        line(19, "Địa chỉ", "Địa chỉ: ", "42 đường Thử Nghiệm, phường Minh Họa"),
        line(20, "Mã đinh", "Mã định danh: ", "TEST-XE-B"),
        line(22, "Nhãn hiệu", "Nhãn hiệu: ", "HONDA", " — Số loại: ", "VISION"),
        line(23, "Loại xe", "Loại xe: ", "Mô tô hai bánh", " — Dung tích: ", "110 cm³"),
        line(24, "Số máy", "Số máy: ", "TESTMAY000123"),
        line(25, "Số khung", "Số khung: ", "TESTKHUNG00456"),
        line(27, "Kèm theo", "Kèm theo giấy này có: ", "Giấy đăng ký xe; biển số; hợp đồng mua bán xe"),
    ], {"Tên chủ xe": "Trần Văn Hòa", "Chủ xe mới": "Lê Thị Thu", "Biển số xe": "TEST-001",
        "Nhãn hiệu": "HONDA", "Số máy": "TESTMAY000123", "Số khung": "TESTKHUNG00456",
        "Lý do thu hồi": "Chuyển quyền sở hữu xe",
        "Địa chỉ chủ xe": "30 đường Mẫu, phường Minh Họa",
        "Địa chỉ chủ xe mới": "42 đường Thử Nghiệm, phường Minh Họa"}),
]


def main():
    rows = json.loads((DATA / "acquisition.json").read_text())
    documents, truths, converted = [], {}, {}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for source in rows:
            if "error" in source:
                continue
            original = ROOT / source["original_path"]
            assert digest(original) == source["original_sha256"], original
            destination = DATA / "pdf" / (source["id"] + ".pdf")
            if original.suffix == ".pdf":
                shutil.copyfile(original, destination)
                conversion = "original_pdf"
            else:
                intermediate = DATA / "conversion" / (source["id"] + ".html")
                subprocess.run(["textutil", "-convert", "html", "-output", str(intermediate), str(original)], check=True)
                converted[source["id"]] = markup(intermediate)
                render_html(browser, converted[source["id"]], destination)
                conversion = "Word → macOS textutil HTML → Chromium PDF; bố cục phân trang có thể khác bản gốc"
            row = {**source, **info(destination), "dataset": "citizen-forms-v1", "conversion": conversion,
                   "label_origin": "curated_test_metadata", "label_review_status": "needs_review",
                   "original_name": original.name, "suggested_work_group": source["expected_type_id"].split("-")[0]}
            row.setdefault("verification", "Mẫu công khai để thử OCR; chưa xác nhận đây là biểu mẫu đang áp dụng. Không dùng làm hồ sơ đã tiếp nhận.")
            documents.append(row)
        for parent, id, title, replacements, expected in SCENARIOS:
            destination = DATA / "pdf" / (id + ".pdf")
            vector = DATA / "conversion" / (id + ".pdf")
            render_html(browser, fill_form(converted[parent], replacements), vector)
            # Raster-only PDF forces the production OCR path; no invisible answer text.
            with pymupdf.open(vector) as source, pymupdf.open() as scan:
                for original_page in source:
                    page = scan.new_page(width=original_page.rect.width, height=original_page.rect.height)
                    page.insert_image(page.rect, stream=original_page.get_pixmap(dpi=170).tobytes("png"))
                scan.save(destination, deflate=True)
            parent_row = next(r for r in documents if r["id"] == parent)
            row = {**parent_row, **info(destination), "id": id, "title": title,
                   "sample_kind": "synthetic_handwriting_font", "publisher": "Dữ liệu giả lập local",
                   "parent_document_id": parent, "original_name": destination.name,
                   "conversion": "Điền font Patrick Hand vào form dẫn xuất; raster 170 DPI, không lớp text",
                   "verification": "Thông tin giả lập; chữ viết bằng font, không phải nét viết tay của người thật. Không dùng để kết luận chất lượng OCR chữ viết tay thực tế."}
            documents.append(row)
            truths[id] = {"expected_type_id": row["expected_type_id"], "expected_fields": expected,
                          "purpose": "Ground truth giả lập để đối chiếu; tuyệt đối không đưa vào đầu vào model hoặc giả làm kết quả OCR."}
        browser.close()
    # A deliberate mixed-document packet to exercise the existing review warning.
    members = ["citizen-land-hand-sim", "citizen-inheritance-hand-sim", "citizen-vehicle-hand-sim"]
    destination = DATA / "pdf/citizen-mixed-packet.pdf"
    ranges, offset = [], 1
    with pymupdf.open() as packet:
        for id in members:
            row = next(r for r in documents if r["id"] == id)
            with pymupdf.open(ROOT / row["local_path"]) as part:
                packet.insert_pdf(part)
                ranges.append({"document_id": id, "first_page": offset, "last_page": offset + len(part) - 1})
                offset += len(part)
        packet.save(destination, deflate=True)
    documents.append({"id": "citizen-mixed-packet", "title": "Bộ scan lẫn đất đai, thừa kế, xe — giả lập cần tách",
                      **info(destination), "sample_kind": "synthetic_mixed_packet", "dataset": "citizen-forms-v1",
                      "publisher": "Dữ liệu giả lập local", "document_form": "Nhiều giấy tờ độc lập",
                      "components": ranges, "label_review_status": "needs_review", "expected_type_id": None,
                      "verification": "Gộp các bản mô phỏng; không phải một hồ sơ thực tế. Cần tách/đối chiếu từng giấy tờ.",
                      "original_name": destination.name})
    truths["citizen-mixed-packet"] = {"mixed_documents": True, "components": ranges}
    write_json(DATA / "manifest.json", {"dataset": "citizen-forms-v1", "documents": documents})
    write_json(DATA / "ground-truth.json", truths)
    print(f"Prepared {len(documents)} PDFs / {sum(r['page_count'] for r in documents)} pages.")
    for row in documents:
        print(row["id"], row["page_count"], row["sample_kind"])


if __name__ == "__main__":
    main()
