# Báo cáo tốc độ và chất lượng AI trên Mac M4 16 GB (AI-12)

Ngày đo: 17/11/2026. Công cụ: `ai-worker/training/bench_pipeline.py`, kết quả thô ở `/Volumes/quocDisk/AI/paddleocr/training/bench/` (không nằm trong repo). Đọc kèm [docs/tasks/ai.md](../../docs/tasks/ai.md).

## Đọc trước khi dùng các con số

1. **Dữ liệu là giả lập.** 47 tài liệu: 36 mẫu `filled-samples` (PDF điền bằng font mô phỏng, **in sẵn tên loại và tên nhóm làm tiêu đề**) và 11 mẫu `citizen-samples` (biểu mẫu công khai và bản mô phỏng điền tay). Chưa có giấy tờ thật của dân. Mọi tỉ lệ đúng dưới đây là **cận trên lạc quan**, nhất là với cách chấm bằng từ khóa tiêu đề.
2. **Máy đo đang bận.** Trước khi đo, swap đã dùng 5,8 GB trên 7,2 GB (trình duyệt, VS Code, API, web chạy cùng); sau đó lên 9 GB trên 10 GB. Thời gian có thể chậm hơn máy chuyên dụng. Trong lúc đo Qwen3-4B có chạy test Python nhẹ và PostgreSQL.
3. **Bộ nhớ OCR chưa đo được.** RSS của cây tiến trình OCR chỉ 1,06 GB, không phản ánh bộ nhớ GPU của máy chủ MLX. Con số 4,5 GB trong mã vẫn là ước tính. Pha đo "chạy chung OCR và LLM" chưa chạy.
4. Đường chạy đo được **không giống nhau giữa các lượt**: lượt đầu dùng hàm của bản thí điểm (chọn loại trong mọi nhóm có tên giống), các lượt sau dùng đúng đường của worker (chỉ chọn loại trong nhóm đã chọn). Từng bảng ghi rõ.

## 1. OCR (PaddleOCR-VL 1.6)

| Việc | Số đo |
|---|---|
| Nạp mô hình (một lần, giữ trong bộ nhớ) | 9,2 và 11,5 giây (hai lần đo) |
| Trang quét bản điền mô phỏng (≈ 835 ký tự) | trung vị 6,9 giây, p90 7,6 giây |
| Trang biểu mẫu dày chữ (≈ 1.370 ký tự) | trung vị 10,9 giây, p90 17,6 giây, lớn nhất 28,9 giây |
| Một trang A4 in dày chữ phải OCR (đọc lại trang của hợp đồng đất) | 29 giây |
| Dựng ảnh trang từ PDF | 0,05 giây |
| Gói quét 7 trang dày chữ | 134 giây |

Trang có lớp chữ sạch không phải OCR. Hợp đồng đất 3 trang (có lớp chữ): OCR 0 giây; hợp đồng xe 8 trang (7 trang lớp chữ, 1 ảnh): chỉ OCR 1 trang, cả job 24 giây.

## 2. Phân loại và trích trường trên 47 tài liệu giả lập

### 2.1. Đường thí điểm cũ (`classify(pages)`, chọn loại trong mọi nhóm)

| | Qwen3-4B | Qwen3-1.7B |
|---|---|---|
| Nạp mô hình | 2,9 giây | 1,5 giây |
| Bộ nhớ GPU đỉnh | 3,21 GB | 1,84 GB |
| Đúng nhóm | **97,9%** | 70,2% |
| Đúng loại | **91,5%** | 6,4% |
| Trường đúng / sai / bỏ sót (trên các trường có đáp án) | 77,0% / 10,7% / 12,3% | 53,9% / 7,4% / 38,7% |
| Thời gian mỗi tài liệu (trung vị, p90) | 21,6 giây, 50,7 giây | 9,7 giây, 13,8 giây |
| Từng bước (nhóm / loại / trường, trung vị) | 7,7 / 3,9 / 9,2 giây | 4,0 / 1,1 / 4,7 giây |

### 2.2. Đúng đường của worker (chỉ chọn loại trong nhóm đã chọn), Qwen3-1.7B, lời nhắc đầy đủ

| Cấu hình | Đúng nhóm | Đúng loại | Ghi chú |
|---|---|---|---|
| Không thu hẹp | 70,2% | 8,5% | trường đúng 11,9% (vì loại sai nên không có trường để trích); 4,2 giây/tài liệu |
| Có thu hẹp bằng từ khóa và tin tiêu đề (AI-20) | — | **35/36 tài liệu `filled-samples`** (một tài liệu lượt đo dừng trước 11 tài liệu cuối) | **lạc quan**: tiêu đề giả lập in sẵn tên loại |

