#!/usr/bin/env python3
"""Build offline review catalog, explicit coverage queue, and downloadable ZIP."""
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/form-test-data'


def main():
    data = json.loads((OUT / 'classification.json').read_text())
    manifest = json.loads((OUT / 'manifest.json').read_text())
    schemas = json.loads((OUT / 'schemas.json').read_text())['forms']
    truths = {r['id']: json.loads((OUT / r['ground_truth_path']).read_text()) for r in manifest['documents']}
    batch_path = ROOT / 'data/vietnamese-form-dataset/manifest.json'
    batch = json.loads(batch_path.read_text()) if batch_path.is_file() else None
    batch_counts = {}
    if batch:
        for r in batch['documents']:
            batch_counts[r['template_id']] = batch_counts.get(r['template_id'], 0) + 1
    # A matching procedure code is not proof of identical template layout/version.
    # Keep all attachment candidates pending until their own SHA/slots are reviewed.
    pending = [{'id': t['id'], 'filename': t['filename'], 'source_path': t['local_path'],
                'input_status': t['input_status'], 'department_ids': t['department_ids'],
                'generated_automatic_copies': batch_counts.get(t['id'], 0),
                'reason': 'Đã sinh bản test bằng schema tự động; còn cần duyệt ngữ nghĩa từng trường.' if t['id'] in batch_counts else 'Chưa duyệt schema và bố cục của chính tệp đính kèm; mẫu PDF cùng thủ tục không chứng minh đồng nhất phiên bản.',
                'related_pdf_tests': [s['id'] for s in schemas if set(t['procedure_codes']) & set(s['procedure_codes'])]}
               for t in data['templates'] if t['input_status'] not in {'supporting_document', 'agency_inputs_only_or_mixed'}]
    (OUT / 'pending-review.json').write_text(json.dumps(pending, ensure_ascii=False, indent=2) + '\n')
    embedded = json.dumps({**data, 'manifest': manifest, 'truth': truths,
                          'bulk_stats': batch['stats'] if batch else None}, ensure_ascii=False).replace('<', '\\u003c')
    html = (ROOT / 'scripts/form-test-catalog-template.html').read_text().replace('__DATA__', embedded)
    (OUT / 'index.html').write_text(html)
    (OUT / 'README.txt').write_text(f'''Phân loại hồ sơ và bộ dữ liệu test mẫu gốc — 13/11/2026

Đã phân loại {data['stats']['procedures']} mục thủ tục, {data['stats']['paper_descriptions']} mô tả thành phần và đọc {data['stats']['unique_attachments']} tệp mẫu không trùng.
Phân phòng là suy luận theo lĩnh vực và nguồn công khai về cơ cấu Từ Liêm; chưa phải quyết định phân công cho từng TTHC.
Các dịch vụ ngành dọc được giữ riêng. Trạng thái CURRENT trong API không tự chứng minh đang áp dụng tại Từ Liêm.

Đã tạo {manifest['stats']['documents']} PDF raster từ {manifest['stats']['reviewed_templates']} mẫu PDF chính thức: {manifest['stats']['filled_documents']} đã điền và {manifest['stats']['blank_controls']} trống đối chứng.
Có {manifest['stats']['schema_fields']} vị trí input được gắn vai trò/tọa độ; {manifest['stats']['filled_fields']} giá trị giả đã vẽ trên PDF.
Các trang in gốc được trích nguyên trang rồi đặt chữ vào ô; không gõ lại nhãn hoặc dựng lại mẫu bằng danh sách name:value.
Chữ điền bằng font Patrick Hand có giấy phép OFL, không phải nét viết tay thật. Có đánh dấu DỮ LIỆU TEST trên mỗi trang.
Họ tên, địa chỉ, số định danh 999..., mã TEST... là dữ liệu giả. Không tạo chữ ký, dấu hoặc giấy tờ đã cấp giả.
Mẫu đầy đủ theo kịch bản vẫn để trống nhánh không chọn, chỗ chữ ký và phần cán bộ xác nhận; không phải hồ sơ đủ điều kiện nộp hành chính.

{f"Lô mở rộng đã sinh {batch['stats']['documents']} bản cho {batch['stats']['target_templates']} tệp nguồn, tại ../vietnamese-form-dataset/index.html. Schema của lô mở rộng được suy luận tự động, còn cần duyệt ngữ nghĩa; không gộp với bộ 14 mẫu đối chiếu này." if batch else 'Chưa điền hết mọi mẫu có input: xem pending-review.json để biết từng tệp đang chờ gắn schema/kiểm tra bố cục.'}
Một số mẫu nguồn dùng chung lấy từ địa phương khác hoặc văn bản cũ có sửa đổi; xem source_url/source_sha256/source_pages trước khi dùng ngoài test.

Cách dùng:
1. Mở index.html hoặc http://127.0.0.1:8765/form-test-data/ để lọc theo phòng, loại giấy tờ và trạng thái input.
2. Đưa PDF trong pdf/ vào OCR. PDF chỉ chứa ảnh, không có đáp án trong lớp text ẩn.
3. Dùng ground-truth/<document_id>.json để chấm value theo field ID, vai trò và vị trí, không chỉ tìm value ở đâu đó trên trang.
4. Blank và missing-id là mẫu âm: AI không được tự đoán ô thiếu. Đáp án không được đưa vào lời nhắc đọc OCR.
5. Nếu dùng train/eval, tách theo mẫu nguồn + người viết. Các biến thể của cùng mẫu/font không chứng minh khả năng đọc mẫu hoặc chữ viết tay mới.

Thử OCR thực tế: xem benchmark.json. Đây là hai smoke test có cung cấp schema cho Qwen, chưa kiểm tra tự nhận dạng mẫu và chưa qua bộ lọc bằng chứng của luồng production.
Mẫu khai sinh đã điền: đúng 30/37 giá trị theo field ID. Mẫu trống: model thô tự điền sai 28/37 ô (đa số lấy nhãn in sẵn, dấu chấm, số trang).
Các lỗi được giữ nguyên để đánh giá; không dùng kết quả model thô làm đáp án. Bộ dữ liệu được tạo độc lập, không đưa đáp án vào lời nhắc trích xuất.
Ảnh đầu vào của cả hai lần OCR được đối chiếu khớp pixel với PDF đang đóng gói. Đây không phải tỷ lệ chính xác chung cho mọi biểu mẫu.

Chạy lại từ thư mục project với Python trong /Volumes/quocDisk/AI/document-samples/venv:
  python scripts/classify-official-forms.py
  python scripts/build-form-test-data.py
  python scripts/verify-form-test-data.py
  python scripts/package-form-test-data.py
''')
    with zipfile.ZipFile(OUT / 'form-test-data.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(OUT.rglob('*')):
            rel = path.relative_to(OUT)
            if path.is_file() and path.suffix != '.zip' and rel.parts[0] not in {'qa', 'ocr-smoke', 'previews'} and not path.name.startswith('blank-'):
                archive.write(path, 'form-test-data/' + str(rel))
        for name in ['PatrickHand-Regular.ttf', 'OFL.txt']:
            font = ROOT / 'data/citizen-samples/fonts' / name
            if font.is_file():
                archive.write(font, 'form-test-data/fonts/' + name)
        # The 203 MB complete source ZIP already exists separately. Include the
        # exact sources used by these test forms, so their hashes are auditable.
        for name in sorted({s['source_file'] for s in schemas}):
            archive.write(ROOT / 'data/official-forms/originals' / name, 'official-forms/originals/' + name)
    print(f"Catalog built; {len(pending)} attachments still require review; ZIP {(OUT / 'form-test-data.zip').stat().st_size:,} bytes")


if __name__ == '__main__':
    main()
