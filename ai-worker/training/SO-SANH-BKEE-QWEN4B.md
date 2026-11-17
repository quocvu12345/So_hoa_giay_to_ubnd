# So sánh BKEE entity-extraction với Qwen3-4B

Ngày đo: 2026-11-17. Mac M4 16 GB, MLX 4-bit, chỉ xử lý văn bản OCR; không đưa ảnh vào Qwen.

**Kết quả:** BKEE MLX 4-bit trích đúng **67/79 giá trị (84,8%)**, hơn Qwen3-4B gốc **5 giá trị** (62/79; 78,5%). Bỏ sót giảm từ 8 xuống 3; số giá trị sai vẫn là 9. Cả hai phân loại đúng 20/20 trong pipeline có shortlist. BKEE không có lỗi JSON trong lượt này, nhưng vẫn sai phạm vi giá trị và dẫn chứng.

**79 là số giá trị trường được chấm, không phải 79 tài liệu.** Bộ thử có 20 tài liệu; 12 tài liệu có nhãn trường. Tổng 82 nhãn gồm một nhãn trống và hai nhãn không có trong schema; loại ba nhãn đó, còn 79. Có 69/79 giá trị xuất hiện nguyên văn trong OCR.

Đã tải nguồn, xác minh trọng số, chuyển MLX 4-bit và chạy thực tế toàn bộ `document_ai.classify.classify` trên cùng OCR/danh mục/prompt production. Qwen tham chiếu được **tái sử dụng từ lượt IFStruct trước cùng ngày**, không chạy lại ở lượt BKEE. Bộ kiểm tra ghép cặp xác nhận hash đầu vào, thứ tự tài liệu, đáp án, danh mục, cấu hình và phiên bản thư viện khớp nhau. Thời gian là quan sát ở hai thời điểm khác nhau, không phải phép đo lặp kiểm soát nhiệt độ/tải nền.

**Đánh giá cho dự án:** BKEE có thể chạy với giao diện hiện tại và cải thiện so với Qwen gốc trên bộ thử này, nhưng không nhẹ hơn. IFStruct trước đó đạt **68/79 (86,1%)**, nhỉnh hơn BKEE một giá trị. Chưa có lý do rõ để ưu tiên BKEE hơn IFStruct cho toàn pipeline; chênh lệch một giá trị trên bộ nhỏ chưa chứng minh ưu thế tổng quát. Xem các lỗi đối chiếu bên dưới trước khi chọn.

## Kết quả ghép cặp

| Chỉ số | Qwen3-4B-Instruct-2507-4bit | Qwen3-4B-BKEE-Entity-Extraction-4bit |
|---|---:|---:|
| Đúng nhóm | 20/20 (100.0%) | 20/20 (100.0%) |
| Đúng loại | 20/20 (100.0%) | 20/20 (100.0%) |
| Loại được shortlist quyết định theo tiêu đề | 17/20 (85.0%) | 17/20 (85.0%) |
| Đúng loại — filled | 9/9 (100.0%) | 9/9 (100.0%) |
| Đúng loại — citizen | 11/11 (100.0%) | 11/11 (100.0%) |
| Trường đúng (nhãn có trong schema) | 62/79 (78.5%) | 67/79 (84.8%) |
| Trường sai giá trị | 9/79 (11.4%) | 9/79 (11.4%) |
| Trường bỏ sót | 8/79 (10.1%) | 3/79 (3.8%) |
| Trường đúng trong số OCR đọc được | 62/69 (89.9%) | 67/69 (97.1%) |
| Thời gian trung vị quan sát (giây/tài liệu) | 24.2 | 33.3 |
| Thời gian p90 quan sát (giây/tài liệu) | 58.2 | 51.4 |
| Lỗi phân loại/JSON | 0 | 0 |
| Tài liệu có lỗi trích nhóm trường | 1 | 0 |
| Thời gian nạp (giây) | 2.9 | 1.0 |
| Bộ nhớ MLX đỉnh (GiB) | 2.98 | 2.98 |

## Phương pháp và giới hạn

