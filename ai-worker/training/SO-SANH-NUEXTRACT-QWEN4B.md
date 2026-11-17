# NuExtract3-kie-vi so với Qwen3-4B

Ngày thử: 17/11/2026, Mac M4 16 GB. Đã tải checkpoint gốc, xác minh SHA-256, chuyển MLX và chạy thực tế cả OCR → trường lẫn ảnh → trường.

**Kết luận:** NuExtract có triển vọng cho bước trích trường với schema đã biết: hơn Qwen3-4B dùng prompt `short` 4/79 giá trị, ít giá trị sai hơn và không lỗi JSON. Tuy nhiên model dùng nhiều bộ nhớ hơn, tự đổi định dạng ngày và chưa được kiểm tra phân loại danh mục. Giữ dưới dạng bộ trích trường thử nghiệm, chưa thay toàn bộ Qwen trong worker.

## So sánh chính: cùng OCR, cùng schema

Qwen là `Qwen3-4B-Instruct-2507-4bit`, dùng prompt `short` hiện có của luồng tương tác. NuExtract dùng template gốc với `verbatim-string`. Cả hai được cung cấp loại giấy tờ và toàn bộ nhãn của loại đó; không đưa giá trị đáp án vào prompt. Đây là phép đo **trích trường**, không đo phân loại.

| Chỉ số | Qwen3-4B · short | NuExtract · native |
|---|---:|---:|
| Trường đúng sau kiểm chứng OCR | 54/79 (68.4%) | 58/79 (73.4%) |
| Trường sai giá trị | 15/79 (19.0%) | 8/79 (10.1%) |
| Trường bị bỏ sót | 10/79 (12.7%) | 13/79 (16.5%) |
| Đúng trong số 69 giá trị đọc được trong OCR | 54/69 | 58/69 |
| Tài liệu lỗi JSON/schema | 1/20 | 0/20 |
| Lần gọi chạm giới hạn 1.200 token | 1 | 0 |
| Bộ nhớ MLX đỉnh, chế độ text (GiB) | 2.974 | 3.613 |
| Trọng số trên đĩa (GB thập phân) | 2,263 | 3,034 |

20 tài liệu gồm 9 mẫu điền font và 11 biểu mẫu/mẫu điền mô phỏng. Chỉ 12 tài liệu có nhãn trường. Tổng 82 nhãn đáp án: loại một nhãn có đáp án trống khỏi phép chấm giá trị có sẵn và hai nhãn không có trong schema hiện hành, còn 79. Có 69/79 giá trị hiện nguyên văn trong OCR. Chấm theo nhãn và chuỗi chuẩn hóa Unicode, hoa/thường, khoảng trắng, giữ dấu tiếng Việt.

Qwen cho kết quả từng trường giống hệt ở lượt pilot và lượt cuối. Bộ thử nhỏ, chủ yếu giả lập/công khai, chưa đại diện giấy tờ thật hoặc miền kê khai tài sản mà NuExtract được tinh chỉnh.

### Tốc độ và ảnh hưởng của worker chạy đồng thời

Lượt Qwen cuối chạy 15:04:44–15:12:00; worker được một hoạt động khác bật lại và bắt đầu nhận job từ 15:07:54. Vì vậy **không dùng tỷ lệ thời gian toàn bộ 20 tài liệu để kết luận tăng tốc**. NuExtract OCR chạy 15:01:59–15:04:44, trước các job này. Các mốc được đối chiếu với `data/dev-run/worker.log` và `training/nuextract-trial-sequence.log`.

Chỉ lấy 12 cặp đầu đã hoàn thành trước lúc worker nhận job để tham khảo tốc độ; cùng thứ tự và đầu vào, chạy một lượt mỗi model:

| Thời gian trích trường, 12 cặp đầu | Qwen3-4B | NuExtract |
|---|---:|---:|
| Trung vị (giây/tài liệu) | 5.53 | 4.80 |
| P90 nearest rank (giây/tài liệu) | 40.41 | 11.86 |
| Tổng (giây) | 158.13 | 81.75 |

Các thời gian trên không gồm tải/nạp model, OCR hoặc phân loại. Toàn bộ 20 tài liệu có trung vị quan sát 18,39 giây với Qwen và 6,44 giây với NuExtract, nhưng Qwen bị tranh tài nguyên ở phần cuối. Pilot Qwen có trung vị 13,85 giây trong lúc tải/cài đặt đang diễn ra; chỉ giữ làm dấu vết, không coi là benchmark kiểm soát. Bộ nhớ MLX là bộ nhớ của tiến trình inference, không phải tổng RAM/swap của máy.

### Những lỗi đáng chú ý

