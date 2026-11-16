Phân loại hồ sơ và bộ dữ liệu test mẫu gốc — 13/11/2026

Đã phân loại 861 mục thủ tục, 3964 mô tả thành phần và đọc 768 tệp mẫu không trùng.
Phân phòng là suy luận theo lĩnh vực và nguồn công khai về cơ cấu Từ Liêm; chưa phải quyết định phân công cho từng TTHC.
Các dịch vụ ngành dọc được giữ riêng. Trạng thái CURRENT trong API không tự chứng minh đang áp dụng tại Từ Liêm.

Đã tạo 68 PDF raster từ 14 mẫu PDF chính thức: 54 đã điền và 14 trống đối chứng.
Có 345 vị trí input được gắn vai trò/tọa độ; 1325 giá trị giả đã vẽ trên PDF.
Các trang in gốc được trích nguyên trang rồi đặt chữ vào ô; không gõ lại nhãn hoặc dựng lại mẫu bằng danh sách name:value.
Chữ điền bằng font Patrick Hand có giấy phép OFL, không phải nét viết tay thật. Có đánh dấu DỮ LIỆU TEST trên mỗi trang.
Họ tên, địa chỉ, số định danh 999..., mã TEST... là dữ liệu giả. Không tạo chữ ký, dấu hoặc giấy tờ đã cấp giả.
Mẫu đầy đủ theo kịch bản vẫn để trống nhánh không chọn, chỗ chữ ký và phần cán bộ xác nhận; không phải hồ sơ đủ điều kiện nộp hành chính.

Lô mở rộng đã sinh 882 bản cho 441 tệp nguồn, tại ../vietnamese-form-dataset/index.html. Schema của lô mở rộng được suy luận tự động, còn cần duyệt ngữ nghĩa; không gộp với bộ 14 mẫu đối chiếu này.
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
