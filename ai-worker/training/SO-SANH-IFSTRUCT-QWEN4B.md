# So sánh Qwen3-4B IFStruct với Qwen3-4B gốc

Ngày đo: 2026-11-17. Mac M4 16 GB, MLX 4-bit, chỉ xử lý văn bản OCR; không đưa ảnh vào Qwen.

**Kết luận:** trên bộ thử của dự án, IFStruct MLX 4-bit trích đúng thêm 6/79 giá trị (từ 78,5% lên 86,1%), giảm bỏ sót từ 8 xuống 3 và không còn lỗi trích nhóm trường ở lượt đo này. Dung lượng trọng số và bộ nhớ MLX tương đương bản gốc. Đây là ứng viên đáng thử khi ưu tiên độ đúng, chưa có lợi thế tốc độ nhất quán. Vẫn có lỗi vai trò người và đơn vị tiền; chưa nên tự động chấp nhận kết quả mà bỏ bước đối chiếu.

Đã chạy thật qua API và worker bằng cấu hình riêng, sau đó khôi phục cấu hình ban đầu. Kết quả dưới đây dùng **prompt production cho cả hai**, không phải prompt short của lượt NuExtract trước.

## Kết quả ghép cặp

| Chỉ số | Qwen3-4B-Instruct-2507-4bit | Qwen3-4B-Instruct-2507-ifstruct-4bit |
|---|---:|---:|
| Đúng nhóm | 20/20 (100.0%) | 20/20 (100.0%) |
| Đúng loại | 20/20 (100.0%) | 20/20 (100.0%) |
| Loại được shortlist quyết định theo tiêu đề | 17/20 (85.0%) | 17/20 (85.0%) |
| Đúng loại — filled | 9/9 (100.0%) | 9/9 (100.0%) |
| Đúng loại — citizen | 11/11 (100.0%) | 11/11 (100.0%) |
| Trường đúng (nhãn có trong schema) | 62/79 (78.5%) | 68/79 (86.1%) |
| Trường sai giá trị | 9/79 (11.4%) | 8/79 (10.1%) |
| Trường bỏ sót | 8/79 (10.1%) | 3/79 (3.8%) |
| Trường đúng trong số OCR đọc được | 62/69 (89.9%) | 68/69 (98.6%) |
| Thời gian trung vị (giây/tài liệu) — 19 cặp trước cảnh báo giám sát | 23.11 | 24.43 |
| Thời gian p90 (giây/tài liệu) — 19 cặp trước cảnh báo giám sát | 61.78 | 45.12 |
| Lỗi phân loại/JSON | 0 | 0 |
| Tài liệu có lỗi trích nhóm trường | 1 | 0 |
| Thời gian nạp (giây) | 2.9 | 2.8 |
| Bộ nhớ MLX đỉnh (GiB) | 2.98 | 2.98 |

## Phương pháp và giới hạn

- 20 tài liệu: 9 mẫu điền font và 11 biểu mẫu citizen; 12 tài liệu có đáp án trường, tổng cộng 81 giá trị. Đây là dữ liệu giả lập/biểu mẫu công khai, chưa đánh giá trên giấy tờ thật.
- Cùng OCR đã lưu, cùng snapshot PostgreSQL 38 nhóm/427 loại; không cung cấp đáp án cho model. restrict_types_to_group=True, shortlist=True, prompt=production, temperature=0, thinking=False. MLX-LM xử lý văn bản OCR.
- Worker và OCR server đã dừng trước hai lượt. Bộ giám sát ghi một cảnh báo ở tài liệu cuối của IFStruct; bảng thời gian chỉ dùng 19 cặp hoàn thành trước cảnh báo, xem giải thích bên dưới. Các ứng dụng khác trên máy vẫn chạy; swap có sẵn không có nghĩa là toàn bộ do model.
- Tốc độ chỉ gồm phân loại và trích trường; không gồm OCR, tải model hay thời gian nạp. P90 theo nearest rank. Bộ nhớ MLX đỉnh không phải tổng RAM cả máy.
- Shortlist có thể quyết định loại theo tiêu đề; kết quả là chất lượng toàn pipeline với cấu hình này, không phải năng lực model khi tự chọn trong toàn danh mục.
- Chấm giá trị bằng nhãn và chuỗi chuẩn hóa Unicode/hoa-thường/khoảng trắng, giữ dấu tiếng Việt. Không đủ nhãn để tính tỷ lệ điền nhầm ô trống trên toàn bộ form. Trích dẫn có trong OCR không đảm bảo chọn đúng vai trò/người.
- Loại khỏi mẫu số trường những nhãn đáp án không có trong schema hiện tại: filled-u09-d13: Ngày cấp giấy tờ người lập di chúc; filled-u09-d13: Nơi cấp giấy tờ người lập di chúc.

