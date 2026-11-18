# ai-worker · Dịch vụ AI chạy cục bộ (Python)

Worker lấy việc từ bảng `hoso.ocr_jobs` trong PostgreSQL (`FOR UPDATE SKIP LOCKED`), đọc PDF, OCR, gợi ý loại giấy tờ và trường,
rồi ghi kết quả về CSDL. API .NET không gọi worker trực tiếp; hai bên chỉ gặp nhau qua CSDL (giao kèo: `backend/database/migrations/013_processing.sql`).
Không gửi dữ liệu ra ngoài máy (trừ hồ sơ `ollama`: gửi tới máy AI của mình trong mạng riêng, xem bên dưới). Mô hình: PaddleOCR-VL 1.6 và Qwen3-4B-Instruct-2507 IFStruct (MLX 4-bit, mặc định từ 17/11/2026; đổi bằng `HOSO_AI_CLASSIFIER_MODEL`) trên Mac Apple Silicon, nạp từ `DOCUMENT_AI_HOME`.

```
PDFium (lớp chữ có sẵn?) ─ có ─▶ dùng luôn
        │ không
        ▼
render PNG → kiểm tra ảnh (trống/mờ) → PaddleOCR-VL → lưu ocr_pages → xóa ảnh tạm
        ▼
Qwen3-4B IFStruct: nhóm → loại giấy tờ → trường (mỗi giá trị phải có trích dẫn nằm trong văn bản gốc) → ai_suggestions
```

## Chạy

Cài môi trường và mô hình một lần, từ thư mục gốc repo: `DOCUMENT_AI_HOME=/duong/dan/ai ./scripts/setup-document-ai.sh`
(tạo venv, cài thư viện đã ghim kèm `psycopg`, tải mô hình, chuyển IFStruct sang MLX 4-bit; chạy lại được).

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

## AI giả cho máy không có mô hình (`HOSO_AI_PROFILE=fake`)

Dùng khi mô hình chạy ở máy AI riêng mà vẫn cần làm backend/frontend trên máy dev. Worker đi **đúng đường thật** (lấy việc,
nhịp sống, SSE, nhường chỗ, thu hồi, đọc lại trang, gợi ý lại, hủy), chỉ thay hai mô hình bằng quy tắc ở `src/hoso_ai/engines/fake.py`:

- **OCR giả** không đọc ảnh: trang quét nhận một văn bản hành chính mẫu (số, ngày, tiêu đề là tên một loại trong danh mục,
  trích yếu, địa điểm, thành phần, người ký) kèm khối bố cục có toạ độ. Trang có lớp chữ PDF sạch vẫn dùng chữ thật.
  PDF vừa có trang chữ thật vừa có trang ảnh thì phân loại chỉ dùng chữ thật.
- **Phân loại giả:** tên loại in ở tiêu đề (bộ chấm từ khóa `document_ai/shortlist.py`), rồi từ khóa gần nhất, rồi mã băm nội dung.
- **Trích trường giả:** chỉ lấy giá trị có **nguyên văn** trong chữ của trang (ngày, `Số:`, `Về việc`/`V/v`, người ký dưới chức danh,
  dòng `Nhãn: giá trị`); không tìm được thì để trống. Mỗi giá trị kèm trang, `source_region` và `confidence` (xem `contracts.py`).
- **Gói nhiều giấy tờ:** các trang ghi tên loại khác nhau ở tiêu đề thì `mixed_documents=true` (cùng quy tắc với bản thật).
- Cùng nội dung luôn ra cùng kết quả. Kết quả ghi `model_key='fake'` (`ai_models.active=false`), tiêu đề gợi ý có tiền tố `[GIẢ LẬP]`.
  Worker từ chối chạy profile này khi `HOSO_ENV=production`.

Máy dev: `scripts/dev-up.sh ai fake` (đổi `.env` và chỉ chạy lại worker), quay lại mô hình thật: `scripts/dev-up.sh ai real`.
Không có venv mô hình thì AI giả chạy được với venv nhẹ: `python3 -m venv ai-worker/.venv && ai-worker/.venv/bin/pip install -e ai-worker`.

