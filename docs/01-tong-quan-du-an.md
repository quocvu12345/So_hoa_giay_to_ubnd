# 01 · Tổng quan dự án Hồ sơ số UBND / HĐND phường Từ Liêm

Tài liệu này tóm tắt những gì đang có trong repo (rà soát ngày 16/11/2026), làm đầu vào cho thiết kế server (`02`), cơ sở dữ liệu (`03`) và kế hoạch task (`04`).

## 1. Mục tiêu sản phẩm

Chuyển hồ sơ giấy của UBND và HĐND phường thành bộ hồ sơ số **đủ · đúng · truy xuất được**:

- Tiếp nhận theo lô, quét, kiểm tra ảnh, tách văn bản.
- OCR tiếng Việt và AI gợi ý loại giấy tờ, trường dữ liệu. Cán bộ luôn đối chiếu trước khi dùng.
- Lập hồ sơ công việc theo danh mục, luân chuyển kiểm tra theo vai trò, nộp lưu.
- Quản lý bản giấy (kho, tủ, kệ, hộp, mượn trả), tra cứu theo quyền, xuất dữ liệu bàn giao.

Ngoài phạm vi: phòng họp điện tử, biểu quyết, điều hành văn bản, chatbot. Thao tác trên phần mềm **không thay** ký văn bản, phê duyệt chuyên môn hay biểu quyết.

## 2. Thành phần đang có

| Thành phần | Vị trí | Công nghệ | Trạng thái |
|---|---|---|---|
| Trang đề xuất sản phẩm | `index.html` | HTML tĩnh + JS | 12 nhóm chức năng, thiết bị, lộ trình 10–14 tuần |
| Nghiên cứu nghiệp vụ & phân vai | `nghiep-vu-vai-tro.html` | HTML tĩnh | Ma trận vai trò, 3 luồng A/B/C, thiết kế màn hình |
| Giao diện quản lý hồ sơ thí điểm | `quan-ly-ho-so.html`, `assets/quan-ly-ho-so.js` | JS thuần | Dữ liệu ở **localStorage**, vai trò chọn tay |
| Danh mục hồ sơ | `assets/danh-muc-ho-so.js` | JS (≈12.000 dòng) | 11 đầu mối, 38 nhóm, 427 loại giấy tờ, 2.624 trường |
| Tiếp nhận & đọc PDF | `scan-inbox.html`, `sam3_service/inbox.py` | FastAPI | Lưu ở **tệp JSON** `data/sam3/runtime` |
| Pipeline AI | `document_ai/worker.py`, `classify.py` | PDFium, PaddleOCR-VL 1.6 (MLX), Qwen3-4B (MLX) | Chạy local trên Mac M4, một tác vụ mỗi lúc |
| Thử SAM 3 | `sam3-lab.html`, `sam3_service/inference.py` | Transformers, MPS | Công cụ thử nghiệm |
| Cơ sở dữ liệu | `database/001…007` | PostgreSQL 16 | 23 bảng, hàm `transition_dossier`, chưa có API |
| Kho thủ tục hành chính | `data/official-forms/` | JSON/CSV | 425 thủ tục Hà Nội, 861 mục gộp DVC, 2.738 thành phần, 3.964 loại giấy, 1.085 tệp mẫu |
| Bộ dữ liệu kiểm thử | `data/form-test-data`, `citizen-samples`, `tuliem-dossiers`, `tuliem-dossiers-full`, `vietnamese-form-dataset` | JSON, PDF, ZIP | 14 schema biểu mẫu có toạ độ; 425 × 2 = 850 bộ PDF đầy đủ theo checklist kiểm thử, 3.560 giấy tờ / 4.228 trang; 87 mục dùng thành phần giả định, benchmark |

## 3. Vai trò

| Mã | Tên | Phạm vi |
|---|---|---|
| `employee` | Chuyên viên | Hồ sơ được giao |
| `clerk` | Văn thư / lưu trữ | Theo tổ chức (UBND hoặc HĐND) |
| `manager` | Trưởng phòng / Trưởng Ban / phụ trách đơn vị | Theo đơn vị |
| `chair` | Chủ tịch UBND | Khối `tl-ubnd` |
| `council` | Lãnh đạo HĐND | Khối `tl-hdnd` |
| `technical_admin` | Quản trị kỹ thuật | Vận hành, không có quyền nghiệp vụ |

Bản thật cần thêm: cấp phó và ủy quyền có thời hạn, tách quyền văn thư với lưu trữ, quyền xem, tải, in, xuất riêng cho tài liệu hạn chế.

## 4. Ba luồng nghiệp vụ

- **A. Hồ sơ giấy đã kết thúc, đưa vào số hóa:** bàn giao và kiểm kê → quét, tách → đọc và đối chiếu → kiểm tra chất lượng → kiểm tra gói nộp lưu. Không trình ký lại.
- **B. Hồ sơ đang xử lý cần ý kiến:** chuyên viên chuẩn bị → trưởng phòng kiểm tra → lãnh đạo cho ý kiến nếu cần → hoàn thiện → nộp lưu.
- **C. Hồ sơ kỳ họp, thẩm tra, giám sát HĐND:** chuẩn bị → Ban thẩm tra/giám sát → Thường trực điều phối → kết quả → theo dõi. Thường trực và Tổ đại biểu trình thẳng lãnh đạo HĐND.

Trạng thái gói hồ sơ hiện có: `draft → department_review → [leadership_review] → ready_archive → archived`, nhánh `returned`.

## 5. Nguyên tắc dữ liệu phải giữ

1. Ảnh quét giữ trung thực. OCR chỉ là lớp hỗ trợ và có thể sai.
2. Số văn bản không duy nhất (17/NQ-HĐND có ở cả 2025 và 2026). Ngày đăng, ngày ban hành, ngày ký là các trường riêng.
3. Thông tin mâu thuẫn được lưu lại (`source_observations`), không tự chọn một giá trị.
4. Không bịa giá trị: AI để trống khi không thấy. Mọi giá trị AI kèm trang/vùng nguồn và cần người đối chiếu.
5. “Đến / đi / nội bộ” là thuộc tính của liên kết giấy tờ với hồ sơ, không phải loại giấy tờ.
6. Nhật ký chỉ ghi thêm. Không tự hủy tài liệu sau khi quét. Không tự đặt thời hạn bảo quản.
7. Dữ liệu xử lý tại chỗ, không gửi lên dịch vụ cloud nếu cơ quan chưa chấp thuận.
8. Nội dung tài liệu là dữ liệu, không phải chỉ dẫn cho mô hình ngôn ngữ.

## 6. Khoảng trống cần server giải quyết

| Khoảng trống | Hệ quả hiện tại |
|---|---|
| Không có đăng nhập, phân quyền máy chủ | Ai cũng chọn được vai trò Chủ tịch |
| Ba kho dữ liệu tách rời | PDF đã đọc chỉ sang được trang hồ sơ qua `scan-bridge.js` trên cùng trình duyệt |
| AI giữ khóa trong bộ nhớ | Máy bận trả lỗi 409, khởi động lại mất trạng thái hàng đợi |
| Chưa có lô quét, tách văn bản, kiểm tra ảnh | Một PDF nhiều văn bản phải xử lý tay |
| Chưa có kho bản giấy, mượn trả, nộp lưu, xuất bàn giao | Nhóm chức năng 08, 10, 12 chưa có |
| Chưa liên kết thủ tục hành chính | Không kiểm tra được hồ sơ công dân đủ thành phần theo thủ tục công bố |
| Chưa có ký số, sao lưu có kiểm chứng | Nhóm chức năng 06, 11 chưa có |