## Chi tiết từng tài liệu

| Tài liệu | Loại đáp án | Qwen3-4B-Instruct-2507-4bit | Qwen3-4B-Instruct-2507-ifstruct-4bit | Giây baseline / candidate |
|---|---|---|---|---:|
| filled-h01-d01 | H01-D01 | H01-D01 | H01-D01 | 14.25 / 16.53 |
| filled-h05-d04 | H05-D04 | H05-D04 | H05-D04 | 14.61 / 17.03 |
| filled-u01-d04 | U01-D04 | U01-D04 | U01-D04 | 14.75 / 17.55 |
| filled-u04-d13 | U04-D13 | U04-D13 | U04-D13 | 14.67 / 17.29 |
| filled-u09-d02 | U09-D02 | U09-D02 | U09-D02 | 13.5 / 16.26 |
| filled-u09-d13 | U09-D13 | U09-D13 | U09-D13 | 19.35 / 23.2 |
| filled-u15-d01 | U15-D01 | U15-D01 | U15-D01 | 13.12 / 15.32 |
| filled-u18-d09 | U18-D09 | U18-D09 | U18-D09 | 15.44 / 18.44 |
| filled-u25-d02 | U25-D02 | U25-D02 | U25-D02 | 17.3 / 22.47 |
| citizen-land-contract | U15-D14 | U15-D14 | U15-D14 | 38.7 / 47.09 |
| citizen-inheritance-request | U09-D11 | U09-D11 | U09-D11 | 74.91 / 45.12 |
| citizen-inheritance-kinship | U09-D12 | U09-D12 | U09-D12 | 23.11 / 28.36 |
| citizen-inheritance-will | U09-D13 | U09-D13 | U09-D13 | 34.57 / 29.76 |
| citizen-vehicle-registration | U27-D12 | U27-D12 | U27-D12 | 58.25 / 35.85 |
| citizen-vehicle-recall | U27-D13 | U27-D13 | U27-D13 | 25.34 / 24.43 |
| citizen-vehicle-contract | U27-D14 | U27-D14 | U27-D14 | 35.04 / 39.11 |
| citizen-land-filled-public | U15-D02 | U15-D02 | U15-D02 | 61.78 / 42.41 |
| citizen-land-hand-sim | U15-D14 | U15-D14 | U15-D14 | 38.71 / 43.44 |
| citizen-inheritance-hand-sim | U09-D12 | U09-D12 | U09-D12 | 38.81 / 33.47 |
| citizen-vehicle-hand-sim | U27-D13 | U27-D13 | U27-D13 | 30.92 / 33.52 |

## Phiên bản và khả năng chạy lại

- `mlx-community/Qwen3-4B-Instruct-2507-4bit@50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b`; thời điểm kết thúc `2026-11-17 15:54:51`.
  Bộ nhớ hệ thống trước/sau: `{"available_gb": 5.51, "swap_used_gb": 11.68, "swap_out_gb_total": 3.71}` → `{"available_gb": 2.48, "swap_used_gb": 10.28, "swap_out_gb_total": 3.8}`.
- `ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct@00161de525486e01ba505e6c24f39472fdfe4a23`; thời điểm kết thúc `2026-11-17 16:04:23`.
  Bộ nhớ hệ thống trước/sau: `{"available_gb": 5.35, "swap_used_gb": 10.28, "swap_out_gb_total": 3.8}` → `{"available_gb": 2.78, "swap_used_gb": 11.16, "swap_out_gb_total": 3.86}`.
- Thư viện: `{"mlx": "0.32.4", "mlx-lm": "0.32.2", "transformers": "5.22.2"}`.
- SHA-256 dữ liệu: `db2df10c268694426da8a7d68e32be2cb7a12caf5232e27e6605b8144dc8f836`.
- SHA-256 danh mục: `1a15d5e47919b88c10ca182cb09779fd1aba6aa4af1bd4e8f9f53480780ad764`.

## Lỗi cải thiện và lỗi còn lại