| Biến (chỉ khi `fake`) | Mặc định | Dùng để thử |
|---|---|---|
| `HOSO_AI_FAKE_PAGE_SECONDS` | 0 | Chờ mỗi trang OCR giả: thấy tiến độ, hàng đợi, nâng mức qua SSE (`dev-up.sh ai fake` đặt 1) |
| `HOSO_AI_FAKE_CLASSIFY_SECONDS` | 0 | Chờ ở bước phân loại (`dev-up.sh` đặt 2) |
| `HOSO_AI_FAKE_FAIL_RATE` | 0 | Tỉ lệ 0..1 trang OCR lỗi ngẫu nhiên: cảnh báo trang lỗi, "đọc lại trang" (lần đọc lại có thể thành công) |
| `HOSO_AI_FAKE_MIXED_FROM_PAGES` | 0 | >0: PDF từ chừng này trang luôn báo gói nhiều giấy tờ, để thử tách văn bản với bản quét (OCR giả không biết trang nào là giấy tờ mới) |

Giới hạn: không nói được gì về chất lượng AI; loại chọn cho bản quét là ngẫu nhiên theo mẫu chữ, có thể thuộc nhóm ngoài phạm vi
của người đang thử (khi đó chọn tay loại khác trên màn đối chiếu). Kịch bản `scripts/smoke-ai-flow.py` tự nhận ra worker giả qua `/health`.

## Mô hình ở máy AI khác qua Ollama (`HOSO_AI_PROFILE=ollama`)

Worker vẫn chạy cạnh API (đọc CSDL và kho tệp như mọi khi, không phải mở PostgreSQL hay chia sẻ thư mục kho ra mạng). Chỉ phần sinh chữ
chạy ở máy AI có GPU, ví dụ máy Windows nối bằng Tailscale. Mã: `src/hoso_ai/engines/ollama.py`.

- **OCR:** pipeline PaddleOCR-VL vẫn chạy ở máy worker (dò bố cục PP-DocLayoutV3, xoay trang; CPU, khoảng 1 GB), nên vẫn có khối bố cục
  và toạ độ như bản MLX. Từng vùng cắt gửi sang mô hình PaddleOCR-VL trên Ollama. Máy worker vẫn cần `DOCUMENT_AI_HOME` có venv
  và hai mô hình `PP-DocLayoutV3`, `PP-LCNet_x1_0_doc_ori`.
- **Phân loại, trích trường:** đúng mã `document_ai.classify` như bản MLX (cùng lời nhắc, shortlist, kiểm trích dẫn); chỉ khác chỗ sinh chữ.
- Mô hình trên Ollama tạo với `TEMPLATE {{ .Prompt }}`, nên worker tự dựng lời nhắc theo mẫu chat của từng mô hình (ChatML của Qwen,
  mẫu `User:/Assistant:` của PaddleOCR-VL) rồi gửi `/api/generate` với `raw=true`. **Đừng đổi sang `/v1/chat/completions`:** đường đó
  không bọc đúng mẫu và PaddleOCR-VL sinh thêm chữ rác. Vì vậy, pipeline Paddle gọi một bộ chuyển nhỏ trong worker (chỉ nghe 127.0.0.1)
  thay vì gọi thẳng Ollama.
- **Máy AI tắt hoặc mất mạng:** worker trả job về hàng đợi (không tính vào số lần thử, không ghi trang lỗi, không mất gợi ý), rồi
  ngừng lấy việc khoảng 30 giây. `/metrics` đếm ở `hoso_ai_jobs_total{result="engine_unavailable"}`.
- **Dữ liệu đi qua mạng:** ảnh vùng cắt và chữ của giấy tờ được gửi tới máy AI. Ollama không có xác thực và nói HTTP thường, nên chỉ
  dùng trong mạng riêng mã hóa (Tailscale/WireGuard), và chặn cổng 11434 với mọi mạng khác trên máy AI (tường lửa Windows).
