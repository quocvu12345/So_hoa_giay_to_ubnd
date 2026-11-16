# ai-worker · Dịch vụ AI chạy cục bộ (Python)

Worker lấy việc từ bảng `hoso.ocr_jobs` trong PostgreSQL (`FOR UPDATE SKIP LOCKED`), đọc PDF, OCR, gợi ý loại giấy tờ và trường,
rồi ghi kết quả về CSDL. API .NET không gọi worker trực tiếp; hai bên chỉ gặp nhau qua CSDL (giao kèo: `backend/database/migrations/013_processing.sql`).
Không gửi dữ liệu ra ngoài máy. Mô hình: PaddleOCR-VL 1.6 và Qwen3-4B (MLX) trên Mac Apple Silicon, nạp từ `DOCUMENT_AI_HOME`.

```
PDFium (lớp chữ có sẵn?) ─ có ─▶ dùng luôn
        │ không
        ▼
render PNG → kiểm tra ảnh (trống/mờ) → PaddleOCR-VL → lưu ocr_pages → xóa ảnh tạm
        ▼
Qwen3-4B: nhóm → loại giấy tờ → trường (mỗi giá trị phải có trích dẫn nằm trong văn bản gốc) → ai_suggestions
```

## Chạy

```sh
cp .env.example .env            # chỉnh đường dẫn, mật khẩu role hoso_ai_worker
set -a; . ./.env; set +a
PYTHONPATH=src:.. python -m hoso_ai status          # kiểm tra mô hình và cấu hình
PYTHONPATH=src:.. python -m hoso_ai once --pdf ../database/samples/public-016.pdf --force-ocr   # thử một PDF, không cần CSDL
PYTHONPATH=src:.. python -m hoso_ai run             # vòng lặp lấy việc; /health và /metrics ở 127.0.0.1:9108
```

Với `HOSO_AI_PROFILE=fake` mọi thứ chạy không cần mô hình; kết quả ghi `model_key='fake'` (bản ghi `ai_models.active=false`) nên không bao giờ lẫn với kết quả thật.

## Chạy như dịch vụ (AI-09)

Máy khởi động lại thì worker tự chạy, lỗi thì tự chạy lại. Mọi cách đều đi qua `deploy/run-worker.sh` (nạp `.env`, chọn Python, đặt `PYTHONPATH`; mã thoát 78 khi thiếu cấu hình).

| Máy | Cách | Lệnh |
|---|---|---|
| Mac Apple Silicon | LaunchAgent của người dùng chạy máy (MLX cần GPU của phiên người dùng) | `deploy/launchd/install.sh` (xem trước: `--dry-run`; gỡ: `--remove`) · nhật ký `data/logs/ai-worker.log` |
| Linux | `deploy/systemd/hoso-ai-worker.service`: người dùng riêng `hoso-ai`, cấu hình ở `/etc/hoso/ai-worker.env`, hạn chế quyền, `MemoryMax` | sao vào `/etc/systemd/system/`, `systemctl enable --now hoso-ai-worker` |

- Dừng: cả hai gửi `SIGTERM`; worker xong trang đang đọc rồi thoát (chờ tối đa 180 giây). Việc dở được thu hồi sau khi mất nhịp sống (`StaleJobReaper` ở API).
- Kiểm tra sống: `curl http://127.0.0.1:9108/health` và `/metrics` (chỉ nghe 127.0.0.1).
- Đã kiểm: cú pháp script bash, `plutil -lint` cho plist, `run-worker.sh status` với profile `fake`, các mã thoát 78. **Chưa chạy thử cài đặt thật** (`launchctl bootstrap`, `systemctl`) vì cần máy dành riêng cho worker và không có systemd trên máy dev; đây là bản đề xuất cần thử một lần khi triển khai.
- Giới hạn của worker: `HOSO_AI_MAX_PAGES` (mặc định 500), `HOSO_AI_PAGE_TIMEOUT_SECONDS` (300), `HOSO_AI_MAX_ATTEMPTS` (3).

## Kiểm thử

```sh
pip install -e '.[dev]'
pytest -q                                            # 17 test, không cần CSDL
# Hợp đồng với PostgreSQL thật (tạo CSDL tạm từ một CSDL đã chạy migration 000–020):
HOSO_AI_TEST_ADMIN_URL=postgresql://quoc@127.0.0.1:5432/postgres \
HOSO_AI_TEST_TEMPLATE=hoso_dev pytest -q tests/test_postgres_contract.py    # 8 test
```

CSDL mẫu (`HOSO_AI_TEST_TEMPLATE`) không được có kết nối đang mở khi sao chép: tắt API đang chạy trên đó trước.

## Huấn luyện và đánh giá mô hình trích trường

Xem [training/](training/): `select_docs.py` → `ocr_batch.py` → `build_sft.py` → LoRA (`mlx_lm.lora`) → `eval_extract.py`.
Dữ liệu và kết quả nằm ngoài repo, ở `$DOCUMENT_AI_HOME/training/`.

## Bảo mật

- Role `hoso_ai_worker` chỉ đọc `files`, `documents`, danh mục và ghi các bảng nhóm F; **không** đọc người dùng, phân quyền, hồ sơ, nhật ký (có test).
- Tệp được kiểm SHA-256 trước khi xử lý; khóa tệp phải đúng dạng `blobs/ab/cd/<sha256>`.
- Nội dung tài liệu coi là dữ liệu, không phải chỉ dẫn cho mô hình; nhật ký không ghi nội dung (`logging.py` che các khóa nhạy cảm).
- Việc còn lại (AI-08): chạy PDFium trong tiến trình con có giới hạn thời gian và bộ nhớ.