- IFStruct sửa đúng 7 giá trị Qwen gốc sai/bỏ sót: ngày lập ở bốn mẫu (`filled-h01-d01`, `filled-h05-d04`, `filled-u01-d04`, `filled-u09-d02`), ngày/giờ lập ở `filled-u25-d02`, số giấy chứng nhận ở mẫu đất điền mô phỏng và biển số ở mẫu xe điền mô phỏng.
- IFStruct làm sai 1 giá trị mà Qwen gốc đúng: bỏ đơn vị “đồng” khỏi `850.000.000 đồng` trong giá chuyển nhượng. Vì vậy mức cải thiện ròng là 6 giá trị.
- Có một đáp án trống đã loại khỏi mẫu số 79: “Vợ hoặc chồng người để lại di sản”. Qwen production để trống đúng; IFStruct điền “Trần Thị Lan” ở sai vai trò. Đây là một lỗi điền nhầm ngoài bảng giá trị có sẵn, dù tên có trong OCR. Không đủ nhãn trống để tính tỷ lệ điền nhầm trên toàn bộ form.
- Qwen gốc lỗi JSON ở một nhóm trường của `citizen-inheritance-request`; IFStruct xử lý được. Model card nói về tuân thủ cấu trúc, nhưng JSON hợp lệ vẫn không bảo đảm đúng người, vai trò hoặc đơn vị.
- Tổng 82 nhãn đáp án: một nhãn trống và hai nhãn không có trong schema bị loại, còn 79. Chỉ 69/79 giá trị xuất hiện nguyên văn trong OCR. Trong nhóm đọc được này, IFStruct đạt 68/69 (98,6%), Qwen đạt 62/69 (89,9%). Bộ thử chủ yếu giả lập/công khai, chưa phải bằng chứng cho hồ sơ thật.

## Cách đọc số đo tốc độ

Cả hai chạy lần lượt sau khi dừng worker rảnh và tiến trình OCR con. Qwen chạy 15:44:48–15:54:51, IFStruct chạy 15:54:51–16:04:24 ngày 17/11/2026. Chạy một lượt mỗi model, không tối ưu prompt theo kết quả.

Bộ giám sát ban đầu xét mọi đối số dòng lệnh và ghi PID 35659 mang đối số `bench_pipeline.py` lúc 16:03:55, trong tài liệu cuối của IFStruct. Cùng thời điểm, lệnh kiểm tra `python -m py_compile ... bench_pipeline.py ...` của lượt triển khai đang chạy. Đây là tình huống detector có thể báo nhầm kiểm tra cú pháp thành inference. Đã sửa detector để xét entrypoint và thêm test cho py_compile, status và report; giữ nguyên cảnh báo trong artifact gốc.

Để thận trọng, hai dòng thời gian trong bảng chỉ lấy **19 cặp hoàn thành trước cảnh báo** (tài liệu thứ 19 của IFStruct xong lúc 16:03:49,739). Toàn bộ 20 tài liệu vẫn được chấm chất lượng. Thời gian quan sát toàn 20: trung vị 24,2 giây với Qwen, 26,4 giây với IFStruct; tổng lần lượt 597,13 và 566,65 giây. IFStruct chậm hơn trên các mẫu ngắn nhưng tránh được một số trường hợp kéo dài; không kết luận nó luôn nhanh hơn. Artifact có mốc bắt đầu/kết thúc từng tài liệu để đối chiếu.

## Checkpoint đã cài

Nguồn là `ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct@00161de525486e01ba505e6c24f39472fdfe4a23`, trọng số BF16 đã gộp LoRA, 8.044.982.080 byte. Đã kiểm kích thước, SHA-256 trọng số và git blob của các tệp cấu hình trước khi chuyển.

