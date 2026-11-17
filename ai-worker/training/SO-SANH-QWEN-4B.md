# So sánh Qwen3.5-4B với Qwen3-4B

Ngày đo: 2026-11-17. Mac M4 16 GB, MLX 4-bit, chỉ xử lý văn bản OCR; không đưa ảnh vào Qwen.

**Kết luận:** chưa nên thay Qwen3-4B-Instruct-2507 bằng Qwen3.5-4B trong cấu hình hiện tại. Bản mới trích đúng ít hơn 6/79 giá trị (giảm 7,6 điểm phần trăm), bỏ sót nhiều hơn, dùng thêm khoảng 25% bộ nhớ MLX; tốc độ trung vị gần như bằng nhau. Model mới đã cài, được ghim phiên bản và chạy được trong worker; giữ ở dạng tùy chọn thử nghiệm. Chưa đánh giá khả năng nhận ảnh trực tiếp hoặc prompt được tối ưu riêng cho 3.5.

## Kết quả ghép cặp

| Chỉ số | Qwen3-4B-Instruct-2507-4bit | Qwen3.5-4B-4bit |
|---|---:|---:|
| Đúng nhóm | 20/20 (100.0%) | 20/20 (100.0%) |
| Đúng loại | 20/20 (100.0%) | 20/20 (100.0%) |
| Loại được shortlist quyết định theo tiêu đề | 17/20 (85.0%) | 17/20 (85.0%) |
| Đúng loại — filled | 9/9 (100.0%) | 9/9 (100.0%) |
| Đúng loại — citizen | 11/11 (100.0%) | 11/11 (100.0%) |
| Trường đúng (nhãn có trong schema) | 62/79 (78.5%) | 56/79 (70.9%) |
| Trường sai giá trị | 9/79 (11.4%) | 8/79 (10.1%) |
| Trường bỏ sót | 8/79 (10.1%) | 15/79 (19.0%) |
| Trường đúng trong số OCR đọc được | 62/69 (89.9%) | 56/69 (81.2%) |
| Thời gian trung vị (giây/tài liệu) | 23.7 | 23.5 |
| Thời gian p90 (giây/tài liệu) | 56.4 | 41.9 |
| Lỗi phân loại/JSON | 0 | 0 |
| Tài liệu có lỗi trích nhóm trường | 1 | 3 |
| Thời gian nạp (giây) | 2.9 | 3.3 |
| Bộ nhớ MLX đỉnh (GiB) | 2.98 | 3.71 |

## Phương pháp và giới hạn

- 20 tài liệu: 9 mẫu điền font và 11 biểu mẫu citizen; 12 tài liệu có đáp án trường, tổng cộng 81 giá trị. Đây là dữ liệu giả lập/biểu mẫu công khai, chưa đánh giá trên giấy tờ thật.
- Cùng OCR đã lưu, cùng snapshot PostgreSQL 38 nhóm/427 loại; không cung cấp đáp án cho model. restrict_types_to_group=True, shortlist=True, prompt=production, temperature=0, thinking=False. MLX-LM chỉ nạp phần ngôn ngữ của Qwen3.5.
- Hai model chạy lần lượt. Worker và các OCR server đã dừng để tránh tranh GPU. Các ứng dụng khác trên máy vẫn chạy; swap có sẵn không có nghĩa là toàn bộ do model.
- Tốc độ chỉ gồm phân loại và trích trường; không gồm OCR, tải model hay thời gian nạp. P90 theo nearest rank. Bộ nhớ MLX đỉnh không phải tổng RAM cả máy.
- Shortlist có thể quyết định loại theo tiêu đề; kết quả là chất lượng toàn pipeline với cấu hình này, không phải năng lực model khi tự chọn trong toàn danh mục.
- Chấm giá trị bằng nhãn và chuỗi chuẩn hóa Unicode/hoa-thường/khoảng trắng, giữ dấu tiếng Việt. Không đủ nhãn để tính tỷ lệ điền nhầm ô trống trên toàn bộ form. Trích dẫn có trong OCR không đảm bảo chọn đúng vai trò/người.
- Loại khỏi mẫu số trường những nhãn đáp án không có trong schema hiện tại: filled-u09-d13: Ngày cấp giấy tờ người lập di chúc; filled-u09-d13: Nơi cấp giấy tờ người lập di chúc.

## Chi tiết từng tài liệu