- `ocr_jobs.model_version` ghi tên mô hình trên Ollama kèm digest, ví dụ
  `ocr=hoso-paddleocr-vl:1.6-q8_0@ecc8315 classifier=hoso-ifstruct:q8_0@a6ac33e/short`. Trang vận hành của API sẽ cảnh báo lệch với
  `ai_models` (bảng đó ghi IFStruct theo repo HF), vì tên Ollama không cho biết commit nguồn.

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `HOSO_AI_OLLAMA_URL` | (bắt buộc) | Ví dụ `http://100.78.102.53:11434`. Trên máy AI, Ollama phải nghe ngoài localhost (`OLLAMA_HOST=0.0.0.0`) |
| `HOSO_AI_OLLAMA_OCR_MODEL` | `hoso-paddleocr-vl:1.6-q8_0` | Tên đã tạo bằng `ollama create` trên máy AI |
| `HOSO_AI_OLLAMA_CLASSIFIER_MODEL` | `hoso-ifstruct:q8_0` | |
| `HOSO_AI_OLLAMA_OCR_CONCURRENCY` | 1 | Số vùng cắt gửi cùng lúc; tăng khi máy AI đặt `OLLAMA_NUM_PARALLEL` > 1 |
| `HOSO_AI_OLLAMA_CLASSIFIER_SOURCE` | (trống) | `repo@commit` mà mô hình trên Ollama được chuyển từ đó, ví dụ `ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct@00161de…`. Người vận hành tự khai (worker không kiểm được); khai thì `model_version` ghi `Qwen3-4B-Instruct-2507-ifstruct-q8_0@00161de` và trang vận hành hết báo lệch với `ai_models`, digest thật ghi ở `classifier-via=` |

Máy dev: `scripts/dev-up.sh ai ollama http://<IP Tailscale>:11434` (kiểm Ollama trả lời, ghi `.env`, chạy lại worker); lần sau chỉ cần
`scripts/dev-up.sh ai ollama`. `python -m hoso_ai status` cho biết Ollama có trả lời và có đủ hai mô hình chưa.
Giới hạn ngữ cảnh do `num_ctx` trong Modelfile trên máy AI quyết định (IFStruct 16384 token). `classification_context` cắt văn bản ở
24.000 ký tự, đo bằng tokenizer IFStruct trên chữ OCR tiếng Việt là khoảng 8.900 token. Cộng cả danh mục (khoảng 1.200 token) và phần
trả lời (tối đa 2.600 token) vẫn dưới 16384, nhưng văn bản nhiều số hoặc bảng thì sát hơn: đừng hạ `num_ctx`. Mỗi lần hỏi IFStruct ghi
`ollama_generate` (giây, số token) vào nhật ký worker.

## Vùng nguồn của trường (AI-21)

Sau khi engine gợi ý xong, `src/hoso_ai/regions.py` điền `ai_field_suggestions.source_region` cho trường chưa có vùng (mọi engine dùng chung, kể cả MLX và Ollama): khối bố cục OCR (đã kèm `region` theo tỉ lệ trang khi đọc),
ô của khối bảng, hoặc khung chữ PDFium với trang có lớp chữ. Chỉ khung trích dẫn trọn một khối hoặc khung PDFium là chính xác; còn lại `approximate` (giao diện vẽ nét đứt). Trang bị xoay khi nhận dạng hướng thì không có vùng.
`confidence` để trống với AI thật. Lỗi tìm vùng chỉ ghi `regions_failed` vào nhật ký, không làm mất gợi ý.

## Chuẩn hóa giá trị theo kiểu trường (AI-23)

`src/hoso_ai/field_values.py` (gọi trong `engines/llm_suggest.py`, nên mọi engine thật dùng chung) đưa giá trị AI trích ra về đúng kiểu của trường: trường ngày về `dd/mm/yyyy`
(giao diện đối chiếu chỉ nhận dạng này; giờ bị bỏ khỏi giá trị nhưng còn trong trích dẫn), cắt câu hướng dẫn in sẵn và nhãn dòng kế bên ở trường ngắn,
và bỏ hẳn giá trị không phải dữ liệu (kèm cảnh báo `“Nhãn”: giá trị AI đọc … nên để trống`). Không chắc thì giữ nguyên (nhiều ngày, ngày sai lịch). Trích dẫn luôn nguyên văn.

## Máy dev: worker tự chạy lại

`scripts/dev-up.sh` chạy worker qua `deploy/supervise.sh`: worker thoát ngoài ý muốn (kẹt mã 75, bị giết) thì chạy lại sau 5 giây (giãn dần tới 60 giây nếu thoát liên tục); thoát êm (mã 0), cấu hình sai (78) hoặc `dev-up.sh stop` thì dừng hẳn. Bản dịch vụ (launchd, systemd) đã có cơ chế riêng.

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

