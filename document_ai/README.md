# Đọc và phân loại PDF trên máy local

Mở **http://127.0.0.1:8765/scan-inbox.html**. Trang mặc định của dịch vụ cũng dẫn tới danh sách PDF.

```sh
./scripts/document-ai.sh status
./scripts/document-ai.sh serve
```

Nếu dịch vụ đang chạy, không cần mở thêm một bản trên cùng cổng. Khi cập nhật mã, dừng Terminal chạy dịch vụ bằng Ctrl+C rồi chạy lại.

## Mô hình đã tải và cách xử lý

Môi trường, trọng số, cache nằm ở `/Volumes/quocDisk/AI/paddleocr`, tách khỏi SAM 3.

| Bước | Mô hình/công cụ | Thiết bị |
| --- | --- | --- |
| PDF có lớp chữ và không chứa ảnh | PDFium đọc chữ trực tiếp | CPU |
| Xác định chiều trang | PP-LCNet_x1_0_doc_ori | CPU |
| Phát hiện bố cục, vùng bảng | PP-DocLayoutV3 | CPU |
| Đọc vùng chữ/bảng/ảnh | PaddleOCR-VL-1.6, trọng số chính thức | GPU M4 qua MLX |
| Gợi ý nhóm hồ sơ, loại giấy tờ và trường | Qwen3-4B-Instruct-2507, bản MLX 4-bit của mlx-community | GPU M4 qua MLX |

OCR chạy trước; tiến trình OCR giải phóng bộ nhớ rồi Qwen xử lý nội dung. Dịch vụ không chạy đồng thời OCR và SAM 3; giải phóng SAM khỏi RAM trước khi đọc PDF. SAM 3 vẫn dùng được tại `/sam3-lab.html`.

Mỗi model được ghim revision trong `config.py`; `/Volumes/quocDisk/AI/paddleocr/download-receipt.json` lưu nguồn, revision, kích thước và SHA-256 trọng số. `requirements.lock.txt` ghim môi trường đã kiểm thử. Bộ PDF ban đầu khoảng 4,2 GiB, gồm các mô hình đối chiếu thử nghiệm; Qwen3-VL tùy chọn bổ sung khoảng 5,76 GB trọng số.

Thiết lập lại môi trường và tải mô hình:

```sh
./scripts/setup-document-ai.sh
```

Lệnh tải cần mạng. Suy luận dùng đường dẫn local, `HF_HUB_OFFLINE=1` và `TRANSFORMERS_OFFLINE=1`; ảnh chỉ chuyển tới bộ đọc ở địa chỉ loopback `127.0.0.1`. Không cần API key, dịch vụ cloud hoặc quyền truy cập model có kiểm soát. Qwen là bản chuyển đổi MLX của cộng đồng, không phải gói trọng số do Qwen phát hành trực tiếp.

Adapter `vlm.py` sử dụng `mlx_vlm.generate()` tuần tự với mô hình cố định. Máy chủ tổng quát MLX-VLM 0.7.12 ở chế độ continuous batching sinh lặp trên mẫu tiếng Việt đã thử; đường gọi trực tiếp đã đọc và dừng đúng. Không sửa mã trong các thư viện được cài.

## Qwen3-VL-8B-Instruct MLX 4-bit cho thử nghiệm ảnh