Nguyên nhân 1.7B yếu ở hai bước đầu:
- chọn trong 38 nhóm rồi hàng chục loại có tên gần giống thì chọn kém (gần như đoán);
- bước chọn loại phụ thuộc `document_form` do mô hình trả về. 1.7B hay chép nguyên dòng phụ đề của tài liệu vào đó ("Công văn, quyết định, thông báo và sổ đăng ký"), khiến danh sách ứng viên rỗng và bước chọn loại bị bỏ. Đã sửa (quay về các loại của nhóm đã chọn) và có test.

Bước **trích trường** của 1.7B vẫn tốt khi đã biết đúng loại: 90,2% đúng trên 56 tài liệu giả lập (đo trước đó, `training/eval/`), nhanh gấp khoảng 1,8 lần 4B (lời nhắc đầy đủ) và 5 lần (lời nhắc ngắn).

## 3. Chạy thật trên stack dev (API + worker + PostgreSQL), Qwen3-1.7B, `HOSO_AI_SHORTLIST=on`

`scripts/smoke-ai-flow.py`: 3 PDF mẫu, 65 giây, 0 kiểm tra hỏng.

| Quan sát | Kết quả |
|---|---|
| Nạp OCR / nạp Qwen3-1.7B (trong worker) | 11,5 giây / 2,6 giây, một lần; OCR không bị nạp lại giữa các job |
| Job ưu tiên 1 trang quét, cả luồng | 15 giây |
| Việc nền nhường chỗ cho việc ưu tiên | đúng như thiết kế (`job_yielded`), việc nền quay lại chỉ đọc phần còn thiếu (7 giây) |
| Thứ tự hoàn tất | giấy tờ bấm "Trích xuất ngay" xong trước giấy tờ cùng khay đứng trước nó |
| SSE | có `job.progress` và `job.completed` cho từng giấy tờ |
| Loại đúng, mọi trường có trích dẫn khớp văn bản | 3/3 giấy tờ |

`scripts/smoke-ai-edge.py` (số đo thực trên stack dev):

| Kịch bản | Kết quả |
|---|---|
| PDF có lớp chữ 3 trang | 0 trang OCR; 58 giây khi bị dùng lời nhắc chậm (đã sửa) |
| PDF 8 trang lẫn 1 trang ảnh | 1 trang OCR, 24 giây |
| Đọc lại 1 trang dày chữ | 30 giây (OCR 29 giây) |
| "Trích xuất lại" (reclassify) | 14 giây, không OCR |
| Gói quét 7 trang, 3 loại giấy tờ | 134 giây; sau sửa báo `mixedDocuments=true` |
| Biểu mẫu xe điền tay mô phỏng | 35 giây; đúng loại U27-D13; 7/9 trường (2 sai: "TEST-001 - Màu biển: Trắng" thừa chữ, "Thứ Nghiệm" do OCR) |
| Hủy việc đang chờ và đang chạy | worker dừng việc đã hủy, không để lại gợi ý |
| Giết worker khi xong 2/7 trang | API thu hồi sau 24 giây (đã đặt lùi nhịp sống), worker mới chỉ đọc 5 trang còn thiếu |

Lúc chạy các kịch bản này swap đã dùng 9 GB trên 10 GB rồi 17 GB trên 18 GB: máy dev rất thiếu RAM, nên thời gian có thể chậm hơn máy chuyên dụng.

## 4. Kết luận cho việc dùng Qwen3-1.7B

- **Trích trường: đủ dùng** cho gợi ý cần cán bộ kiểm tra (đúng ~90% trên dữ liệu giả lập, nhanh).
- **Chọn nhóm và loại: không đủ dùng nếu để mô hình tự chọn trên danh mục đầy đủ.** Cách thu hẹp bằng từ khóa (AI-20) cứu được trên dữ liệu giả lập, nhưng chưa biết hiệu quả trên giấy tờ thật có tiêu đề không trùng tên danh mục.
- **Việc cần làm tiếp để kết luận:** đo trên ít nhất 20 giấy tờ thật đã được cán bộ xác nhận loại; nếu thấp thì dùng mô hình lớn hơn chỉ cho bước chọn nhóm và loại khi có phần cứng (AI-17), giữ 1.7B cho trích trường.