- NuExtract sửa đúng 13 giá trị mà Qwen short sai/bỏ sót, nhưng làm mất 9 giá trị Qwen đã trích đúng. Ví dụ cải thiện: tách đúng tên bên chuyển nhượng, bên nhận chuyển nhượng, số thửa, số tờ bản đồ, số giấy chứng nhận và biển số thay vì chép cả nhãn hoặc đoạn văn.
- Cả 9 giá trị bị mất so với Qwen là ngày. Tổng cộng NuExtract trả 10 ngày đúng về nội dung nhưng đổi `DD/MM/YYYY` sang `YYYY-MM-DD`; bộ kiểm chứng yêu cầu nguyên văn OCR nên loại. Không tự quy đổi để nâng điểm trong báo cáo này. Cần sửa và đánh giá adapter ngày trên tập riêng trước khi dùng thực tế.
- Một nhãn có đáp án trống được kiểm tra riêng: “Vợ hoặc chồng người để lại di sản”. NuExtract text để trống đúng; Qwen short chép dòng hướng dẫn; NuExtract ảnh lại điền “Trần Thị Lan” ở sai vai trò. Một mẫu không đủ để ước lượng tỷ lệ điền nhầm ô trống.
- Qwen lỗi JSON ở `citizen-vehicle-contract` khi chạm trần token. Tài liệu này không có nhãn trường để chấm độ đúng; vẫn tính lỗi vận hành.
- [Lượt production trước](SO-SANH-QWEN-4B.md) của Qwen3-4B đạt 62/79 với prompt dài và toàn pipeline. NuExtract hiện đạt 58/79; chưa có cơ sở nói nó thắng mọi cấu hình Qwen. Không so trực tiếp thời gian của hai phép thử khác thiết lập.

## Thử đọc ảnh trực tiếp

Ba mẫu `citizen-*-hand-sim`, tổng 7 trang, cạnh dài 1.280 px. NuExtract chỉ nhận ảnh, loại và schema; văn bản OCR chỉ được dùng sau inference để kiểm chứng. Chạy bằng MLX-VLM với vision tower BF16. Đây là thử nghiệm bổ sung trên mẫu mô phỏng, không phải kiểm định chữ viết tay thực tế.

| Cùng 3 mẫu, 21 giá trị có đáp án | Qwen short + OCR | NuExtract + OCR | NuExtract + ảnh |
|---|---:|---:|---:|
| Đúng sau kiểm chứng | 10 | 16 | 15 |
| Sai giá trị | 8 | 1 | 1 |
| Bỏ sót | 3 | 4 | 5 |

NuExtract ảnh: raw exact match 15/21; sau kiểm chứng vẫn 15/21, một giá trị sai còn được giữ và năm giá trị bị loại. Không có lỗi JSON; MLX đỉnh 4,385 GiB. Thời gian quan sát 22,77–34,61 giây/tài liệu có thể chịu ảnh hưởng của worker đồng thời, chưa so tốc độ toàn luồng ảnh với OCR + text. Sai gồm đổi ngày/tiền, bỏ đơn vị diện tích, sai dấu địa chỉ và nhầm vai trò người. Ở cấu hình thử này, ảnh chưa cải thiện độ đúng so với OCR → NuExtract.

## Checkpoint và cài đặt