- 20 tài liệu: 9 mẫu điền font và 11 biểu mẫu citizen; 12 tài liệu có đáp án trường, tổng cộng 81 giá trị không trống trước khi loại hai nhãn ngoài schema, còn 79 giá trị được chấm. Đây là dữ liệu giả lập/biểu mẫu công khai, chưa đánh giá trên giấy tờ thật.
- Cùng OCR đã lưu, cùng snapshot PostgreSQL 38 nhóm/427 loại; không cung cấp đáp án cho model. restrict_types_to_group=True, shortlist=True, prompt=production, temperature=0, thinking=False. MLX-LM xử lý văn bản OCR.
- Giám sát mỗi giây không phát hiện worker/model khác trong cả hai lượt đo. Các ứng dụng khác trên máy vẫn chạy; swap có sẵn không có nghĩa là toàn bộ do model.
- Tốc độ chỉ gồm phân loại và trích trường; không gồm OCR, tải model hay thời gian nạp. P90 theo nearest rank. Bộ nhớ MLX đỉnh không phải tổng RAM cả máy.
- Shortlist có thể quyết định loại theo tiêu đề; kết quả là chất lượng toàn pipeline với cấu hình này, không phải năng lực model khi tự chọn trong toàn danh mục.
- Chấm giá trị bằng nhãn và chuỗi chuẩn hóa Unicode/hoa-thường/khoảng trắng, giữ dấu tiếng Việt. Không đủ nhãn để tính tỷ lệ điền nhầm ô trống trên toàn bộ form. Trích dẫn có trong OCR không đảm bảo chọn đúng vai trò/người.
- Loại khỏi mẫu số trường những nhãn đáp án không có trong schema hiện tại: filled-u09-d13: Ngày cấp giấy tờ người lập di chúc; filled-u09-d13: Nơi cấp giấy tờ người lập di chúc.

## Chi tiết từng tài liệu

| Tài liệu | Loại đáp án | Qwen3-4B-Instruct-2507-4bit | Qwen3-4B-BKEE-Entity-Extraction-4bit | Giây baseline / candidate |
|---|---|---|---|---:|
| filled-h01-d01 | H01-D01 | H01-D01 | H01-D01 | 14.25 / 16.3 |
| filled-h05-d04 | H05-D04 | H05-D04 | H05-D04 | 14.61 / 17.14 |
| filled-u01-d04 | U01-D04 | U01-D04 | U01-D04 | 14.75 / 17.53 |
| filled-u04-d13 | U04-D13 | U04-D13 | U04-D13 | 14.67 / 17.28 |
| filled-u09-d02 | U09-D02 | U09-D02 | U09-D02 | 13.5 / 15.95 |
| filled-u09-d13 | U09-D13 | U09-D13 | U09-D13 | 19.35 / 23.87 |
| filled-u15-d01 | U15-D01 | U15-D01 | U15-D01 | 13.12 / 16.27 |
| filled-u18-d09 | U18-D09 | U18-D09 | U18-D09 | 15.44 / 18.24 |
| filled-u25-d02 | U25-D02 | U25-D02 | U25-D02 | 17.3 / 19.26 |
| citizen-land-contract | U15-D14 | U15-D14 | U15-D14 | 38.7 / 44.68 |
| citizen-inheritance-request | U09-D11 | U09-D11 | U09-D11 | 74.91 / 64.8 |
| citizen-inheritance-kinship | U09-D12 | U09-D12 | U09-D12 | 23.11 / 40.98 |
| citizen-inheritance-will | U09-D13 | U09-D13 | U09-D13 | 34.57 / 42.2 |
| citizen-vehicle-registration | U27-D12 | U27-D12 | U27-D12 | 58.25 / 63.94 |
| citizen-vehicle-recall | U27-D13 | U27-D13 | U27-D13 | 25.34 / 31.23 |
| citizen-vehicle-contract | U27-D14 | U27-D14 | U27-D14 | 35.04 / 43.83 |
| citizen-land-filled-public | U15-D02 | U15-D02 | U15-D02 | 61.78 / 42.81 |
| citizen-land-hand-sim | U15-D14 | U15-D14 | U15-D14 | 38.71 / 44.5 |
| citizen-inheritance-hand-sim | U09-D12 | U09-D12 | U09-D12 | 38.81 / 51.42 |
| citizen-vehicle-hand-sim | U27-D13 | U27-D13 | U27-D13 | 30.92 / 35.29 |