IFStruct được tinh chỉnh bằng GRPO để tuân thủ JSON/YAML và ràng buộc cấu trúc. Tác giả công bố pass@1 95,75% trên IFStruct, nhưng nói rõ benchmark đã được dùng khi thiết kế dữ liệu/chọn checkpoint; bản gốc trong bảng công bố còn dùng giới hạn token khác. Không coi con số đó là độ đúng trích trường tiếng Việt. [Model card của tác giả](https://huggingface.co/ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct).

- Bản chạy: `/Volumes/quocDisk/AI/paddleocr/models/Qwen3-4B-Instruct-2507-ifstruct-4bit`.
- Nguồn giữ tại thư mục cùng tên đuôi `-bf16`.
- Chuyển bằng MLX-LM 0.32.2, affine 4-bit/group 64; chuẩn lượng tử giống Qwen tham chiếu. Đây là kết quả của bản **4-bit local**, chưa đo BF16 gốc.
- Trọng số hai bản cùng 2.263.022.417 byte (~2,26 GB thập phân). Tokenizer JSON có cùng SHA-256 `aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4`; template chat và token IDs của prompt kiểm tra khớp nhau.
- Biên nhận: `AI_HOME/download-receipt.json` mục `ifstruct_source` lúc đo (cài mới từ 17/11/2026 tối ghi ở mục `classifier`); `models/Qwen3-4B-Instruct-2507-ifstruct-4bit/conversion-receipt.json` ghi hash nguồn, hash bản chuyển, cấu hình và phiên bản thư viện. Không chạy mã từ xa.

## Kiểm tra qua API và worker thật

`scripts/smoke-ai-flow.py --pdf filled-u02-d01 --expect-model Qwen3-4B-Instruct-2507-ifstruct-4bit` hoàn tất trong **49 giây, 0 kiểm tra hỏng**. Đúng loại U02-D01, 6/6 trường có giá trị và dẫn chứng khớp OCR. Đây là kiểm tra tích hợp; không diễn giải thành 6/6 giá trị đúng đáp án.

CSDL ghi `ocr=PaddleOCR-VL-1.6@132c45f classifier=Qwen3-4B-Instruct-2507-ifstruct-4bit@00161de/production`. Giấy tờ thử đã được bỏ khỏi hộp tiếp nhận. Dùng `data/dev-run/ifstruct-trial.env` riêng; sau thử đã dừng worker trial và tiến trình con, khởi động lại worker bằng `ai-worker/.env` ban đầu. SHA-256 tệp môi trường gốc không đổi, health trả `ok`; model mặc định vẫn Qwen3-1.7B như trước lượt thử.

Nhật ký: `AI_HOME/training/ifstruct-trial-sequence.log`, `ifstruct-worker-smoke.log`; `data/dev-run/ifstruct-trial-worker.log`, `ifstruct-trial-state.json`. Mã đã kiểm bằng unit test, kiểm tra cú pháp Python/bash và `git diff --check` trong phạm vi AI; kết quả test được ghi bên dưới.

Kết quả cuối: **101 passed, 22 skipped**. Các test bỏ qua là nhóm hợp đồng PostgreSQL cần CSDL test riêng; smoke API/worker phía trên chạy với CSDL dev thật.

## Chạy lại và sử dụng

Chạy từ gốc repo. Model đã có trên máy này; hai bước download/convert dành cho cài mới. Trước benchmark, dừng worker và model server khác; hai lệnh đo chạy lần lượt.

```sh
AI_PYTHON=/Volumes/quocDisk/AI/paddleocr/venv/bin/python
BENCH_DIR=/Volumes/quocDisk/AI/paddleocr/training/bench

HF_HUB_DISABLE_XET=1 scripts/document-ai.sh download --model classifier
scripts/document-ai.sh convert

"$AI_PYTHON" ai-worker/training/bench_pipeline.py llm --model qwen3-4b \
  --input "$BENCH_DIR/qwen4b-paired-input.jsonl" --catalog "$BENCH_DIR/qwen4b-catalog.json" \
  --shortlist --prompt production --exclusive --tag=-ifstruct-repeat
"$AI_PYTHON" ai-worker/training/bench_pipeline.py llm --model qwen3-4b-ifstruct \
  --input "$BENCH_DIR/qwen4b-paired-input.jsonl" --catalog "$BENCH_DIR/qwen4b-catalog.json" \
  --shortlist --prompt production --exclusive --tag=-ifstruct-repeat
"$AI_PYTHON" ai-worker/training/compare_models.py \
  --baseline "$BENCH_DIR/llm-qwen3-4b-ifstruct-repeat.json" \
  --candidate "$BENCH_DIR/llm-qwen3-4b-ifstruct-ifstruct-repeat.json" \
  --catalog "$BENCH_DIR/qwen4b-catalog.json" --output /tmp/ifstruct-comparison.md
```

Chọn model cho worker thử bằng `HOSO_AI_CLASSIFIER_MODEL=Qwen3-4B-Instruct-2507-ifstruct-4bit` trong tệp môi trường riêng; nếu muốn lặp đúng phép đo này, đặt cả `HOSO_AI_PROMPT_INTERACTIVE=production` và `HOSO_AI_PROMPT_BACKGROUND=production`. Khởi động qua `HOSO_AI_ENV_FILE=/duong/dan/tep.env ai-worker/deploy/run-worker.sh run`. Ước tính scheduler 3 GB, như Qwen3-4B; không đổi mặc định dịch vụ trong lượt đánh giá này.

Có thể gọi bộ trích trường độc lập qua `scripts/document-ai.sh extract-fields --engine ifstruct --help`; giao diện này dùng prompt short, **chưa phải cấu hình đã chấm trong bảng trên**.

Artifact chính ở `BENCH_DIR`:

- `qwen4b-paired-input.jsonl`, `qwen4b-catalog.json`.
- `llm-qwen3-4b-ifstruct-baseline-prod20.json`.
- `llm-qwen3-4b-ifstruct-ifstruct-candidate-prod20.json`.

Các artifact lưu identity, cấu hình, từng trường, dẫn chứng đã kiểm chứng, lỗi, token, thời gian và log giám sát. Chưa đổi prompt hay hậu xử lý riêng để cải thiện điểm IFStruct.