Checkpoint được tác giả tinh chỉnh cho bản kê khai tài sản, thu nhập tiếng Việt, từ NuExtract3 trên nền Qwen3.5-4B. Model card ghi 151 tài liệu train, 19 validation và **chưa đánh giá chính thức checkpoint này**; con số 93% là mục tiêu, không phải kết quả đã chứng minh. [Model card của tác giả](https://huggingface.co/jester6136/NuExtract3-kie-vi).

Nguồn đầy đủ BF16 9.078.620.536 byte, revision `33083e5c51719a0d659ae11689f1b5fddfa60055`. Bản local lượng tử hóa affine 4-bit/group 64 cho phần ngôn ngữ; 297 tensor vision giữ BF16, trung bình toàn model khoảng 5,347 bit/trọng số. Giữ chat template gốc và không chạy mã từ xa. Giao diện schema theo [NuExtract3](https://huggingface.co/numind/NuExtract3). Không đo BF16 gốc.

- Nguồn: `/Volumes/quocDisk/AI/paddleocr/models/NuExtract3-kie-vi-bf16`.
- Bản chạy: `/Volumes/quocDisk/AI/paddleocr/models/NuExtract3-kie-vi-4bit`.
- Biên nhận nguồn: `AI_HOME/download-receipt.json`, mục `nuextract_source`; biên nhận chuyển đổi và SHA-256 đầu ra: `models/NuExtract3-kie-vi-4bit/conversion-receipt.json`.
- Qwen tham chiếu: `mlx-community/Qwen3-4B-Instruct-2507-4bit@50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b`.
- Thư viện: `{"mlx": "0.32.4", "mlx-lm": "0.32.2", "mlx-vlm": "0.7.12", "transformers": "5.22.2", "torch": "2.10.0", "torchvision": "0.25.0"}`.

Chạy từ gốc repo (các model đã có sẵn trên máy này):

```sh
AI_PYTHON=/Volumes/quocDisk/AI/paddleocr/venv/bin/python
BENCH_DIR=/Volumes/quocDisk/AI/paddleocr/training/bench

# Cài mới trên môi trường AI đã có MLX:
python3 -m pip --python "$AI_PYTHON" install -r document_ai/requirements-nuextract.txt
HF_HUB_DISABLE_XET=1 scripts/document-ai.sh download --model nuextract_source
scripts/document-ai.sh convert-nuextract

# Chạy extractor local bằng mẫu đã chuẩn bị:
scripts/document-ai.sh extract-fields --engine nuextract \
  --pages "$BENCH_DIR/nuextract-cli-sample/pages.json" \
  --labels "$BENCH_DIR/nuextract-cli-sample/labels.json" \
  --type-name "Kế hoạch tổ chức kỳ họp" \
  --output /tmp/nuextract-fields.json

# Đo lại lần lượt khi GPU không xử lý công việc khác:
"$AI_PYTHON" ai-worker/training/bench_fields.py --engine qwen \
  --output "$BENCH_DIR/fields-qwen-repeat.json"
"$AI_PYTHON" ai-worker/training/bench_fields.py --engine nuextract \
  --output "$BENCH_DIR/fields-nuextract-repeat.json"
"$AI_PYTHON" ai-worker/training/bench_fields.py --engine nuextract --vision \
  --output "$BENCH_DIR/fields-nuextract-vision-repeat.json"
```

`pages.json` là danh sách `{ "page": 1, "text": "..." }`; `labels.json` là danh sách chuỗi tên trường, không có đáp án. Thêm `--image trang1.png --image trang2.png` để dùng ảnh. Khi đó `pages` chỉ phục vụ kiểm chứng; kết quả giữ riêng `raw_fields` và `fields` đã kiểm chứng. CLI chạy offline, không ghi vào CSDL.

## Dữ liệu và khả năng kiểm tra lại

- Cùng snapshot danh mục 38 nhóm/427 loại. Lô 10 trường, tối đa 1.200 token/lần gọi, temperature 0, thinking off, không retry; cùng giới hạn trích đoạn OCR 24.000 ký tự và cùng `evidence_fields`.
- Các lỗi JSON vẫn nằm trong kết quả; trường bị loại/bỏ sót tính vào mẫu số, không chỉ chấm trường model đã điền.
- Hai nhãn loại khỏi mẫu số thuộc `filled-u09-d13`: “Ngày cấp giấy tờ người lập di chúc”, “Nơi cấp giấy tờ người lập di chúc”.
- SHA-256 đầu vào: `db2df10c268694426da8a7d68e32be2cb7a12caf5232e27e6605b8144dc8f836`.
- SHA-256 danh mục: `1a15d5e47919b88c10ca182cb09779fd1aba6aa4af1bd4e8f9f53480780ad764`.
- Artifact trong `BENCH_DIR`: `qwen4b-paired-input.jsonl`, `qwen4b-catalog.json`, `fields-qwen3-4b-ocr20-final.json`, `fields-nuextract-ocr20.json`, `fields-nuextract-vision3.json`. Có raw JSON, từng trường, số token, lỗi, thời gian, trạng thái bộ nhớ và identity model.

## Chi tiết độ đúng trên các tài liệu có nhãn

| Tài liệu | Qwen short | NuExtract text |
|---|---:|---:|
| filled-h01-d01 | 4/6 | 4/6 |
| filled-h05-d04 | 4/6 | 4/6 |
| filled-u01-d04 | 4/6 | 4/6 |
| filled-u04-d13 | 6/6 | 5/6 |
| filled-u09-d02 | 5/6 | 5/6 |
| filled-u09-d13 | 9/10 | 7/10 |
| filled-u15-d01 | 5/6 | 5/6 |
| filled-u18-d09 | 3/6 | 3/6 |
| filled-u25-d02 | 4/6 | 5/6 |
| citizen-land-hand-sim | 0/7 | 5/7 |
| citizen-inheritance-hand-sim | 3/5 | 3/5 |
| citizen-vehicle-hand-sim | 7/9 | 8/9 |

## Trạng thái triển khai

Đã triển khai bộ trích trường local qua `document_ai.field_extract` và `scripts/document-ai.sh extract-fields`, có chế độ OCR và ảnh. Chưa gắn NuExtract vào classifier/queue của worker: cần phân loại riêng và sửa/kiểm định xử lý ngày trước khi xem xét thay thế. `ai-worker/.env` vẫn chọn Qwen3-1.7B như cấu hình trước lượt thử; Qwen3-4B là model tham chiếu của benchmark.

Kiểm thử sau cài phụ thuộc: **98 passed, 22 skipped** (nhóm hợp đồng PostgreSQL cần cấu hình test riêng); `pip check` không có xung đột. Worker được hoạt động khác bật lại, health trả `ok` và tiếp tục xử lý công việc; lượt thử không ghi đè cấu hình hay khởi động thêm worker trùng.

CLI thật đã chạy thành công trên mẫu `filled-h01-d01`: trả đủ 6 nhãn, 5 giá trị qua kiểm chứng, không lỗi JSON/schema; đây là smoke test giao diện, không phải 5/6 giá trị đúng đáp án. Kết quả tại `BENCH_DIR/nuextract-cli-sample/result.json`. Script benchmark đã bổ sung mốc bắt đầu/kết thúc mỗi tài liệu cho các lượt sau để dễ đối chiếu hoạt động đồng thời; các artifact của lượt này chưa có mốc đó.