| Tài liệu | Loại đáp án | Qwen3-4B | Qwen3.5-4B | Giây 3 / 3.5 |
|---|---|---|---|---:|
| filled-h01-d01 | H01-D01 | H01-D01 | H01-D01 | 13.24 / 13.41 |
| filled-h05-d04 | H05-D04 | H05-D04 | H05-D04 | 13.86 / 13.22 |
| filled-u01-d04 | U01-D04 | U01-D04 | U01-D04 | 14.17 / 8.78 |
| filled-u04-d13 | U04-D13 | U04-D13 | U04-D13 | 14.01 / 17.05 |
| filled-u09-d02 | U09-D02 | U09-D02 | U09-D02 | 12.94 / 13.11 |
| filled-u09-d13 | U09-D13 | U09-D13 | U09-D13 | 18.44 / 18.61 |
| filled-u15-d01 | U15-D01 | U15-D01 | U15-D01 | 12.31 / 13.21 |
| filled-u18-d09 | U18-D09 | U18-D09 | U18-D09 | 14.58 / 13.63 |
| filled-u25-d02 | U25-D02 | U25-D02 | U25-D02 | 16.68 / 9.78 |
| citizen-land-contract | U15-D14 | U15-D14 | U15-D14 | 36.95 / 35.66 |
| citizen-inheritance-request | U09-D11 | U09-D11 | U09-D11 | 71.25 / 45.24 |
| citizen-inheritance-kinship | U09-D12 | U09-D12 | U09-D12 | 22.79 / 27.46 |
| citizen-inheritance-will | U09-D13 | U09-D13 | U09-D13 | 34.45 / 25.66 |
| citizen-vehicle-registration | U27-D12 | U27-D12 | U27-D12 | 56.39 / 99.46 |
| citizen-vehicle-recall | U27-D13 | U27-D13 | U27-D13 | 24.63 / 21.3 |
| citizen-vehicle-contract | U27-D14 | U27-D14 | U27-D14 | 34.19 / 32.29 |
| citizen-land-filled-public | U15-D02 | U15-D02 | U15-D02 | 60.04 / 40.61 |
| citizen-land-hand-sim | U15-D14 | U15-D14 | U15-D14 | 37.46 / 38.8 |
| citizen-inheritance-hand-sim | U09-D12 | U09-D12 | U09-D12 | 37.85 / 41.91 |
| citizen-vehicle-hand-sim | U27-D13 | U27-D13 | U27-D13 | 29.76 / 27.55 |

## Phiên bản và khả năng chạy lại

- `mlx-community/Qwen3-4B-Instruct-2507-4bit@50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b`; thời điểm kết thúc `2026-11-17 14:28:02`.
  Bộ nhớ hệ thống trước/sau: `{"available_gb": 6.69, "swap_used_gb": 9.81, "swap_out_gb_total": 3.15}` → `{"available_gb": 4.09, "swap_used_gb": 8.91, "swap_out_gb_total": 3.18}`.
- `mlx-community/Qwen3.5-4B-4bit@0e7ffd5c629ef7719d4cbc04069232580bfa9d9c`; thời điểm kết thúc `2026-11-17 14:37:25`.
  Bộ nhớ hệ thống trước/sau: `{"available_gb": 7.05, "swap_used_gb": 8.91, "swap_out_gb_total": 3.18}` → `{"available_gb": 3.73, "swap_used_gb": 8.77, "swap_out_gb_total": 3.21}`.
- Thư viện: `{"mlx": "0.32.4", "mlx-lm": "0.32.2", "transformers": "5.22.2"}`.
- SHA-256 dữ liệu: `db2df10c268694426da8a7d68e32be2cb7a12caf5232e27e6605b8144dc8f836`.
- SHA-256 danh mục: `1a15d5e47919b88c10ca182cb09779fd1aba6aa4af1bd4e8f9f53480780ad764`.

## Nhận xét lỗi

- 17/20 loại được shortlist chọn theo tiêu đề ở cả hai bản. Không diễn giải 100% đúng loại thành model tự phân loại hoàn hảo.
- 3.5 cải thiện 5 giá trị nhưng làm sai/bỏ sót 11 giá trị mà 3-4B đã trích đúng. Ví dụ: cải thiện biển số xe, nhưng bỏ sót số máy/số khung trong mẫu xe điền tay mô phỏng.
- 3-4B có một tài liệu lỗi JSON ở nhóm trường cuối (`citizen-inheritance-request`). 3.5 có ba: mẫu đó, `citizen-vehicle-registration`, `citizen-vehicle-hand-sim`. Nhóm trường lỗi bị bỏ theo logic production, vẫn được tính là bỏ sót trong phép chấm.
- Tổng thời gian LLM của 20 tài liệu: 576 giây với 3-4B và 557 giây với 3.5. Mẫu chậm nhất: 71,3 và 99,5 giây. P90 thấp hơn không đồng nghĩa mọi tài liệu đều nhanh hơn.
- Đáp án có 82 nhãn: một nhãn trống không dùng trong phép chấm giá trị có sẵn; hai nhãn không có trong schema được loại, còn 79. Trong 79 giá trị này, chỉ 69 xuất hiện nguyên văn trong OCR. Model phía sau OCR không thể phục hồi đáng tin cậy phần OCR đã mất bằng cách suy đoán.