## Phiên bản và khả năng chạy lại

- `mlx-community/Qwen3-4B-Instruct-2507-4bit@50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b`; thời điểm kết thúc `2026-11-17 15:54:51`.
  Bộ nhớ hệ thống trước/sau: `{"available_gb": 5.51, "swap_used_gb": 11.68, "swap_out_gb_total": 3.71}` → `{"available_gb": 2.48, "swap_used_gb": 10.28, "swap_out_gb_total": 3.8}`.
- `hadeseus/qwen3-4b-bkee-entity-extraction@a531480d0f4ee265dfebc86d37dde309662f36e4`; thời điểm kết thúc `2026-11-17 16:47:08`.
  Bộ nhớ hệ thống trước/sau: `{"available_gb": 6.83, "swap_used_gb": 13.51, "swap_out_gb_total": 4.02}` → `{"available_gb": 2.93, "swap_used_gb": 12.87, "swap_out_gb_total": 4.08}`.
- Thư viện: `{"mlx": "0.32.4", "mlx-lm": "0.32.2", "transformers": "5.22.2"}`.
- SHA-256 dữ liệu: `db2df10c268694426da8a7d68e32be2cb7a12caf5232e27e6605b8144dc8f836`.
- SHA-256 danh mục: `1a15d5e47919b88c10ca182cb09779fd1aba6aa4af1bd4e8f9f53480780ad764`.

## Đối chiếu từng lỗi đáng chú ý

So với Qwen gốc, BKEE sửa đúng 6 giá trị và làm mất 1 giá trị vốn đúng, cải thiện ròng 5:

- Sửa ngày lập ở `filled-h01-d01`, `filled-h05-d04`, `filled-u01-d04`, `filled-u09-d02`; sửa ngày/giờ ở `filled-u25-d02`.
- Lấy được số giấy chứng nhận `TEST-GCN-001` trong `citizen-land-hand-sim`.
- Ở `filled-u15-d01`, model sinh đúng giá trị “Nội dung đề nghị” nhưng đoạn dẫn chứng bị ghép sai (`Nội dung đề nghịĐề nghị…`). Bộ kiểm chứng nguyên văn loại bỏ cả trường. Không sửa hậu xử lý riêng để nâng điểm BKEE.

So với IFStruct trên đúng 79 giá trị:

| Trường | IFStruct | BKEE |
|---|---|---|
| Nội dung đề nghị, `filled-u15-d01` | Đúng | Bị loại vì dẫn chứng sai |
| Giá chuyển nhượng, `citizen-land-hand-sim` | Thiếu đơn vị: `850.000.000` | Đúng: `850.000.000 đồng` |
| Biển số, `citizen-vehicle-hand-sim` | Đúng: `TEST-001` | Lấy dư: `TEST-001 - Màu biển: Trắng` |

Một nhãn trống nằm **ngoài mẫu số 79**: “Vợ hoặc chồng người để lại di sản”. BKEE và Qwen gốc để trống đúng; IFStruct điền nhầm `Trần Thị Lan`. Đây là điểm tốt của BKEE ở một trường hợp cụ thể, chưa đủ nhãn âm để tính tỷ lệ điền nhầm trên toàn bộ form.

## Mục đích checkpoint và phép thử prompt gốc

