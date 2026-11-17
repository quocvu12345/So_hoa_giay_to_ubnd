# Hồ sơ số · phần AI

Phần AI của hệ thống Hồ sơ số UBND: đọc PDF, OCR, gợi ý nhóm hồ sơ, loại giấy tờ và trích trường. Mọi thứ chạy trên máy, không gọi dịch vụ cloud.

- `document_ai/`: OCR (PaddleOCR-VL 1.6) và phân loại, trích trường (Qwen3-4B-Instruct-2507 IFStruct) qua MLX.
- `ai-worker/`: worker lấy việc từ bảng `hoso.ocr_jobs` của PostgreSQL rồi ghi gợi ý trở lại. Chi tiết: [ai-worker/README.md](ai-worker/README.md).
- `scripts/setup-document-ai.sh`: cài môi trường Python và mô hình.

Repo này được xuất từ dự án chính bằng `scripts/export-ai-repo.sh`. Sửa mã ở dự án chính rồi xuất lại; sửa trực tiếp ở đây sẽ bị ghi đè ở lần xuất sau. Công cụ đo và huấn luyện (`ai-worker/training/`) chỉ có ở dự án chính.

## Mô hình

Mô hình **không nằm trong git**. Bước cài đặt tải chúng về `$DOCUMENT_AI_HOME/models`, ghim đúng commit và kiểm SHA-256.

| Việc | Mô hình | Dung lượng |
|---|---|---|
| Đọc chữ trang quét | `PaddlePaddle/PaddleOCR-VL-1.6`, `PP-DocLayoutV3`, `PP-LCNet_x1_0_doc_ori` | khoảng 2 GB |
| Chọn nhóm, loại, trích trường | [`ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct`](https://huggingface.co/ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct), tải bản BF16 (7,5 GB) rồi chuyển sang MLX 4-bit (2,1 GB) | 2,1 GB khi chạy |

Vì sao chọn IFStruct: [so sánh với Qwen3-4B gốc](ai-worker/training/SO-SANH-IFSTRUCT-QWEN4B.md). Trên 20 tài liệu và 79 giá trị có nhãn, IFStruct trích đúng 86,1% (bản gốc 78,5%) và bỏ sót 3 giá trị (bản gốc 8). Bộ nhớ và tốc độ tương đương bản gốc. Bộ thử là dữ liệu giả lập, chưa đo trên giấy tờ thật, nên cán bộ vẫn phải đối chiếu kết quả.

## Yêu cầu máy

- Mac Apple Silicon (MLX chỉ chạy trên chip M), macOS mới.
- RAM: tối thiểu 16 GB. Từ 24 GB thì đặt `HOSO_AI_MODEL_BUDGET_GB=8` để OCR và IFStruct cùng nằm trong bộ nhớ.
- Ổ đĩa: khoảng 15 GB trống khi cài. Sau khi xóa nguồn BF16 còn khoảng 6 GB.
- `uv` (`brew install uv`) hoặc Python 3.12. Cần mạng khi cài; lúc chạy không cần.

## Cài đặt

```sh
git clone https://github.com/quocvu12345/hoso-ai.git
cd hoso-ai
export DOCUMENT_AI_HOME="$HOME/hoso-ai-models"     # nơi đặt venv, mô hình, cache; chọn ổ còn đủ chỗ
./scripts/setup-document-ai.sh
```

Script này làm các bước sau:
1. Tạo venv Python 3.12.
2. Cài thư viện đã ghim (`document_ai/requirements.lock.txt`), kèm `psycopg`.
3. Tải mô hình.
4. Chuyển IFStruct sang MLX 4-bit.
5. In trạng thái.

Chạy lại được: bước nào xong thì bỏ qua, tệp tải dở thì tải tiếp. Kết quả đúng là `"ready": true` và `"classification_model": "Qwen3-4B-Instruct-2507-ifstruct · MLX 4-bit"`.

**Không muốn tải lại 7,5 GB:** chép thư mục `models/Qwen3-4B-Instruct-2507-ifstruct-4bit` từ máy đã chuyển sang `$DOCUMENT_AI_HOME/models/` trước khi chạy script. Khi đó script chỉ tải mô hình OCR.

Chuyển xong có thể xóa nguồn BF16: `rm -rf "$DOCUMENT_AI_HOME/models/Qwen3-4B-Instruct-2507-ifstruct-bf16"`.

## Thử nhanh, chưa cần CSDL

```sh
cd ai-worker
export HOSO_AI_PROFILE=mac-mlx
PY="$DOCUMENT_AI_HOME/venv/bin/python"
PYTHONPATH=src:.. "$PY" -m hoso_ai status
PYTHONPATH=src:.. "$PY" -m hoso_ai once --pdf ../database/samples/public-016.pdf --force-ocr
```

Lần đầu nạp mô hình mất thêm vài chục giây. Lệnh `once` dùng danh mục trong `assets/danh-muc-ho-so.js`.

## Nối vào hệ thống

Worker không nhận yêu cầu qua mạng. API và worker gặp nhau qua hai chỗ:
- **CSDL PostgreSQL:** CSDL của dự án chính, đã chạy migration đến `036` (migration này ghi IFStruct vào `ai_models`). Worker đăng nhập bằng role `hoso_ai_worker`. Role này được tạo ở trạng thái NOLOGIN, nên phải mở quyền đăng nhập và đặt mật khẩu: `ALTER ROLE hoso_ai_worker LOGIN PASSWORD '...'`.
- **Kho tệp:** worker đọc PDF từ `HOSO_AI_STORAGE_ROOT`, phải là **cùng thư mục** `Storage:Root` mà API ghi vào. Worker chỉ đọc được ổ đĩa local, chưa đọc S3/MinIO. Vì vậy, nếu máy AI tách khỏi máy chạy API, phải mount thư mục kho tệp của API sang máy AI (chỉ cần quyền đọc).

```sh
cd ai-worker
cp .env.example .env      # sửa: HOSO_AI_DATABASE_URL (kèm mật khẩu), HOSO_AI_STORAGE_ROOT, HOSO_AI_WORK_ROOT, DOCUMENT_AI_HOME
deploy/run-worker.sh status
deploy/run-worker.sh                    # chạy tay; Ctrl+C để dừng
```

Kiểm tra: `curl http://127.0.0.1:9108/health`. Mỗi job ghi mô hình đã dùng vào `ocr_jobs.model_version`, ví dụ `classifier=Qwen3-4B-Instruct-2507-ifstruct-4bit@00161de/short`. Trang vận hành của API cảnh báo nếu giá trị này lệch với `ai_models`.

## Chạy như dịch vụ

```sh
ai-worker/deploy/launchd/install.sh --dry-run   # xem trước
ai-worker/deploy/launchd/install.sh             # tự chạy khi đăng nhập, tự chạy lại khi lỗi
```

Nhật ký ghi ở `data/logs/ai-worker.log`. Gỡ dịch vụ bằng `--remove`.

## Cập nhật

```sh
git pull
ai-worker/deploy/launchd/install.sh          # nạp lại dịch vụ
```

Nếu `document_ai/config.py` đổi phiên bản mô hình, chạy lại `./scripts/setup-document-ai.sh`.

## Kiểm thử

```sh
cd ai-worker
"$DOCUMENT_AI_HOME/venv/bin/python" -m pytest -q          # pytest đã có trong requirements.lock.txt
```

Các test hợp đồng PostgreSQL tự bỏ qua khi chưa đặt `HOSO_AI_TEST_ADMIN_URL` và `HOSO_AI_TEST_TEMPLATE` (xem `ai-worker/README.md`).