- **Chọn mô hình bằng cấu hình:** `HOSO_AI_CLASSIFIER_MODEL` (tên thư mục trong `models/`). Mô hình được nạp **một lần** và giữ giữa các job; bỏ mô hình thì trả bộ nhớ GPU (`mx.clear_cache`). Thiếu thư mục thì worker dừng ngay lúc khởi động, kèm danh sách mô hình đang có. Mỗi job ghi `ocr_jobs.model_version`, ví dụ `ocr=PaddleOCR-VL-1.6@132c45f classifier=Qwen3-4B-Instruct-2507-ifstruct-4bit@00161de/short` (không ghi OCR nếu mọi trang lấy từ lớp chữ PDF).
- **Thứ tự lấy việc:** `priority` (số nhỏ trước), rồi lúc người dùng nâng mức (`prioritized_at`) hoặc lúc tạo. Mức: 1 làm ngay, 3 có người chờ, 7 khay nền (PDF mới tải lên).
- **Khay nền:** chỉ chạy khi không còn việc mức thấp hơn; ngoài khung giờ `HOSO_AI_BACKGROUND_WINDOWS` chỉ lấy việc có người chờ. Việc nền đang chạy kiểm tra sau **mỗi trang** (và trước bước phân loại) xem có việc có người chờ không; có thì trả về hàng đợi, giữ các trang đã đọc. Việc đã được nâng mức thì không còn bị nhường. Nhường chỗ KHÔNG tính là một lần thử: `attempt` vẫn tăng đều (là mã chống nhầm chủ sở hữu), giới hạn thử lại tính `attempt - preempted_count`.
- **Thu hẹp ứng viên bằng từ khóa (`HOSO_AI_SHORTLIST`, mặc định bật):** mô hình nhỏ như Qwen3-1.7B tự chọn nhóm và loại rất kém trên danh mục 38 nhóm; số đo chọn IFStruct (đúng 20/20 nhóm và loại) cũng chạy với chế độ này. `document_ai/shortlist.py` chấm điểm tên loại với phần đầu tài liệu (ưu tiên dòng tiêu đề in hoa), chỉ đưa cho mô hình 8 nhóm và 10 loại khớp nhất; tài liệu tự in tên loại và không loại nào khác sát bằng thì dùng loại đó, nhiều trang tự ghi tên loại khác nhau thì báo gói nhiều giấy tờ cần tách. Không khớp gì thì giữ nguyên như cũ. **Mới đo trên tài liệu giả lập (in sẵn tên loại làm tiêu đề), chưa đo trên giấy tờ thật.**
- **Chẩn đoán:** `kill -USR1 <pid worker>` ghi ngăn xếp mọi luồng vào nhật ký. Watchdog cấp vòng lặp thoát mã 75 khi vòng lặp rảnh không quay quá 120 giây hoặc tắt máy quá 180 giây.
- **Lời nhắc:** `HOSO_AI_PROMPT_INTERACTIVE` (mặc định `short`) cho việc có người chờ, `HOSO_AI_PROMPT_BACKGROUND` (mặc định `production`) cho khay nền. Lời nhắc ngắn chỉ đổi bước trích trường; nhanh khoảng 3 lần nhưng sai nhiều hơn một chút (4,3% so với 3,0% trên dữ liệu giả); giá trị vẫn phải có nguyên văn trong văn bản.

## Kiểm thử

Vì sao chọn IFStruct: [so sánh với Qwen3-4B gốc](training/SO-SANH-IFSTRUCT-QWEN4B.md) trên 20 tài liệu, 79 giá trị có nhãn
(trích trường đúng 86,1% so với 78,5%, bỏ sót 3 so với 8; bộ nhớ và tốc độ tương đương). Dữ liệu giả lập, chưa đo trên giấy tờ thật.
Khi đo `bench_pipeline.py llm`, thêm `--exclusive` để từ chối nếu có worker/model khác lúc bắt đầu và ghi nhận tiến trình xuất hiện giữa lượt đo.

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

## Bảo mật

- Role `hoso_ai_worker` chỉ đọc `files`, `documents`, danh mục và ghi các bảng nhóm F; **không** đọc người dùng, phân quyền, hồ sơ, nhật ký (có test).
- Tệp được kiểm SHA-256 trước khi xử lý; khóa tệp phải đúng dạng `blobs/ab/cd/<sha256>`.
- Nội dung tài liệu coi là dữ liệu, không phải chỉ dẫn cho mô hình; nhật ký không ghi nội dung (`logging.py` che các khóa nhạy cảm).
- Việc còn lại (AI-08): chạy PDFium trong tiến trình con có giới hạn thời gian và bộ nhớ.
