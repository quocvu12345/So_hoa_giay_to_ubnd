# Đọc và phân loại PDF trên máy local

Mở **http://127.0.0.1:8765/scan-inbox.html**. Trang mặc định của dịch vụ cũng dẫn tới danh sách PDF.

```sh
./scripts/document-ai.sh status
./scripts/document-ai.sh serve
```

Nếu dịch vụ đang chạy, không cần mở thêm một bản trên cùng cổng. Khi cập nhật mã, dừng Terminal chạy dịch vụ bằng Ctrl+C rồi chạy lại.

## Mô hình đã tải và cách xử lý

Môi trường, trọng số, cache nằm ở `$DOCUMENT_AI_HOME` (máy dev: `/Volumes/quocDisk/AI/paddleocr`), tách khỏi SAM 3 và không nằm trong git.

| Bước | Mô hình/công cụ | Thiết bị |
| --- | --- | --- |
| PDF có lớp chữ và không chứa ảnh | PDFium đọc chữ trực tiếp | CPU |
| Xác định chiều trang | PP-LCNet_x1_0_doc_ori | CPU |
| Phát hiện bố cục, vùng bảng | PP-DocLayoutV3 | CPU |
| Đọc vùng chữ/bảng/ảnh | PaddleOCR-VL-1.6, trọng số chính thức | GPU M4 qua MLX |
| Gợi ý nhóm hồ sơ, loại giấy tờ và trường | [Qwen3-4B-Instruct-2507 IFStruct](https://huggingface.co/ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct), tự chuyển sang MLX 4-bit (mặc định từ 17/11/2026; đổi bằng `HOSO_AI_CLASSIFIER_MODEL`) | GPU M4 qua MLX |

OCR chạy trước; tiến trình OCR giải phóng bộ nhớ rồi Qwen xử lý nội dung. Dịch vụ không chạy đồng thời OCR và SAM 3; giải phóng SAM khỏi RAM trước khi đọc PDF. SAM 3 vẫn dùng được tại `/sam3-lab.html`.

Mỗi model được ghim revision trong `config.py`; `$DOCUMENT_AI_HOME/download-receipt.json` lưu nguồn, revision, kích thước và SHA-256 trọng số. `requirements.lock.txt` ghim môi trường đã kiểm thử.

IFStruct phát hành dạng BF16, nên cài đặt tải nguồn BF16 (khoảng 7,5 GB) rồi chuyển sang MLX 4-bit (khoảng 2,1 GB) bằng `python -m document_ai.convert`. Bản 4-bit giữ nguyên tokenizer, mẫu chat của nguồn, và có `conversion-receipt.json` ghi repo, commit, SHA-256 nguồn và kết quả. Chuyển xong có thể xóa thư mục BF16. Vì sao chọn mô hình này: `ai-worker/training/SO-SANH-IFSTRUCT-QWEN4B.md`.

Thiết lập môi trường và tải mô hình (chạy lại được, bỏ qua bước đã xong):

```sh
DOCUMENT_AI_HOME=/duong/dan/ai ./scripts/setup-document-ai.sh
```

Có thể chép sẵn thư mục `models/Qwen3-4B-Instruct-2507-ifstruct-4bit` từ máy đã chuyển sang `$DOCUMENT_AI_HOME/models/` để khỏi tải nguồn BF16; khi đó script chỉ tải mô hình OCR.

Lệnh tải cần mạng. Suy luận dùng đường dẫn local, `HF_HUB_OFFLINE=1` và `TRANSFORMERS_OFFLINE=1`; ảnh chỉ chuyển tới bộ đọc ở địa chỉ loopback `127.0.0.1`. Không cần API key, dịch vụ cloud hoặc quyền truy cập model có kiểm soát.

Adapter `vlm.py` sử dụng `mlx_vlm.generate()` tuần tự với mô hình cố định. Máy chủ tổng quát MLX-VLM 0.7.12 ở chế độ continuous batching sinh lặp trên mẫu tiếng Việt đã thử; đường gọi trực tiếp đã đọc và dừng đúng. Không sửa mã trong các thư viện được cài.

Trên máy 16 GB, nên chạy một lượt AI tại một thời điểm.

## Luồng sử dụng

1. Thêm hoặc kéo thả PDF, tối đa 40 MB mỗi tệp. Trang danh sách chỉ nhận PDF; ảnh cần chuyển thành PDF trước.
2. Bấm **Lấy dữ liệu**. Popup hiển thị tiến độ từng trang. Đóng popup không hủy công việc; mở lại để xem tiến độ/kết quả.
3. Đối chiếu với bản gốc. Sửa tên, trường dữ liệu, loại giấy tờ, phòng/Ban và nhóm hồ sơ.
4. Chọn hồ sơ đang chuẩn bị/bổ sung hoặc tạo hồ sơ mới, rồi bấm **Đưa vào hồ sơ**. Chưa đánh dấu đối chiếu thì giấy tờ được lưu ở trạng thái cần kiểm tra.
5. Mở **Kho hồ sơ** để xem PDF và xử lý tiếp. Loại giấy tờ độc lập với nhóm công việc: giấy mời về giáo dục có thể nằm trong hồ sơ giáo dục.

**Xóa** ở danh sách chờ là xóa khỏi danh sách, có hoàn tác; không xóa bản gốc trên đĩa. PDF đã đưa vào hồ sơ được quản lý từ hồ sơ đích. Yêu cầu lưu lặp lại không nhân đôi giấy tờ. **Đọc lại PDF** tạo lượt đọc mới, dùng khi lỗi hoặc cần trích xuất lại.

## Dữ liệu và phạm vi hiện tại

- PDF nạp lên: `data/sam3/runtime/uploads/`.
- OCR, tiến độ, log, JSON từng trang, toàn văn: `data/sam3/runtime/extractions/<job-id>/`.
- Phiếu tiếp nhận và vị trí hồ sơ ban đầu: `data/sam3/runtime/inbox.json`, lưu nguyên tử trên đĩa.
- Hồ sơ và các sửa đổi tiếp theo trong giao diện quản lý hiện hữu: localStorage `ubnd-hdnd-pilot-v1`. Phiếu tiếp nhận trên đĩa cho phép nhập lại khi đổi trình duyệt; các sửa đổi tiếp theo chỉ có trong trình duyệt đó. Chưa đấu nối các bước này vào PostgreSQL.
- Vai trò vẫn là bộ chuyển vai trò của bản thí điểm, không phải xác thực/phân quyền tài khoản thực tế. Chỉ bind localhost.
- Kết quả là **gợi ý cần kiểm tra**, không cam kết đọc đúng 100%. Chữ mờ, chữ viết tay, dấu đè lên số/ngày và dấu tiếng Việt vẫn có thể sai. Một PDF có nhiều văn bản độc lập chưa tự tách thành nhiều hồ sơ.
- Duyệt tất cả các trang, giữ nguyên bản gốc và dữ liệu từng trang; trang lỗi được ghi rõ. Vùng vượt giới hạn sinh 4096 token báo lỗi thay vì coi nội dung bị cắt là hoàn chỉnh. `all_pages_read` chỉ phản ánh các trang đã xử lý có nội dung, không phải điểm chính xác OCR.
- Phân loại dùng danh mục hiện có. Với PDF dài, lấy trích đoạn từ các trang cho mô hình phân loại và đặt cờ `classification_uses_excerpts`; toàn văn OCR vẫn được lưu. Loại ngoài danh mục có thể để chưa xác định.
- Trường trích xuất phải có đoạn nguồn khớp nội dung; giá trị không có bằng chứng bị bỏ trống. Đây không phải xác minh tính đúng đắn của OCR hoặc ý nghĩa nghiệp vụ.

## Kiểm thử đã thực hiện trên Mac M4 16 GB

| PDF | Cách đọc | Thời gian quan sát gồm phân loại |
| --- | --- | --- |
| `badinh-001.pdf`, 1 trang | Buộc OCR ảnh | 55 giây |
| `badinh-001.pdf`, 1 trang | Đọc lớp chữ PDF | Khoảng 36 giây |
| `central-001.pdf`, 3 trang scan | OCR tất cả trang | 117 giây |
| `phuquoc-004.pdf`, 2 trang | Buộc OCR, có bảng HTML | 59 giây |

Đây là các lần chạy mẫu, chưa phải đánh giá độ chính xác trên toàn bộ kho. Đã đối chiếu thêm PP-OCRv5 Latin và PP-OCRv6 medium trên trang đầu `central-001`: hai cấu hình thử làm mất nhiều dấu tiếng Việt, nên không chọn làm engine chính. Kết quả đối chiếu nằm trong `data/sam3/runtime/ocr-v5-comparison.json` và `ocr-v6-comparison.json`.

```sh
./scripts/sam3.sh test
PLAYWRIGHT_BROWSERS_PATH=/Volumes/quocDisk/AI/sam3/cache/playwright \
  /Volumes/quocDisk/AI/sam3/venv/bin/python tests/browser_document_flow.py
./scripts/document-ai.sh extract data/sam3/documents/badinh-001.pdf \
  --output data/sam3/runtime/manual-extraction --force-ocr
```

17 kiểm thử tự động kiểm tra PDF thật, upload, khôi phục, trường hợp lỗi, khóa tài nguyên, phân loại/nhóm độc lập, dữ liệu nguồn và lưu lặp. Kiểm thử trình duyệt dùng kho tạm riêng và kết quả OCR thực đã lưu: sửa trường, đổi loại không mất dữ liệu, hồ sơ mới/có sẵn, giữ PDF và chỉnh sửa sau reload, xóa/hoàn tác, giao diện rộng 390 px.

## API local

- `GET /api/inbox/status`, `GET /api/inbox/documents`
- `POST /api/inbox/documents`: body PDF thô, tên trong header `X-Filename` URL-encoded.
- `POST /api/inbox/documents/{id}/extract` → job; thêm `?retry=true` để đọc lại.
- `GET /api/inbox/jobs/{job}` → trạng thái, tiến độ, kết quả khi hoàn tất.
- `GET /api/inbox/jobs/{job}/text` → toàn văn.
- `DELETE /api/inbox/documents/{id}`, `POST .../{id}/restore`.
- `POST /api/inbox/documents/{id}/file` → phiếu tiếp nhận gồm case/document.
- `GET /api/inbox/placements` → các phiếu tiếp nhận để nhập vào kho giao diện.

Nguồn kỹ thuật: [PaddleOCR trên Apple Silicon](https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/PaddleOCR-VL-Apple-Silicon.html), [PaddleOCR-VL-1.6](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6), [Qwen3-4B-Instruct-2507 gốc](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507), [IFStruct](https://huggingface.co/ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct).

## Hồ sơ công dân điền form

Bộ test mới có 12 PDF về đất đai, thừa kế, xe; đã nạp PostgreSQL local `hoso_dev` và có trong [danh sách mẫu](http://127.0.0.1:8765/scan-inbox.html?samples=citizen). Nguồn, phân biệt mẫu công khai / giả lập, cách thử và giới hạn chữ viết tay: [hướng dẫn bộ mẫu](../data/citizen-samples/README.md). Thao tác xếp hồ sơ trên giao diện vẫn chưa đồng bộ PostgreSQL.
