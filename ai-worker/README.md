# ai-worker · Dịch vụ AI chạy cục bộ (Python)

Worker lấy việc từ bảng `hoso.ocr_jobs` trong PostgreSQL (`FOR UPDATE SKIP LOCKED`), đọc PDF, OCR, gợi ý loại giấy tờ và trường,
rồi ghi kết quả về CSDL. API .NET không gọi worker trực tiếp; hai bên chỉ gặp nhau qua CSDL (giao kèo: `backend/database/migrations/013_processing.sql`).
Không gửi dữ liệu ra ngoài máy. Mô hình: PaddleOCR-VL 1.6 và Qwen3-1.7B (MLX, mặc định; đổi bằng `HOSO_AI_CLASSIFIER_MODEL`) trên Mac Apple Silicon, nạp từ `DOCUMENT_AI_HOME`.

```
PDFium (lớp chữ có sẵn?) ─ có ─▶ dùng luôn
        │ không
        ▼
render PNG → kiểm tra ảnh (trống/mờ) → PaddleOCR-VL → lưu ocr_pages → xóa ảnh tạm
        ▼
Qwen3-1.7B: nhóm → loại giấy tờ → trường (mỗi giá trị phải có trích dẫn nằm trong văn bản gốc) → ai_suggestions
```

## Chạy

```sh
cp .env.example .env            # chỉnh đường dẫn, mật khẩu role hoso_ai_worker
set -a; . ./.env; set +a
PYTHONPATH=src:.. python -m hoso_ai status          # kiểm tra mô hình và cấu hình
PYTHONPATH=src:.. python -m hoso_ai once --pdf ../database/samples/public-016.pdf --force-ocr   # thử một PDF, không cần CSDL
PYTHONPATH=src:.. python -m hoso_ai run             # vòng lặp lấy việc; /health và /metrics ở 127.0.0.1:9108
```

Phải cài gói worker vào **đúng Python dùng để chạy mô hình** (`pip install -e '.[dev]'` từ thư mục `ai-worker`).
Môi trường `document_ai/` riêng chỉ có OCR/MLX, chưa chắc đã có `psycopg` để nối PostgreSQL.
Nếu môi trường mô hình không có pip, từ thư mục gốc repo dùng Python có pip:
`python3 -m pip --python "$DOCUMENT_AI_HOME/venv/bin/python" install -e './ai-worker[dev]'`.
`status` chỉ kiểm tra cấu hình và tệp mô hình; trường `database=true` không chứng minh đã kết nối được DB.
API chạy được hoặc mô hình đã tải đủ cũng không có nghĩa worker đã chạy: cần cấu hình `.env`, role DB đăng nhập được,
kho tệp khớp API và tiến trình `run` đang hoạt động.

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
- Giới hạn của worker: `HOSO_AI_MAX_PAGES` (mặc định 500), `HOSO_AI_PAGE_TIMEOUT_SECONDS` (300), `HOSO_AI_MAX_ATTEMPTS` (3; chỉ tính lần thử thật, không tính lần nhường chỗ).

## Mô hình, khay nền và thứ tự lấy việc (AI-13…AI-15)