## Thử qua API và worker thật

- Dùng cấu hình riêng `data/dev-run/qwen35-trial.env`: Qwen3.5-4B, ngân sách 7 GB, ước tính model 4,5 GB, prompt production. Scheduler bỏ OCR trước khi nạp classifier.
- `scripts/smoke-ai-flow.py --pdf filled-u02-d01 --expect-model Qwen3.5-4B-4bit`: **43 giây, 0 kiểm tra hỏng**. Đúng loại U02-D01, 5/6 trường có giá trị và có trích dẫn khớp OCR. Đây là kiểm tra tích hợp, không phải xác nhận cả 5 giá trị đúng đáp án.
- Job ghi `ocr=PaddleOCR-VL-1.6@132c45f classifier=Qwen3.5-4B-4bit@0e7ffd5/production` trong CSDL. Giấy tờ thử đã bỏ khỏi hộp tiếp nhận.
- Sau thử nghiệm đã dừng worker trial, giải phóng tiến trình con và khởi động lại worker bằng `ai-worker/.env` ban đầu (Qwen3-1.7B). Không thay mặc định dịch vụ hoặc dòng `ai_models` trong lượt so sánh này.
- Nhật ký: `data/dev-run/qwen35-trial-smoke.log`, `qwen35-trial-worker.log`, `qwen35-trial-result.json`.
- Kiểm thử mã sau thay đổi: `pytest -q` trong `ai-worker`: **89 passed, 22 skipped** (22 test hợp đồng CSDL cần cấu hình riêng). `git diff --check` qua.

## Chạy lại

Chạy từ thư mục gốc repo. Cần tạm dừng worker/tiến trình dùng GPU trước khi đo; hai lệnh LLM chạy **lần lượt**.

```sh
./scripts/document-ai.sh download --model classifier_35_4b

AI_PYTHON=/Volumes/quocDisk/AI/paddleocr/venv/bin/python
BENCH_DIR=/Volumes/quocDisk/AI/paddleocr/training/bench

"$AI_PYTHON" ai-worker/training/bench_pipeline.py llm --model qwen3-4b \
  --input "$BENCH_DIR/qwen4b-paired-input.jsonl" --catalog "$BENCH_DIR/qwen4b-catalog.json" \
  --shortlist --tag=-repeat20-sl-prod
"$AI_PYTHON" ai-worker/training/bench_pipeline.py llm --model qwen3.5-4b \
  --input "$BENCH_DIR/qwen4b-paired-input.jsonl" --catalog "$BENCH_DIR/qwen4b-catalog.json" \
  --shortlist --tag=-repeat20-sl-prod
"$AI_PYTHON" ai-worker/training/compare_models.py \
  --baseline "$BENCH_DIR/llm-qwen3-4b-repeat20-sl-prod.json" \
  --candidate "$BENCH_DIR/llm-qwen3.5-4b-repeat20-sl-prod.json" \
  --catalog "$BENCH_DIR/qwen4b-catalog.json" --output /tmp/qwen-comparison.md
```

Snapshot OCR gồm các vị trí 0, 4, 9, 13, 18, 19, 25, 29, 35 trong nhóm `filled` của `bench/ocr.jsonl`, cộng toàn bộ nhóm `citizen`, giữ thứ tự. Danh mục được đọc từ các dòng active trong `hoso.work_groups`, `hoso.document_types`, `hoso.field_definitions`, cùng cấu trúc mà worker truyền cho `classify`. Snapshot và kết quả thô được giữ ngoài Git tại `BENCH_DIR`:

- `qwen4b-paired-input.jsonl`, `qwen4b-catalog.json`.
- `llm-qwen3-4b-paired20-sl-prod.json`, `llm-qwen3.5-4b-paired20-sl-prod.json`: từng trường, trích dẫn, lỗi, số token và thời gian từng lần gọi.
- Model được xác minh kích thước, SHA-256 trọng số và git blob của cấu hình bằng công cụ tải; biên nhận: `/Volumes/quocDisk/AI/paddleocr/download-receipt.json`, mục `classifier_35_4b`.

Muốn chọn model cho một worker thử: đặt `HOSO_AI_CLASSIFIER_MODEL=Qwen3.5-4B-4bit` trong tệp môi trường riêng, dùng `HOSO_AI_ENV_FILE=/duong/dan/tep.env ai-worker/deploy/run-worker.sh run`. Ngân sách 7 GB chủ động chạy OCR và classifier lần lượt. Bản gốc trên Hugging Face không được dùng trực tiếp; đã cài bản chuyển đổi MLX 4-bit của `mlx-community`.