Tác giả mô tả BKEE entity-extraction là bản tinh chỉnh từ `unsloth/Qwen3-4B-Instruct-2507`, nhận câu tiếng Việt rồi trả danh sách thực thể như Person/Organization/Job kèm giải thích. Dữ liệu tinh chỉnh gồm các giải thích do máy tạo, căn theo nhãn BKEE. Đây không phải checkpoint được công bố chuyên gán trường biểu mẫu hành chính. Không có số đo trên bộ tài liệu của dự án trong [model card của tác giả](https://huggingface.co/hadeseus/qwen3-4b-bkee-entity-extraction).

Phép đo chính dùng prompt production của dự án để kiểm tra khả năng thay thế trực tiếp. BKEE vẫn tuân thủ JSON/schema của pipeline: không lỗi phân loại, không cảnh báo JSON nhóm trường và không lời gọi nào chạm giới hạn token. Chế độ `enable_thinking=False` giữ như baseline; không dựa vào tên checkpoint để giả định model chỉ biết NER.

Đã thử thêm **3 dòng OCR nguyên văn** từ chính ba mẫu hand-sim bằng system prompt gốc của tác giả, temperature=0, tối đa 2048 token. Cả ba trả giải thích rồi JSON `entities` hợp lệ; các span đều có trong đầu vào:

| Dòng nguồn | Thực thể model trả về | Loại |
|---|---|---|
| Họ tên ông trong mẫu đất | Nguyễn Văn An | Person |
| Dòng ông/bà trong mẫu thừa kế | Ông (A) Nguyễn Văn An; Bà (B) Trần Thị Lan | Person |
| Tên chủ xe | Trần Văn Hòa | Person |

Phép thử này chỉ xác nhận giao diện NER gốc hoạt động. **Không có nhãn NER để chấm độ đúng**, không gọi đó là độ chính xác 100%, và không cộng vào 79 trường. Trình đọc JSON sau giải thích chỉ nằm trong công cụ chẩn đoán `probe_bkee.py`; parser production giữ nguyên.

## Tốc độ và bộ nhớ

BKEE chạy từ 16:36:00 đến 16:47:08 ngày 17/11/2026; tổng thời gian từng tài liệu **667,52 giây**, so với **597,13 giây** ở lượt Qwen trước (tăng khoảng 11,8%). Trung vị 33,3 so với 24,2 giây; p90 51,4 so với 58,2 giây. BKEE sinh trung bình 812 token/tài liệu, Qwen 687. Không thể quy toàn bộ chênh lệch cho model vì mỗi bản mới đo một lượt và chạy ở thời điểm khác nhau.

Hai lượt Qwen/BKEE đều không ghi nhận tiến trình model khác hoặc lỗi giám sát. Worker rảnh và các tiến trình con đã dừng trước khi chuyển/chạy BKEE. Bộ nhớ MLX đỉnh bằng nhau **2,98 GiB**; đây không phải tổng RAM máy hoặc RAM khi chạy OCR cùng lúc. Trọng số hai bản cùng **2.263.022.417 byte**, khoảng 2,26 GB thập phân. BKEE không giải quyết mục tiêu giảm dung lượng so với Qwen3-4B.

IFStruct dùng ở đây làm mốc chất lượng từ [báo cáo trước](SO-SANH-IFSTRUCT-QWEN4B.md). Báo cáo đó giải thích cảnh báo giám sát ở tài liệu cuối và dùng 19 cặp cho bảng thời gian; không ghép số thời gian IFStruct thành bảng xếp hạng ba model trong phép đo này.

## Cài đặt, xác minh và trạng thái dịch vụ

- Nguồn: `hadeseus/qwen3-4b-bkee-entity-extraction@a531480d0f4ee265dfebc86d37dde309662f36e4`, BF16 gồm hai shard tổng **8.044.982.000 byte**. Trình tải kiểm kích thước và SHA-256 trọng số, xác minh các tệp cấu hình.
- Bản chạy: `/Volumes/quocDisk/AI/paddleocr/models/Qwen3-4B-BKEE-Entity-Extraction-4bit`.
- MLX-LM chuyển affine 4-bit/group 64, giữ tokenizer và chat template nguồn, `trust_remote_code=False`. Đây là số đo bản 4-bit local, chưa đo BF16.
- Hash SHA-256 trọng số đã chuyển: `db8d2a3ffe5e189e622835f033293bdcf16df6a7c64827c28f9309192b53f357`.
- Biên nhận tải: `AI_HOME/download-receipt.json`, mục `bkee_source`. Biên nhận chuyển: `conversion-receipt.json` trong thư mục model, ghi nguồn, revision, hash trước/sau và phiên bản thư viện.
- Tokenizer nguồn được giữ nguyên; JSON tokenizer BKEE khác bản baseline ở một số cờ pre-tokenizer/decoder. Prompt kiểm tra được render và mã hóa thành cùng token IDs; không khẳng định hai tệp tokenizer giống hệt nhau.
- Worker gốc đã khôi phục, health `ok`, PID 45987. Tệp `ai-worker/.env` có SHA-256 không đổi; cấu hình dịch vụ vẫn chọn `Qwen3-1.7B-4bit` như trước thử. Phép thử BKEE chạy hàm classify thật trên OCR lưu sẵn; **không thực hiện thêm smoke upload/API/queue**.
- Kiểm thử mã: **104 passed, 22 skipped**. Nhóm PostgreSQL cần CSDL test riêng được bỏ qua. Kiểm tra cú pháp Python/bash và `git diff --check` trong phạm vi AI đều qua.

## Chạy lại

Từ gốc repo; model đã được cài trên máy này. Converter từ chối ghi đè thư mục model hiện có. Trước khi đo, dừng worker/model server khác và chạy từng lượt nối tiếp.

```sh
AI_PYTHON=/Volumes/quocDisk/AI/paddleocr/venv/bin/python
BENCH_DIR=/Volumes/quocDisk/AI/paddleocr/training/bench

# Cài mới:
HF_HUB_DISABLE_XET=1 scripts/document-ai.sh download --model bkee_source
scripts/document-ai.sh convert-bkee

# Dùng tag mới để giữ nguyên artifact đã đo:
"$AI_PYTHON" ai-worker/training/bench_pipeline.py llm --model qwen3-4b-bkee \
  --input "$BENCH_DIR/qwen4b-paired-input.jsonl" --catalog "$BENCH_DIR/qwen4b-catalog.json" \
  --shortlist --prompt production --exclusive --tag=-bkee-repeat
"$AI_PYTHON" ai-worker/training/compare_models.py \
  --baseline "$BENCH_DIR/llm-qwen3-4b-ifstruct-baseline-prod20.json" \
  --candidate "$BENCH_DIR/llm-qwen3-4b-bkee-bkee-repeat.json" \
  --catalog "$BENCH_DIR/qwen4b-catalog.json" --output /tmp/bkee-comparison.md
"$AI_PYTHON" ai-worker/training/probe_bkee.py --output "$BENCH_DIR/bkee-native-repeat.json"
```

Chọn BKEE cho worker thử bằng `HOSO_AI_CLASSIFIER_MODEL=Qwen3-4B-BKEE-Entity-Extraction-4bit` trong tệp môi trường riêng. Để dùng cấu hình đã đo, đặt cả `HOSO_AI_PROMPT_INTERACTIVE=production` và `HOSO_AI_PROMPT_BACKGROUND=production`; mặc định việc có người chờ dùng prompt short, chưa được đánh giá cho BKEE trong lượt này. Khởi động bằng `HOSO_AI_ENV_FILE=/duong/dan/tep.env ai-worker/deploy/run-worker.sh run`.

Artifact ở `AI_HOME/training/bench`:

- `qwen4b-paired-input.jsonl`, `qwen4b-catalog.json`: OCR, đáp án dùng chấm và danh mục cố định.
- `llm-qwen3-4b-ifstruct-baseline-prod20.json`: baseline đã đo trước.
- `llm-qwen3-4b-bkee-paired20-sl-prod.json`: đủ 20 tài liệu BKEE, từng giá trị/dẫn chứng, câu trả lời thô, token, thời gian, lỗi, giám sát và nguồn model.
- `bkee-native-probe.json`: ba phép thử giao diện NER gốc, tách khỏi chấm trường.

Nhật ký ở `AI_HOME/training`: `download-bkee.log`, `convert-bkee.log`, `bkee-candidate-prod20.log`, `bkee-native-probe.log`. Trạng thái dừng/khôi phục worker: `data/dev-run/bkee-trial-state.json`.