- **Chọn mô hình bằng cấu hình:** `HOSO_AI_CLASSIFIER_MODEL` (tên thư mục trong `models/`). Mô hình được nạp **một lần** và giữ giữa các job; bỏ mô hình thì trả bộ nhớ GPU (`mx.clear_cache`). Thiếu thư mục thì worker dừng ngay lúc khởi động, kèm danh sách mô hình đang có. Mỗi job ghi `ocr_jobs.model_version`, ví dụ `ocr=PaddleOCR-VL-1.6@132c45f classifier=Qwen3-1.7B-4bit@3b1b176/short` (không ghi OCR nếu mọi trang lấy từ lớp chữ PDF).
- **Thứ tự lấy việc:** `priority` (số nhỏ trước), rồi lúc người dùng nâng mức (`prioritized_at`) hoặc lúc tạo. Mức: 1 làm ngay, 3 có người chờ, 7 khay nền (PDF mới tải lên).
- **Khay nền:** chỉ chạy khi không còn việc mức thấp hơn; ngoài khung giờ `HOSO_AI_BACKGROUND_WINDOWS` chỉ lấy việc có người chờ. Việc nền đang chạy kiểm tra sau **mỗi trang** (và trước bước phân loại) xem có việc có người chờ không; có thì trả về hàng đợi, giữ các trang đã đọc. Việc đã được nâng mức thì không còn bị nhường. Nhường chỗ KHÔNG tính là một lần thử: `attempt` vẫn tăng đều (là mã chống nhầm chủ sở hữu), giới hạn thử lại tính `attempt - preempted_count`.
- **Thu hẹp ứng viên bằng từ khóa (`HOSO_AI_SHORTLIST`, mặc định bật):** mô hình nhỏ như Qwen3-1.7B tự chọn nhóm và loại rất kém trên danh mục 38 nhóm. `document_ai/shortlist.py` chấm điểm tên loại với phần đầu tài liệu (ưu tiên dòng tiêu đề in hoa), chỉ đưa cho mô hình 8 nhóm và 10 loại khớp nhất; tài liệu tự in tên loại và không loại nào khác sát bằng thì dùng loại đó, nhiều trang tự ghi tên loại khác nhau thì báo gói nhiều giấy tờ cần tách. Không khớp gì thì giữ nguyên như cũ. **Mới đo trên tài liệu giả lập (in sẵn tên loại làm tiêu đề), chưa đo trên giấy tờ thật.**
- **Chẩn đoán:** `kill -USR1 <pid worker>` ghi ngăn xếp mọi luồng vào nhật ký. Watchdog cấp vòng lặp thoát mã 75 khi vòng lặp rảnh không quay quá 120 giây hoặc tắt máy quá 180 giây.
- **Lời nhắc:** `HOSO_AI_PROMPT_INTERACTIVE` (mặc định `short`) cho việc có người chờ, `HOSO_AI_PROMPT_BACKGROUND` (mặc định `production`) cho khay nền. Lời nhắc ngắn chỉ đổi bước trích trường; nhanh khoảng 3 lần nhưng sai nhiều hơn một chút (4,3% so với 3,0% trên dữ liệu giả); giá trị vẫn phải có nguyên văn trong văn bản.

## Kiểm thử

So sánh bản tinh chỉnh tuân thủ JSON/schema IFStruct với Qwen3-4B: [kết quả và cách chạy](training/SO-SANH-IFSTRUCT-QWEN4B.md).
Từ gốc repo, tải `scripts/document-ai.sh download --model ifstruct_source`, rồi chạy `scripts/document-ai.sh convert-ifstruct`.
Bản MLX dùng cùng prompt/pipeline Qwen; chọn cho worker thử bằng `HOSO_AI_CLASSIFIER_MODEL=Qwen3-4B-Instruct-2507-ifstruct-4bit` trong tệp môi trường riêng.
Khi đo `bench_pipeline.py llm`, thêm `--exclusive` để từ chối nếu có worker/model khác lúc bắt đầu và ghi nhận tiến trình xuất hiện giữa lượt đo.

So sánh BKEE entity-extraction với Qwen3-4B trên cùng bộ 20 tài liệu/79 giá trị có nhãn: [kết quả và cách chạy](training/SO-SANH-BKEE-QWEN4B.md).
Tải `scripts/document-ai.sh download --model bkee_source`, chuyển bằng `scripts/document-ai.sh convert-bkee`,
rồi chọn `--model qwen3-4b-bkee` trong benchmark. `probe_bkee.py` thử riêng prompt NER gốc; kết quả này không chấm bằng nhãn trường hành chính.