Đường dẫn local: `/Volumes/quocDisk/AI/paddleocr/models/Qwen3-VL-8B-Instruct-4bit`.
Nguồn: [mlx-community/Qwen3-VL-8B-Instruct-4bit](https://huggingface.co/mlx-community/Qwen3-VL-8B-Instruct-4bit), ghim commit `defcdea7cc7a4b0858fea563cbbce171d328e457`. Đây là bản chuyển đổi MLX 4-bit của cộng đồng từ `Qwen/Qwen3-VL-8B-Instruct`.

```sh
# Tải riêng model, có thể chạy lại để tiếp tục tải dở.
./scripts/document-ai.sh download --model qwen_vl

# Thử một ảnh local (PNG/JPEG), không gọi dịch vụ cloud.
./scripts/document-ai.sh check-qwen-vl /duong/dan/trang-scan.png \
  --output data/sam3/runtime/qwen3-vl-check.json
```

Hai shard `model-00001-of-00002.safetensors` và `model-00002-of-00002.safetensors` có tổng 5.760.665.246 byte. Lệnh download đối chiếu kích thước tất cả tệp, SHA-256 với nguồn cho các tệp LFS và checksum Git cho tệp nhỏ. Phiếu tải được gộp vào `download-receipt.json`, giữ các model đã có.

Lưu ý của bản chuyển đổi tại commit này: `model.safetensors.index.json` vẫn là index BF16 cũ, trỏ tới 4 shard và tên tensor của model gốc. Hai shard MLX thực tế chứa 1.258 tensor. Giữ nguyên file nguồn; MLX-VLM 0.7.12 có đường nạp tất cả file `*.safetensors` khi không có shard nào trong index tồn tại. Phiếu tải ghi rõ index cũ và hai shard MLX đã khớp SHA-256; lệnh thử kiểm tra shard từ phiếu tải, không đòi 4 shard BF16.

Model được khai báo trong `OPTIONAL_MODELS["qwen_vl"]`; gọi `model_path("qwen_vl")` để lấy đường dẫn. Đã có lệnh thử nạp/nhận ảnh bằng `mlx_vlm` trong môi trường PaddleOCR hiện hữu. Lệnh thử giới hạn ảnh tối đa 1280 px và đầu ra mặc định 256 token, dùng để kiểm tra model hoạt động; không thay cho đánh giá OCR đầy đủ. Tham số `--prompt` và `--max-tokens` cho phép đổi yêu cầu thử.

Ngày 12/11/2026 đã chạy thử với `sandbox-exec` chặn toàn bộ mạng trên Mac M4 16 GB. Một ảnh mẫu xe 828 × 1171 px: đọc đúng 3 trường được hỏi (tên chủ xe, chủ mới, số khung), sinh 47 token và dừng bình thường, tổng thời gian gồm nạp model 16,59 giây. Bộ nhớ MLX cao nhất 6,59 GB, không phải tổng RAM của cả máy. Báo cáo: `data/sam3/runtime/qwen3-vl-download-check.json`. Đây là kiểm tra hoạt động trên một ảnh mô phỏng bằng font; chưa so sánh độ chính xác với OCR hiện tại.

Luồng **Lấy dữ liệu PDF** hiện vẫn dùng PaddleOCR-VL và Qwen3-4B. Tải model này chưa chuyển luồng sang phân tích ảnh bằng Qwen3-VL; bước đó cần nối ảnh trang/vùng vào bộ trích xuất và đánh giá riêng. Trên máy M4 16 GB, nên chạy một lượt AI tại một thời điểm.

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

Nguồn kỹ thuật: [PaddleOCR trên Apple Silicon](https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/PaddleOCR-VL-Apple-Silicon.html), [PaddleOCR-VL-1.6](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6), [Qwen3-4B gốc](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507), [bản MLX 4-bit](https://huggingface.co/mlx-community/Qwen3-4B-Instruct-2507-4bit).

## Hồ sơ công dân điền form

Bộ test mới có 12 PDF về đất đai, thừa kế, xe; đã nạp PostgreSQL local `hoso_dev` và có trong [danh sách mẫu](http://127.0.0.1:8765/scan-inbox.html?samples=citizen). Nguồn, phân biệt mẫu công khai / giả lập, cách thử và giới hạn chữ viết tay: [hướng dẫn bộ mẫu](../data/citizen-samples/README.md). Thao tác xếp hồ sơ trên giao diện vẫn chưa đồng bộ PostgreSQL.