So sánh Qwen3.5-4B với Qwen3-4B trên cùng văn bản OCR và danh mục: [báo cáo và cách chạy](training/SO-SANH-QWEN-4B.md).
Tải bản thử đã ghim phiên bản bằng `./scripts/document-ai.sh download --model classifier_35_4b` từ thư mục gốc repo;
chọn bằng `HOSO_AI_CLASSIFIER_MODEL=Qwen3.5-4B-4bit`. Model mới dùng chế độ không thinking như các bản hiện tại.

```sh
pip install -e '.[dev]'
pytest -q                                            # 24 test không cần CSDL; các test DB bỏ qua nếu chưa cấu hình
# Hợp đồng với PostgreSQL thật (tạo CSDL tạm từ một CSDL đã chạy migration 000–020):
HOSO_AI_TEST_ADMIN_URL=postgresql://quoc@127.0.0.1:5432/postgres \
HOSO_AI_TEST_TEMPLATE=hoso_ai_test_template pytest -q tests/test_postgres_contract.py    # 17 test
```

CSDL mẫu (`HOSO_AI_TEST_TEMPLATE`) không được có kết nối đang mở khi sao chép. Nên tạo và migrate CSDL mẫu riêng,
không dùng `hoso_dev` đang chạy. Các phép ghi của worker trong test chạy với `SET ROLE hoso_ai_worker`;
tài khoản quản trị chỉ tạo/xóa CSDL tạm và chuẩn bị dữ liệu test.

Danh mục phân loại và nhãn trường lấy từ các mục đang hoạt động trong PostgreSQL, kể cả loại chưa có trường.
Worker chỉ chọn loại thuộc nhóm đã chọn để khớp khóa ngoại; bản thí điểm `document_ai/` vẫn dùng danh mục JS khi gọi độc lập.
Mỗi lần ghi kết quả kiểm tra worker, số lượt chạy và trạng thái trong transaction: kết quả muộn không ghi đè job đã hủy/thu hồi.

## Huấn luyện và đánh giá mô hình trích trường

Xem [training/](training/): `select_docs.py` → `ocr_batch.py` → `build_sft.py` → LoRA (`mlx_lm.lora`) → `eval_extract.py`.
Dữ liệu và kết quả nằm ngoài repo, ở `$DOCUMENT_AI_HOME/training/`.

Thử NuExtract3-kie-vi bằng bộ trích trường riêng: [so sánh với Qwen3-4B và cách chạy](training/SO-SANH-NUEXTRACT-QWEN4B.md).
Từ gốc repo, `scripts/document-ai.sh download --model nuextract_source` tải nguồn đã ghim và xác minh SHA-256;
`scripts/document-ai.sh convert-nuextract` chuyển sang MLX 4-bit, giữ vision tower và chat template gốc.
Trước khi chuyển/chạy ảnh, cài `document_ai/requirements-nuextract.txt` vào venv AI (phụ thuộc processor; inference vẫn dùng MLX).
`scripts/document-ai.sh extract-fields --help` là giao diện chạy local trên OCR hoặc ảnh với schema đã biết.
NuExtract dùng prompt riêng, chưa tích hợp thay thế classifier trong worker; không chọn nó bằng `HOSO_AI_CLASSIFIER_MODEL`.

## Bảo mật

- Role `hoso_ai_worker` chỉ đọc `files`, `documents`, danh mục và ghi các bảng nhóm F; **không** đọc người dùng, phân quyền, hồ sơ, nhật ký (có test).
- Tệp được kiểm SHA-256 trước khi xử lý; khóa tệp phải đúng dạng `blobs/ab/cd/<sha256>`.
- Nội dung tài liệu coi là dữ liệu, không phải chỉ dẫn cho mô hình; nhật ký không ghi nội dung (`logging.py` che các khóa nhạy cảm).
- Việc còn lại (AI-08): chạy PDFium trong tiến trình con có giới hạn thời gian và bộ nhớ.
