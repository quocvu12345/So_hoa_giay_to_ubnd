# Task chi tiết · Worker AI (Python)

Đường dẫn tệp tính từ gốc repo. Worker: `ai-worker/src/hoso_ai/`; mã OCR và phân loại dùng chung: `document_ai/`.

**Trạng thái:** ✅ xong · 🟡 đã có khung, cần làm tiếp · ⬜ chưa làm

AI-01…AI-11 nằm ở `docs/04-ke-hoach-task.md` (mục P4). File này chi tiết các task mới từ AI-12 trở đi, cùng hai task vận hành và kiểm thử của luồng AI (OPS-07, QA-07).

---

## Máy AI Windows qua Ollama · 18/11/2026 (tối) · AI-22 ✅

**Bối cảnh:** mô hình thật chạy trên máy Windows của người dùng (GPU), Ollama ở `100.78.102.53:11434` qua Tailscale, với hai mô hình `hoso-paddleocr-vl:1.6-q8_0` và `hoso-ifstruct:q8_0` (IFStruct 4B, GGUF Q8_0). Máy Mac không còn chạy mô hình.

**Cách nối (`HOSO_AI_PROFILE=ollama`, `ai-worker/src/hoso_ai/engines/ollama.py`):** worker vẫn chạy cạnh API (đọc CSDL và kho tệp như cũ, không phải mở PostgreSQL hay chia sẻ kho tệp ra mạng); chỉ phần sinh chữ gọi sang máy Windows.
- **OCR:** pipeline PaddleOCR-VL (dò bố cục, xoay trang) vẫn chạy ở máy worker; từng vùng cắt gửi sang Ollama qua một bộ chuyển OpenAI → `/api/generate raw` trong worker. Mô hình trên Ollama tạo với `TEMPLATE {{ .Prompt }}` nên worker tự dựng mẫu chat (`User:/Assistant:` của PaddleOCR-VL, ChatML của Qwen, đã so trùng tokenizer); đi `/v1/chat/completions` thì PaddleOCR-VL sinh chữ rác.
- **Phân loại, trích trường:** đúng mã `document_ai.classify` như bản MLX (tách `ClassifierModel.complete`, `engines/llm_suggest.py`), chỉ khác chỗ sinh chữ.
- **Máy AI tắt, mất mạng:** `EngineUnavailable` → job trả về hàng đợi (như nhường chỗ, **không tính lần thử**, không ghi trang lỗi, không mất gợi ý), worker ngừng lấy việc ~30 giây; `hoso_ai_jobs_total{result="engine_unavailable"}`. **Đã thử với sự cố thật (18/11/2026 tối, người dùng tắt rồi bật Ollama trên máy Windows khi worker đang chạy):** 3 lần ngắt (2 "Connection reset by peer", 1 hết giờ khi kiểm nhanh); mỗi lần job về hàng đợi, worker chờ 30 giây rồi chạy lại. Việc bị ngắt 2 lần (`attempt=3`, `preempted=2`, tức chỉ tính 1 lần thử thật) vẫn đọc đủ 4/4 trang; việc bị ngắt giữa chừng khác vẫn ra gợi ý đúng loại, 6 trường. Không việc nào bị đánh `failed` oan.
- **Cấu hình, bật, kiểm:** `ai-worker/README.md` mục "Mô hình ở máy AI khác qua Ollama"; `scripts/dev-up.sh ai ollama [URL]`.
- **Model version:** `ocr=hoso-paddleocr-vl:1.6-q8_0@ecc8315 classifier=hoso-ifstruct:q8_0@a6ac33e/short`. Tên thẻ Ollama không cho biết commit nguồn nên trang vận hành báo lệch với `ai_models` cho tới khi người vận hành khai nguồn bằng `HOSO_AI_OLLAMA_CLASSIFIER_SOURCE=repo@commit` (worker không kiểm được lời khai; digest thật vẫn ghi ở `classifier-via=`). **Chưa khai trên máy dev**: chưa ai xác nhận GGUF trên Windows chuyển từ đúng commit `00161de`.
- **Số đo (18/11/2026, máy dev ↔ Windows qua Tailscale):** IFStruct ~12 token/giây; OCR một trang ~28 giây; một giấy tờ đọc và phân loại 36–130 giây. `scripts/smoke-ai-flow.py` 0 hỏng (3 giấy tờ đúng loại, 6/6 trường), `scripts/smoke-ai-edge.py` 0 hỏng cả 8 tình huống (handsim 8/9 trường).
- **Bảo mật:** ảnh vùng cắt và chữ giấy tờ đi qua mạng tới máy AI; Ollama không có xác thực nên chỉ dùng trong mạng riêng mã hóa và chặn cổng 11434 với mạng khác (cổng LAN của máy Windows đã kiểm: đóng).

## Đổi mô hình mặc định sang IFStruct · chốt 17/11/2026 (tối)

**Quyết định:** mô hình chọn nhóm, loại và trích trường là **Qwen3-4B-Instruct-2507 IFStruct** (`ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct`, commit `00161de525486e01ba505e6c24f39472fdfe4a23`). Mô hình này thay Qwen3-1.7B và Qwen3-4B gốc. Worker nạp bản MLX 4-bit tự chuyển (`Qwen3-4B-Instruct-2507-ifstruct-4bit`) bằng `python -m document_ai.convert`.

- **Lý do:** cùng 20 tài liệu, 79 giá trị có nhãn, so với Qwen3-4B gốc: trích trường đúng 86,1% so với 78,5%, bỏ sót 3 so với 8, không lỗi JSON; bộ nhớ MLX như nhau (2,98 GiB). Chi tiết: `ai-worker/training/SO-SANH-IFSTRUCT-QWEN4B.md`. Dữ liệu giả lập, chưa đo trên giấy tờ thật.
- **Đã gỡ:** các phương án thử nghiệm bị loại (NuExtract3-kie-vi, Qwen3-4B BKEE, Qwen3.5-4B, Qwen3-VL-8B) cùng mã chuyển đổi, bộ trích trường riêng và báo cáo của chúng. Xem lại bằng lịch sử git (commit `bba886b`).
- **Đã đổi:** `document_ai/config.py` (mặc định IFStruct, chỉ còn 4 mô hình cần cho luồng PDF), `scripts/setup-document-ai.sh` (chạy được trên Mac khác: tải, chuyển, kiểm tra), migration `036` ghi `ai_models`. Trang vận hành coi thư mục `…-4bit` khớp với repo nguồn cùng commit (`AdminOpsHandler.DetectModelMismatch`).
- **Bộ nhớ:** với ngân sách mặc định 7 GB, OCR (4,5 GB) và IFStruct (3 GB) thay phiên nạp. Máy AI từ 24 GB RAM nên đặt `HOSO_AI_MODEL_BUDGET_GB=8`.

## Thông luồng với Qwen3-1.7B · chốt 17/11/2026

> Mô hình mặc định đã đổi sang IFStruct (mục trên). Phần dưới giữ làm lịch sử của bước thông luồng.

**Quyết định:**
- Dùng **Qwen3-1.7B-4bit gốc** làm mô hình mặc định ngay, vì máy hiện tại (Mac M4 16 GB) chưa đáp ứng mô hình lớn hơn.
- Khi có phần cứng tốt hơn thì đổi sang mô hình lớn hơn **bằng cấu hình** (`HOSO_AI_CLASSIFIER_MODEL`), không sửa mã (AI-17).
- AI-12 không còn là cổng chặn. Số đo dùng để theo dõi tốc độ và chất lượng.

**"Thông luồng" nghĩa là:** một giấy tờ đi trọn từ tải lên, vào khay, worker đọc bằng OCR và Qwen3-1.7B, ra gợi ý, cán bộ đối chiếu, rồi xếp vào hồ sơ. Luồng chạy trên CSDL `hoso_dev` với API, worker và giao diện thật; bấm được "Trích xuất ngay" và thấy tiến độ cập nhật trực tiếp.

### Bản đồ luồng và chỗ còn đứt

| # | Bước | Thành phần | Hiện trạng | Task |
|---|---|---|---|---|
| 1 | Đăng nhập | API BE-12 (dev: chọn tài khoản giả lập; thật: Keycloak); web FE-05 | API ✅. Web ✅ với đăng nhập dev (E2E `signIn`, đọc phiên qua `/api/v1/me`, đổi phân công); chưa thử Keycloak thật | FE-05 |
| 2 | Tải PDF lên | API BE-41 ✅; web FE-21 | ✅ Web gửi tệp thật (XHR, 3 tệp song song, báo trùng, thử lại); 17/11/2026 | FE-06, FE-21 |
| 3 | Lưu tệp, worker đọc tệp | API ghi kho tệp; worker đọc `HOSO_AI_STORAGE_ROOT` | Cùng một máy: đọc được (hai đường dẫn trùng nhau). Máy AI tách riêng **và chạy worker ở đó**: worker chỉ đọc ổ đĩa local, chưa đọc được S3/MinIO (AI-18). Từ 18/11/2026 có đường khác: worker ở cạnh API, chỉ gọi mô hình sang máy AI qua Ollama (AI-22), không cần AI-18 | AI-18, AI-22 |
| 4 | Vào khay | BE-97 (mức 7, migration 032) | ✅ chạy thật: PDF mới tải lên ở khay nền, `queueKind=background` | — |
| 5 | Worker lấy việc | AI-13, AI-15 ✅ (107 test, gồm PostgreSQL thật) | ✅ chạy thật trên `hoso_dev`: lấy việc theo mức, việc nền nhường chỗ rồi chạy tiếp từ trang còn thiếu. Chưa cài launchd | AI-19 |
| 6 | OCR | PaddleOCR-VL 1.6 | ✅ | — |
| 7 | Phân loại, trích trường | Qwen3-1.7B | ✅ mặc định đã đổi sang **IFStruct** (17/11 tối; 1.7B là lịch sử); chạy thật ở máy Windows qua Ollama (AI-22). Thu hẹp từ khóa (AI-20) vẫn bật; chỉ đo trên dữ liệu giả lập | AI-20, AI-12, AI-22 |
| 8 | Ghi gợi ý, báo tiến độ | worker ghi `ai_suggestions` và NOTIFY; API đẩy SSE (BE-45 ✅); web FE-08 | ✅ Web mở một luồng SSE (fetch có header phân công), hộp tiếp nhận và màn đối chiếu cập nhật trực tiếp | FE-08 |
| 9 | Đối chiếu | API BE-47…50 ✅; web FE-22, FE-23 | ✅ Web đối chiếu với dữ liệu thật, xem bản gốc bằng ảnh trang, làm nổi vùng nguồn của trường (AI thật ghi vùng từ 18/11: AI-21); vùng nằm trên bản quét cũ thì báo và dẫn tới bản đó. Trình xem pdf.js chưa làm | FE-22 |
| 10 | Xếp vào hồ sơ | API BE-62, BE-63 ✅; web FE-24 | ✅ Web xếp hồ sơ thật, tạo hồ sơ tại chỗ, mở PDF kế tiếp | FE-24 |
| 11 | Trích xuất ngay, khay chờ | BE-98, BE-99; FE-45 | ✅ API chạy thật (nâng mức, không tạo việc trùng, ước tính thời gian); web ✅ nối API thật ở hộp tiếp nhận | — |
| 12 | Theo dõi | Trang vận hành (BE-88, BE-99, BE-100, FE-44); `ocr_jobs.model_version` | ✅ API và web (FE-44) hiện mô hình thật, cảnh báo lệch, số việc theo khay | — |

### Thứ tự làm

| Bước | Việc | Xong khi |
|---|---|---|
| 0 | Kiểm chứng phần đã viết: build và test BE-97, BE-98, BE-99; chạy `tsc`, `eslint`, `next build` cho FE-45 | Toàn bộ test backend qua; frontend build sạch |
| 1 | **AI-14** (1.7B mặc định, migration 033) và **OPS-07** (áp 032 và 033 vào `hoso_dev` sau khi sao lưu, mở đăng nhập cho `hoso_ai_worker`, tạo `.env`, script chạy đủ ba phần) | Worker khởi động với 1.7B; `/health` báo sẵn sàng |
| 2 | **AI-19** (worker chạy như dịch vụ) và **QA-07** (kịch bản kiểm tra luồng qua API, chưa cần giao diện) | `scripts/smoke-ai-flow.py` qua trọn: tải, đọc, gợi ý, đối chiếu, xếp hồ sơ; "Trích xuất ngay" đưa giấy tờ lên trước |
| 3 | Giao diện: FE-05, FE-06, FE-08, rồi FE-21, FE-23, FE-24 (FE-45 đã có mã) | Làm được cả luồng trên trình duyệt với API thật |
| 4 | Theo dõi: **BE-100**; AI-12 đo tiếp trên giấy tờ thật | Trang vận hành cho biết mô hình đang chạy và tốc độ thật |
| 5 | Khi tách máy AI hoặc có phần cứng mới: **AI-18** (S3/MinIO), **AI-17** (đổi mô hình), AI-11 (Linux GPU) | Theo từng task |

Bước 0–2 thông luồng ở phía máy chủ (API, worker, mô hình): **đã chạy thật ngày 17/11/2026**, xem mục dưới. Bước 3 (giao diện) đã làm ngày 17/11/2026 và có E2E `frontend/e2e/tiep-nhan.spec.ts`: nạp 3 PDF → khay → AI đọc xong → đối chiếu → tạo hồ sơ và xếp vào.

### Kết quả chạy thật phía máy chủ · 17/11/2026 và vấn đề còn lại

Chạy trên stack dev thật (API .NET, worker Python, PostgreSQL `hoso_dev`, Qwen3-1.7B), bằng `scripts/smoke-ai-flow.py` (luồng chính, 65 giây, 0 hỏng) và `scripts/smoke-ai-edge.py` (các đường phụ). Số đo chi tiết: [ai-worker/training/BAO-CAO-TOC-DO-M4.md](../../ai-worker/training/BAO-CAO-TOC-DO-M4.md).

**Chạy đúng:**
- đăng nhập, tải PDF vào khay nền, "Trích xuất ngay" nâng mức và không tạo việc trùng, SSE báo `job.progress` và `job.completed`;
- việc nền nhường chỗ rồi chạy tiếp từ trang còn thiếu; ngoài ra `/jobs/{id}` báo `queueKind`;
- PDF có lớp chữ không OCR (hợp đồng đất 3 trang); PDF lẫn trang quét chỉ OCR trang ảnh (8 trang, 1 trang OCR, 24 giây);
- đọc lại một trang (chỉ trang đó, không đổi gợi ý cũ); "Trích xuất lại" chỉ gợi ý lại (reclassify, không OCR lại, giữ gợi ý cũ làm lịch sử);
- hủy việc đang chờ và đang chạy: worker dừng, không để lại gợi ý;
- web: đăng nhập dev qua proxy của Next rồi mở trang với phiên thật (`/api/v1/me`).

**Vấn đề tìm thấy và đã sửa:**

| # | Vấn đề | Sửa |
|---|---|---|
| 1 | 1.7B chọn nhóm 70%, loại 8% (4B: 98% và 92%) | Thu hẹp ứng viên bằng từ khóa tiêu đề (AI-20) |
| 2 | 1.7B chép dòng phụ đề vào `document_form` làm danh sách loại rỗng, bỏ luôn bước chọn loại | Danh sách rỗng thì quay về các loại của nhóm đã chọn |
| 3 | Biểu mẫu xe điền tay bị xếp nhầm vào nhóm công văn (U01-D02) và 0/9 trường: hai loại cùng khớp tên, mô hình chọn bừa | Tên loại nằm trong dòng tiêu đề in hoa được cộng điểm; nhóm khớp áp đảo thì dùng nhóm đó. Sau sửa: đúng loại, 7/9 trường (bằng bản 4B) |
| 4 | Gói quét 7 trang gồm ba loại giấy tờ không được báo "cần tách" (`mixedDocuments=false`) | Nhiều trang tự ghi tên loại khác nhau ở tiêu đề thì đánh dấu gói nhiều giấy tờ |
| 5 | Bấm "Trích xuất ngay" khi job đã được worker lấy: phần phân loại vẫn dùng lời nhắc chậm (mức ưu tiên đọc lúc lấy việc) | Đọc mức hiện tại trong CSDL |
| 6 | Job từng nhường chỗ ghi `model_version` thiếu mô hình OCR | Tính cả trang đã OCR ở lần chạy trước |
| 7 | Nhật ký worker ẩn cả bộ đếm `pages_text` (khóa chứa "text") nên mất số liệu | Chỉ ẩn khi giá trị là chuỗi/cấu trúc |
| 8 | Worker từng **kẹt 13 phút ở 197% CPU**, không trả lời `/health`, giữ cổng 9108 và không nhận việc (máy đang dùng 9 GB swap trên 10 GB). Không tìm ra nguyên nhân. Dấu vết: kẹt ngay sau khi ghi `completed` vào CSDL cho job biểu mẫu xe (chưa có dòng nhật ký `job_completed`, thư mục làm việc rỗng còn sót); lệnh dừng (TERM) không được xử lý nên vòng lặp chính nằm trong một lệnh gọi không trả về. Các lần tắt/bật sau đều êm (kể cả khi đã nạp OCR và LLM, thoát sau 2 giây) | Watchdog cấp vòng lặp: vòng lặp rảnh không quay quá 120 giây hoặc tắt máy quá 180 giây thì thoát mã 75 để launchd/systemd chạy lại; `kill -USR1 <pid>` ghi ngăn xếp mọi luồng vào nhật ký |
| 9 | `dev-up.sh` chạy worker mới khi worker cũ chưa thoát: "Address already in use", worker chết im lặng | `stop` chờ tối đa 30 giây rồi buộc dừng; `start` từ chối khi cổng 9108 đang bị giữ; thêm `restart` |
| 10 | Bản đo tốc độ đầu tiên của 1.7B chạy đường thí điểm cũ, không giống worker | Đo lại đúng đường của worker (ghi rõ trong báo cáo) |

**Còn lại, chưa giải quyết:**
1. **Chưa có số đo trên giấy tờ thật.** Mọi con số đúng nhóm/loại của cách thu hẹp từ khóa là trên tài liệu giả lập in sẵn tên loại làm tiêu đề, nên chỉ là cận trên. Giấy tờ thật chỉ ghi "Công văn" hoặc "Thông báo" sẽ không khớp, và khi đó chất lượng trở lại mức yếu của 1.7B. Cần ít nhất 20 giấy tờ thật đã có nhãn (AI-12, AI-20).
2. ~~**Giá trị trích có thể thừa hoặc sai chữ nhỏ.**~~ Phần thừa và sai kiểu đã xử lý ở AI-23 (18/11/2026); sai chữ do OCR ("Thứ" thay "Thử") vẫn còn. Ghi lại: **Giá trị trích có thể thừa hoặc sai chữ nhỏ.** Ví dụ biển số: AI trả "TEST-001 - Màu biển: Trắng" thay vì "TEST-001"; địa chỉ "Thứ Nghiệm" do OCR đọc sai "Thử". Bộ lọc chỉ kiểm giá trị có nằm trong văn bản, không kiểm đúng hình thức của trường (biển số, ngày, số). Cần chuẩn hóa theo `value_type` của trường.
3. **Tốc độ do OCR trang dày chữ quyết định:** một trang A4 in dày chữ ≈ 29 giây, gói quét 7 trang ≈ 134 giây; bản điền mô phỏng ≈ 7 giây/trang. Phần LLM sau khi đã nạp mô hình chỉ 7–15 giây. Ước tính thời gian chờ (`etaSeconds`) sẽ bằng `null` cho tới khi có ít nhất 3 trang OCR trong 24 giờ.
4. **Thu hồi sau khi worker chết** phải chờ API phát hiện mất nhịp sống (mặc định 5 phút) rồi chờ chu kỳ quét 1 phút: việc dở đứng yên tối đa khoảng 6 phút. Kịch bản kiểm tra giả lập mất nhịp bằng cách đặt lùi `heartbeat_at`.
5. ~~Giao diện chưa nối API thật~~ đã nối (FE-06, FE-08, FE-21, FE-23, FE-24). Còn lại: trang vận hành chưa hiện `runningModels`, `modelMismatch` (FE-44); trình xem PDF và vùng nguồn (FE-22).
6. **Chưa cài worker thành dịch vụ** (launchd, AI-19) nên chưa kiểm được tự khởi động lại sau khi máy khởi động lại hay sau mã thoát 75.
7. **Chưa đo bộ nhớ thật khi OCR và 1.7B cùng nằm trong bộ nhớ** (pha `coresident`): ước tính 6,5 GB trên ngân sách 7 GB, trong khi máy dev đang dùng gần hết swap.
8. ~~`access_events.action` chỉ nhận các hành động xem/tải~~: đã làm ở BE-128 (migration 040), "Trích xuất ngay" nay có trong nhật ký truy cập.

---

## Phương án cho máy hiện tại (Mac M4 16 GB), ưu tiên tốc độ · 17/11/2026 (phân tích dẫn tới quyết định ở trên)

| Bước | Chọn | Lý do |
|---|---|---|
| Đọc chữ trang quét (OCR) | **Giữ PaddleOCR-VL 1.6** | PP-OCRv5 Latin và PP-OCRv6 medium nhanh hơn nhưng làm mất nhiều dấu tiếng Việt (`document_ai/README.md`, đối chiếu trên `central-001`) |
| Chọn nhóm, loại, trích trường (LLM) | **Qwen3-1.7B-4bit gốc, không LoRA** (`mlx-community/Qwen3-1.7B-4bit`, revision `3b1b1768f8f8cf8351c712464f906e86c2b8269e`) | Trích trường: 90,2% đúng, 14,2 giây/tài liệu với lời nhắc đầy đủ, 4,8 giây với lời nhắc ngắn. Qwen3-4B hiện tại: 88,9% đúng, 24,9 giây |
| Lời nhắc | **Ngắn cho việc có người đang chờ; đầy đủ cho khay nền** | Lời nhắc ngắn nhanh 3 lần nhưng sai nhiều hơn (4,3% so với 3,0%). Ở khay nền không ai chờ nên dùng bản chính xác hơn |
| Giữ mô hình | **Cả OCR và LLM nằm sẵn trong bộ nhớ** | Trước AI-13, mỗi job nạp lại OCR mất 11,8 giây; LLM nạp lại ở mỗi lần gọi |
| Số worker | **Một** | Máy 16 GB chỉ chạy được một lượt AI mỗi lúc |
| Mô hình lớn hơn | Qwen3-4B hoặc lớn hơn, đổi bằng cấu hình (AI-17) | Khi có phần cứng đủ mạnh, hoặc khi đo trên giấy tờ thật thấy 1.7B không đạt |

**Không chọn:**
- **Qwen3.5-2B.** Huấn luyện LoRA hết bộ nhớ GPU ở khoảng 1.000 token. Cắt xuống 384 hoặc 640 token thì loss = `nan`. Chạy không huấn luyện mất 70–78 giây/tài liệu, gấp 3 lần 4B. Lượt đo dừng ở 13/56 tài liệu nên không có số đo độ đúng.
- **Adapter LoRA của 1.7B.** Không tốt hơn rõ rệt so với bản gốc dùng cùng lời nhắc (89,4% so với 88,7%).
- **Hai worker song song.** Không đủ RAM.

### Số đo đã có

| Việc | Số đo | Nguồn |
|---|---|---|
| Nạp OCR (PaddleOCR-VL, bố cục, hướng trang, máy chủ MLX) | 11,8 giây (lần đo sau: 9,2 giây) | `/Volumes/quocDisk/AI/paddleocr/training/ocr.log`, `bench/ocr-meta.jsonl` |
| OCR | khoảng 12 giây/trang; trung vị 17 giây/tài liệu, p90 22 giây (285 tài liệu giả) | `training/ocr.log` |
| Nạp Qwen3-4B | 3,3 giây | `training/eval/base-qwen3-4b-prod.json` |
| Trích trường (đã biết loại, 1 lệnh gọi LLM) | 4B: 24,9 giây · 1.7B đầy đủ: 14,2 giây · 1.7B ngắn: 4,8 giây | `training/eval/*.json`, 56 tài liệu giả |
| Toàn luồng thí điểm (4B, nạp lại mô hình mỗi lần) | 1 trang quét: 55 giây · 1 trang có lớp chữ: khoảng 36 giây · 3 trang quét: 117 giây | `document_ai/README.md` |

**Chưa đo (AI-12 đo tiếp, không chặn việc dùng 1.7B):**
- thời gian và độ đúng của bước chọn nhóm và loại (2 lệnh gọi LLM) với 1.7B;
- bộ nhớ thật của OCR (trong mã đang ghi ước tính 4,5 GB);
- độ đúng trên giấy tờ thật (số đo trên dữ liệu giả, khoảng 90% là giấy tờ tự dựng).

### Ước tính sau khi làm

Đây là ước tính, AI-12 đo lại.

| Tài liệu | Trước | Sau AI-13 và AI-14 |
|---|---|---|
| 1 trang quét | khoảng 55 giây | khoảng 20 giây: OCR 12 giây + trích trường ngắn 5 giây + chọn nhóm/loại (chưa đo) |
| 1 trang có lớp chữ | khoảng 36 giây | khoảng 5–10 giây |
| Thời gian chờ của việc ưu tiên khi máy đang chạy khay nền | hết cả tệp đang đọc | tối đa 1 trang (khoảng 12 giây), nhờ AI-15 |

---

## Hiện trạng luồng trước đợt làm (vì sao phải làm)

Tình trạng sau đợt làm 17/11/2026: mục 1 và 2 đã sửa (AI-13); mục 3 đã sửa trong mã (BE-97, AI-15) nhưng phần .NET chưa build và test; mục 4 vẫn còn (OPS-07, AI-19).

1. **Mô hình cố định trong mã.** `document_ai/config.py` (`MODELS["classifier"]`) luôn trỏ tới Qwen3-4B. Không có biến môi trường để đổi. Bảng `hoso.ai_models` chỉ để hiển thị ở màn quản trị và không quyết định mô hình nào được nạp. `ocr_jobs.model_version` không được ghi.
2. **Nạp lại mô hình liên tục.**
   - Ngân sách bộ nhớ mặc định 6 GB nhỏ hơn OCR (ước 4,5 GB) cộng 4B (3 GB), nên bước phân loại của mỗi job đẩy OCR ra khỏi bộ nhớ. Job sau phải nạp lại OCR (11,8 giây).
   - `document_ai/classify.py` gọi `load()` ở mỗi lần phân loại.
3. **Mọi job cùng mức ưu tiên 3.** Áp dụng cho tải lên, đọc lại trang và tách văn bản. Chưa có khay nền, chưa ưu tiên theo yêu cầu, và job đang chạy không nhường chỗ.
4. **Worker chưa từng chạy với CSDL dev.** Không có `ai-worker/.env`; `hoso_dev` có 0 job và 0 gợi ý AI.

---

## Mức ưu tiên và khay nền (thiết kế chung với backend)

`ocr_jobs.priority`: số nhỏ chạy trước (cột đã có, giá trị 1–9).

| Mức | Tên | Khi nào | Lời nhắc trích trường |
|---|---|---|---|
| 1 | Làm ngay | Người dùng bấm "Trích xuất ngay" cho hồ sơ hoặc giấy tờ chỉ định (BE-98) | ngắn |
| 3 | Tương tác | Đọc lại trang, phân loại lại, tách văn bản (giữ như hiện tại) | ngắn |
| 7 | Khay nền | Mọi PDF mới tải lên (BE-97) | đầy đủ |

**Quy tắc:**
- **Thứ tự lấy việc:** `priority`, rồi `coalesce(prioritized_at, created_at)`. Giấy tờ vừa được nâng mức xếp theo lúc nâng, không chen lên trước nhờ đã tải từ lâu.
- **"Thời gian chết":** khay nền chỉ chạy khi không còn việc mức 1–3 đang chờ.
  - Mặc định chạy ngay khi rảnh, vì máy AI là máy riêng.
  - Nếu máy AI còn dùng cho việc khác, đặt thêm khung giờ (`HOSO_AI_BACKGROUND_WINDOWS`) để khay nền chỉ chạy trong khung đó.
- **Nhường chỗ:**
  - Job nền đang OCR sẽ kiểm tra sau mỗi trang (và trước bước phân loại) xem có việc mức thấp hơn khay nền đang chờ không. Nếu có, job trả về hàng đợi và giữ các trang đã đọc.
  - Lần trả về này không tính là một lần thử: `attempt` vẫn tăng đều (mã chống nhầm chủ sở hữu, không lặp lại), `preempted_count` tăng 1, giới hạn thử lại tính `attempt - preempted_count`.
  - Không ngắt giữa bước gọi LLM vì bước này ngắn.
- **Nâng mức job đang chạy:** nếu người dùng nâng mức đúng job đang chạy thì job đó không bị nhường nữa; worker đọc lại mức hiện tại từ CSDL mỗi lần kiểm.

---

## P4b · Tốc độ và đấu nối với backend

### AI-12 · Đo chuẩn từng bước trên máy hiện tại 🟡 · 1 ngày (không còn là cổng chặn)
- **Tệp:** `ai-worker/training/bench_pipeline.py`; kết quả ở `/Volumes/quocDisk/AI/paddleocr/training/bench/`; báo cáo `ai-worker/training/BAO-CAO-TOC-DO-M4.md`.
- **Đã làm:** công cụ đo 3 pha chạy đúng hàm `classify()` thật:
  - `ocr`: đọc chữ và lưu cache, chạy tiếp được nếu bị ngắt;
  - `llm --model`: thời gian từng bước (chọn nhóm, chọn loại, trích trường), độ đúng nhóm/loại/trường, bộ nhớ đỉnh;
  - `coresident`: OCR và LLM cùng nằm trong bộ nhớ, đo RAM còn trống và swap.

  Lượt đầu chạy trên 47 tài liệu giả lập (36 `filled-samples`, 11 `citizen-samples`, 67 trang). Pha OCR: khoảng 7 giây/trang với bản điền font, 15–25 giây/trang với biểu mẫu dày chữ. Pha Qwen3-4B xong; Qwen3-1.7B và pha chạy chung đang chạy.
- **Còn làm:**
  1. Viết báo cáo khi lượt đo xong. Ghi rõ: dữ liệu là giả lập; máy đang dùng 5,8 GB swap trước khi đo (trình duyệt, VS Code chạy cùng), nên số đo bộ nhớ chỉ phản ánh máy dev đang bận; trong lúc đo có chạy test Python nhẹ.
  2. Sau khi luồng chạy (QA-07), đo lại trên ít nhất 20 giấy tờ thật đã được cán bộ xác nhận (lấy từ kết quả đối chiếu, AI-10).
- **Kiểm tra:** báo cáo có bảng số, ghi rõ tập dữ liệu, số tài liệu và giới hạn.

### AI-13 · Giữ mô hình trong bộ nhớ, chọn mô hình bằng cấu hình ✅ · 1 ngày
- **Kết quả:**
  - `HOSO_AI_CLASSIFIER_MODEL` (tên thư mục trong `models/`; tên có đường dẫn bị từ chối). Thiếu mô hình thì worker dừng ngay lúc khởi động, kèm danh sách mô hình đang có.
  - `QwenMlxClassifier` nạp mô hình **một lần** và giữ giữa các job. Bỏ mô hình thì gọi `mx.clear_cache()` để trả bộ nhớ GPU; trước đây chỉ `gc.collect()`.
  - `classify(..., llm=)` nhận mô hình đã nạp. Bản thí điểm và lệnh `once` vẫn tự nạp như cũ.
  - Lời nhắc dựng với `enable_thinking=False`. Mẫu chat của Qwen3-4B-Instruct-2507 bỏ qua tham số này nên kết quả của 4B không đổi.
  - `HOSO_AI_CLASSIFIER_GB`, hoặc bảng RAM ước tính trong `document_ai/config.py` (4B: 3 GB, 1.7B: 2 GB).
  - Mỗi job ghi `ocr_jobs.model_version`, ví dụ `ocr=PaddleOCR-VL-1.6@132c45f classifier=Qwen3-1.7B-4bit@3b1b176/short`. Phần `ocr=` chỉ có khi job thật sự OCR. Nhãn `"model"` trong kết quả lấy từ mô hình đang chạy.
- **Test:** `tests/test_classifier.py`:
  - ba tài liệu chỉ nạp một lần, bỏ thì trả bộ nhớ, cần thì tự nạp lại;
  - `enable_thinking=False` ở mọi lời nhắc;
  - đổi mô hình bằng biến môi trường;
  - tên mô hình không trỏ ra ngoài thư mục mô hình;
  - thiếu mô hình thì `build_engines` báo `SettingsError`;
  - ghi `model_version`.

  Hợp đồng PostgreSQL: `complete()` ghi `model_version`.
- **Chưa làm:** `HOSO_AI_CLASSIFIER_ADAPTER`. LoRA không cho lợi ích đo được nên chưa cần.

### AI-14 · Chuyển mặc định sang Qwen3-1.7B ✅ · 1 ngày
> **Lịch sử:** mặc định này đã bị thay bằng IFStruct tối 17/11/2026 (mục đầu tệp, migration 036). Phần mã (lời nhắc ngắn/đầy đủ, khay nền, ngân sách bộ nhớ) vẫn đang dùng.
- **Phụ thuộc:** AI-13. Không còn chờ AI-12 (quyết định 17/11/2026).
- **Đã làm:**
  - Lời nhắc ngắn đưa vào `document_ai/prompts.py`; `ai-worker/training/prompts.py` dùng lại đúng bản này.
  - `classify(..., prompt_style="production"|"short")` chỉ đổi bước trích trường. Bản ngắn không xin trích dẫn: lấy chính giá trị làm dẫn chứng, và giá trị vẫn phải có nguyên văn trong văn bản mới được nhận.
  - Job mang mức ưu tiên từ CSDL (`Job.priority`). `HOSO_AI_PROMPT_INTERACTIVE` dùng cho việc có người chờ, `HOSO_AI_PROMPT_BACKGROUND` cho khay nền (`HOSO_AI_BACKGROUND_FROM`, mặc định 7).
  - Test: lời nhắc ngắn chỉ hỏi label/value, tối đa 1.200 token; giá trị bịa bị loại; mức 1/3/6 dùng lời nhắc nhanh, mức 7/9 dùng lời nhắc đầy đủ.
- **Kết quả (phần còn lại đã làm):**
  - `document_ai/config.py`: mặc định `Qwen3-1.7B-4bit`, `MODELS["classifier"]` ghim `mlx-community/Qwen3-1.7B-4bit` @ `3b1b176`; Qwen3-4B chuyển sang `OPTIONAL_MODELS["classifier_4b"]` (tải: `python -m document_ai.download --model classifier_4b`, đổi lại bằng `HOSO_AI_CLASSIFIER_MODEL`). `download.py` tải đúng thư mục đã ghim, không phụ thuộc cấu hình.
  - Mặc định lời nhắc: việc có người chờ `short`, khay nền `production`; ngân sách bộ nhớ 7 GB.
  - Migration 033 (`ai_models` ghi 1.7B kèm lý do và cách quay lại), đã áp vào `hoso_dev`.
  - Cập nhật `.env.example`, README các nơi, `scripts/evaluate-form-test-data.py` (trước đây gọi mẫu chat không tắt chế độ suy nghĩ, sẽ hỏng với 1.7B).
  - Trên worker thật: `model_version` ghi `classifier=Qwen3-1.7B-4bit@3b1b176/short` hoặc `/production`; mức ưu tiên đang xét là mức **hiện tại** trong CSDL (bấm "Trích xuất ngay" khi job đang chạy thì phần còn lại dùng lời nhắc nhanh); job từng nhường chỗ vẫn ghi mô hình OCR đã dùng ở lần chạy trước.

### AI-15 · Khay nền và nhường chỗ cho việc ưu tiên ✅ · 1,5 ngày
- **Kết quả:**
  - **Lấy việc:** theo `priority`, rồi `coalesce(prioritized_at, created_at)`. `claim(exclude_priority_from=)`: ngoài khung giờ `HOSO_AI_BACKGROUND_WINDOWS` chỉ lấy việc có người chờ.
  - **Khung giờ:** `runtime/windows.py`, ví dụ `11:30-13:30,17:30-07:30,sat,sun`. Hỗ trợ khoảng qua nửa đêm. Giá trị sai thì dừng lúc khởi động.
  - **Nhường chỗ:** việc nền đang chạy kiểm tra sau mỗi trang OCR và trước bước phân loại. Câu SQL đọc mức **hiện tại** của chính nó, nên việc đã được nâng mức thì không nhường. Khi có việc có người chờ, ném `JobYielded`, trả job về hàng đợi và giữ trang đã đọc, ghi log `job_yielded`.
  - **Đổi so với thiết kế ban đầu:** `attempt` vẫn tăng đều thay vì giảm đi 1, vì đây là mã chống nhầm chủ sở hữu và không được lặp lại. Số lần thử thật là `attempt - preempted_count`; `should_retry` của worker và `requeue_stale_jobs` (sửa trong migration 032) đều dùng con số này.
- **Test:** `tests/test_background_queue.py` (21) và 5 test hợp đồng PostgreSQL:
  - việc nền 10 trang nhường sau trang 3, việc ưu tiên xong trước, quay lại chỉ đọc trang 4–10;
  - việc đã nâng mức không nhường;
  - việc có người chờ không nhường;
  - việc nền không nhường cho việc nền khác;
  - thứ tự theo lúc nâng mức;
  - ngoài khung giờ chỉ lấy việc ưu tiên;
  - bản job cũ không trả được việc đã bị lấy lại;
  - `requeue_stale_jobs` không tính các lần nhường.

  Toàn bộ worker: 86 test qua.

### AI-16 · Kết quả sớm cho việc ưu tiên nhiều trang ⬜ · 1,5 ngày (tùy chọn)
- **Chỉ làm nếu** số đo thật cho thấy hồ sơ ưu tiên nhiều trang vẫn phải chờ lâu, ví dụ PDF 10 trang quét mất khoảng 2 phút.
- **Làm:**
  1. Job mức 1 có từ 4 trang trở lên: OCR trang 1–2, chọn nhóm và loại, ghi gợi ý tạm có cờ `partial`.
  2. Đọc tiếp các trang còn lại, rồi trích trường và gợi ý lại trên toàn văn.
- **Kiểm tra:** giao diện thấy loại giấy tờ sau khoảng 30 giây với PDF 10 trang; gợi ý cuối thay gợi ý tạm, không tạo hai gợi ý đang hiệu lực.

---

## Task vận hành, thông luồng và đổi mô hình

### AI-20 · Giúp mô hình nhỏ chọn đúng nhóm và loại giấy tờ 🟡 · 1 ngày
> Viết cho 1.7B; mặc định nay là IFStruct 4B, số đo chọn IFStruct (100% đúng nhóm và loại trên bộ thử) chạy cùng cách thu hẹp này nên vẫn bật (`HOSO_AI_SHORTLIST`). Phần "đo trên giấy tờ thật" còn nguyên.
- **Vì sao:** dùng 1.7B cho cả ba bước thì bước chọn nhóm và loại gần như đoán bừa. Đo trên 47 tài liệu giả lập với đúng đường chạy của worker (chỉ chọn loại trong nhóm đã chọn): đúng nhóm 70% (4B: 98%), đúng loại 8% (4B: 92%). Hai nguyên nhân:
  1. 1.7B chọn trong 38 nhóm rồi hàng chục loại tên gần giống thì chọn kém;
  2. bước chọn loại dựa vào `document_form` do mô hình trả về. 1.7B hay chép cả dòng phụ đề của tài liệu ("Công văn, quyết định, thông báo và sổ đăng ký") nên `type_candidates` thu hẹp ra danh sách **rỗng** và bỏ luôn bước chọn loại. Đã sửa: danh sách rỗng thì quay về các loại của nhóm đã chọn (có test).
- **Đã làm** (`document_ai/shortlist.py`, tích hợp trong `classify(shortlist=True)`, bật bằng `HOSO_AI_SHORTLIST=on`):
  - chấm điểm từ khóa tên loại với phần đầu tài liệu, chỉ dùng chữ trong văn bản và danh mục (không dùng dữ liệu ngoài, không tốn GPU). Từ hiếm nặng hơn từ chung; tên loại nằm nguyên văn ở đầu tài liệu được cộng điểm; không dấu để chịu được OCR sai dấu;
  - **thu hẹp:** bước chọn nhóm chỉ thấy 8 nhóm khớp nhất, bước chọn loại chỉ thấy 10 loại khớp nhất, loại khớp nhất đứng đầu; không khớp gì (dưới ngưỡng) thì giữ nguyên danh mục đầy đủ như cũ;
  - **chắc chắn:** tài liệu tự in tên loại ở đầu trang (điểm từ 1) và hơn loại đứng sau ít nhất 0,15 thì dùng loại đó, bỏ qua lựa chọn của mô hình (kết quả ghi `type_chosen_by=document_title`, lý do nêu rõ). Tên loại trùng ở nhiều nhóm (ví dụ "Báo cáo") có hiệu bằng 0 nên không bao giờ coi là chắc chắn;
  - 9 test: `tests/test_shortlist.py`.
- **Kết quả đo:** xem bảng trong `ai-worker/training/BAO-CAO-TOC-DO-M4.md`.
- **Giới hạn quan trọng:** các tài liệu giả lập đều **in sẵn tên loại và tên nhóm** làm tiêu đề, nên cách chấm từ khóa này gần như luôn đúng trên bộ đo. Đây là con số lạc quan, không nói được điều gì về giấy tờ thật. Giấy tờ thật có tiêu đề không trùng tên danh mục, có thể chỉ ghi "Công văn" hoặc "Thông báo". Khi đó cách này không khớp (dưới ngưỡng) và quay về hỏi mô hình trên danh mục đầy đủ, tức là chất lượng trở lại mức yếu của 1.7B.
- **Còn làm:**
  1. Đo trên giấy tờ thật đã được cán bộ xác nhận loại (lấy từ kết quả đối chiếu, xem AI-10, AI-12). Nếu tỉ lệ khớp thấp thì thêm bước xếp hạng bằng nội dung (từ khóa của nhãn trường như "Biển số xe", "Người bán") và tên cơ quan ban hành.
  2. Cho cán bộ chọn lại loại nhanh trên màn đối chiếu bằng danh sách "gần giống nhất" (đã có BE-48).
  3. Nếu vẫn yếu, dùng mô hình lớn hơn chỉ cho bước chọn nhóm và loại (2–3 lệnh gọi ngắn) khi có phần cứng, giữ 1.7B cho bước trích trường (AI-17).

### AI-17 · Đổi sang mô hình lớn hơn khi có phần cứng ⬜ · 1 ngày
- **Mục tiêu:** đổi mô hình chỉ bằng cấu hình và một migration ghi nhận, có số đo so sánh trước khi đổi, quay lại được ngay.
- **Làm:**
  1. `document_ai/download.py` nhận `--repo` và `--revision` (ghim commit) cho mô hình chưa có trong danh sách, ghi biên nhận SHA-256 như các mô hình khác.
  2. `bench_pipeline.py` nhận thư mục giấy tờ thật kèm nhãn (không chỉ dữ liệu giả), so hai mô hình trên cùng bộ chữ OCR.
  3. Sổ tay (OPS-06), các bước:
     - tải mô hình, rồi đo;
     - đặt `HOSO_AI_CLASSIFIER_MODEL`, `HOSO_AI_CLASSIFIER_GB`, `HOSO_AI_MODEL_BUDGET_GB`;
     - khởi động lại worker;
     - chạy migration cập nhật `ai_models`;
     - chạy QA-07, theo dõi `model_version` trên trang vận hành (BE-100).
  4. Cách quay lại: đặt biến môi trường về `Qwen3-1.7B-4bit` rồi khởi động lại worker.
  5. Máy chủ Linux có GPU: cần thêm hồ sơ `linux-cuda` (AI-11), giao kèo với CSDL giữ nguyên.
- **Kiểm tra:** diễn tập đổi sang Qwen3-4B (đã có trên máy) rồi quay về 1.7B. Job sau mỗi lần đổi ghi đúng `model_version`, và QA-07 qua ở cả hai lần.

### AI-18 · Worker đọc kho tệp S3/MinIO ⬜ · 1 ngày
> Không còn cần cho trường hợp máy AI tách riêng: hồ sơ `ollama` (AI-22) giữ worker cạnh API. Chỉ cần khi chạy **worker** ở máy khác API.
- **Khi cần:** máy AI tách khỏi máy chạy API (sơ đồ docs/02) và kho tệp là MinIO hoặc S3. Chạy cùng máy thì không cần, vì worker đọc thẳng ổ đĩa.
- **Làm:**
  1. `S3BlobStorage` theo cùng giao kèo `open_verified(storage_key, sha256)`: tải về tệp tạm trong `HOSO_AI_WORK_ROOT`, kiểm SHA-256, xóa khi job xong.
  2. Cấu hình `HOSO_AI_STORAGE=local|s3` và `HOSO_AI_S3_*` giống `Storage:S3` của API (endpoint, bucket, prefix, path-style).
  3. Khóa truy cập **chỉ đọc**, chính sách riêng cho worker.
- **Kiểm tra:** test với moto như backend; sai mã băm thì job `failed`, không có lỗi kết nối thì thử lại; không để lại tệp tạm.

### AI-19 · Chạy worker thật như dịch vụ trên máy AI ⬜ · 0,5 ngày
- **Máy dev (đã làm 18/11/2026):** worker từng tự thoát lúc 20:11 ("vòng lặp rảnh không quay 141 giây", mã 75 của watchdog) và không có gì chạy lại. `scripts/dev-up.sh` nay chạy worker qua `ai-worker/deploy/supervise.sh`: chạy lại khi thoát ngoài ý muốn (giãn dần 5 → 60 giây), dừng hẳn khi `stop`, mã 0 hoặc 78. Đã thử giết tiến trình worker: sống lại sau ~12 giây; `stop` không để lại tiến trình mồ côi. Nguyên nhân worker kẹt lúc 20:11 vẫn **chưa rõ** (nhật ký nguồn điện không cho thấy máy ngủ).
- **Còn lại (dịch vụ thật):** cài LaunchAgent/systemd như dưới.
- **Phụ thuộc:** OPS-07, AI-14.
- **Làm:**
  1. Cài LaunchAgent (`deploy/launchd/install.sh`) để worker tự chạy khi máy khởi động lại; log ở `data/logs/ai-worker.log`. Bước này cũng là lần cài thật đầu tiên của AI-09.
  2. `/health` và `/metrics` (127.0.0.1:9108) báo mô hình đã nạp và job đang làm.
  3. Theo dõi một ngày chạy thật: giây/trang, giây/tài liệu, số lần nhường chỗ, RAM và swap.
- **Kiểm tra:**
  - khởi động lại máy thì worker tự chạy và lấy việc;
  - dừng worker giữa chừng thì job quay lại hàng đợi, lần sau chỉ đọc trang còn thiếu.

### AI-21 · Vùng nguồn và độ tin cậy thật cho từng trường ✅ · 1 ngày (18/11/2026)
- **Vì sao:** BE-114, FE-22, FE-23 cần `ai_field_suggestions.source_region` để bấm trường thì làm nổi đúng vùng trên trang. Trước đó chỉ AI giả điền.
- **Đã làm** (`ai-worker/src/hoso_ai/regions.py`, chạy trong pipeline sau khi engine gợi ý xong nên dùng chung cho MLX, Ollama và engine sau này; lỗi tìm vùng chỉ làm trường đó không có khung, không mất gợi ý):
  1. **Trang OCR:** khi đọc xong, mỗi khối của PaddleOCR-VL được kèm `region` theo tỉ lệ trang (`block_bbox` pixel chia `width`/`height` của ảnh đã dựng; bỏ vùng nếu trang bị xoay khi nhận dạng hướng). Trích dẫn trọn một khối: khung chính xác. Chỉ chiếm một phần khối: ước theo dòng và vị trí chữ, `approximate`.
  2. **Khối bảng (`table`, HTML):** biểu mẫu của dự án chủ yếu là bảng, nên định vị **theo ô**: cột chia theo `colspan`, hàng chia theo số dòng chữ lớn nhất trong hàng, rồi lấy dòng giá trị trong ô; luôn `approximate` (chiều cao thật của hàng không có trong kết quả OCR). Giá trị xuất hiện ở nhiều ô (cùng một tên người) thì ưu tiên ô có nhãn của trường.
  3. **Trang lấy từ lớp chữ PDF:** tìm bằng PDFium (`PdfiumReader.locate_texts`, mở PDF một lần) để có khung chữ thật; không tìm được thì ước theo dòng, `approximate`. Trang xoay thì bỏ vùng.
  4. `confidence` **để NULL** với AI thật (chưa có nguồn đáng tin; không bịa số).
- **Kiểm tra:** `tests/test_regions.py` (13 test, gồm PDFium thật trên `public-019.pdf` và khối bảng lấy từ lần chạy thật); chạy thật qua Ollama: 12/12 trường có giá trị đều có vùng, vẽ lên trang thấy 4/6 khung đúng dòng giá trị, 2 khung lệch nửa dòng ở ô có giá trị tự xuống dòng (đã đánh dấu ước tính, giao diện vẽ nét đứt). E2E `vung-nguon.spec.ts` chạy với AI thật.
- **Còn lại:** vẽ khung trên 20 giấy tờ có nhãn để đo độ lệch (chưa làm); vị trí ngang trong khối nhiều chữ chỉ ước theo số ký tự (chữ căn giữa lệch).

### AI-22 · Hồ sơ `ollama`: mô hình ở máy AI khác ✅ · 1 ngày (18/11/2026)
- Xem mục "Máy AI Windows qua Ollama" đầu tệp. Mã: `engines/ollama.py`, `engines/llm_suggest.py`, `EngineUnavailable` (`engines/base.py`), `Worker` trả job về hàng đợi khi máy AI không trả lời; test `tests/test_ollama_engine.py` (12).

### AI-23 · Chuẩn hóa giá trị trích theo kiểu trường ✅ · 0,5 ngày (18/11/2026)
- **Vì sao:** `evidence_fields` chỉ kiểm giá trị có nằm trong văn bản, không kiểm đúng hình thức của trường. Giao diện đối chiếu chỉ nhận trường ngày dạng `dd/mm/yyyy` nên AI trả "27 tháng 3 năm 2026" hay "09 giờ 30 phút, ngày 12/11/2026" thì cán bộ phải gõ lại mới xác nhận được. **E2E `duyet-ho-so` hỏng với AI thật vì đúng lỗi này** (ô "Ngày, giờ lập" không hợp lệ), trong khi qua với AI giả vì AI giả luôn trả `dd/mm/yyyy`. 399 trường ngày của danh mục đều bị ảnh hưởng.
- **Đã làm** (`ai-worker/src/hoso_ai/field_values.py`, gọi trong `engines/llm_suggest.py` nên dùng chung MLX và Ollama): chỉ ba việc, không bịa.
  1. Trường kiểu `date`: một ngày duy nhất đọc được (số `12/11/2026`, `12-11-2026`, hoặc chữ "ngày 5 tháng 3 năm 2026") thì đổi về `dd/mm/yyyy`; giờ bị bỏ khỏi giá trị nhưng còn trong `quote`. Nhiều ngày hoặc sai lịch (31/02) thì **giữ nguyên** cho người đối chiếu quyết định.
  2. Cắt phần thừa: câu hướng dẫn in sẵn `(Chọn một trong…)`; ở trường ngắn (không phải trích yếu, nội dung, kết quả…) cắt nhãn dòng kế bên (`TEST-001 - Màu biển: Trắng` → `TEST-001`).
  3. Bỏ hẳn (để trống, kèm cảnh báo cho cán bộ) khi không phải dữ liệu: trường ngày không có ngày nào ("Hợp đồng có hiệu lực từ ngày:"), giá trị chỉ là nhãn kết thúc bằng dấu hai chấm, hoặc chỉ là câu hướng dẫn ("Bên mua (…): (Chọn một trong các chủ thể nêu trên)"). Cả ba kiểu này lấy từ giá trị thật trong `hoso_dev`.
  - `quote` luôn giữ nguyên văn làm dẫn chứng; giá trị đã chuẩn hóa không còn phải nằm nguyên văn trong văn bản.
- **Kiểm tra:** `tests/test_field_values.py` (19 test, gồm đường xuyên `suggest_with`); chạy thật qua Ollama: ngày về `12/11/2026` kèm trích dẫn nguyên văn; E2E `duyet-ho-so` qua với AI thật.
- **Còn lại:** trường kiểu `number` chưa có trong danh mục (2.624 trường đều là `text` hoặc `date`) nên chưa có quy tắc riêng; biển số, số hiệu chưa kiểm theo mẫu.

### OPS-08 · AI giả cho máy dev không có mô hình ✅ · 0,5 ngày (18/11/2026)
- **Vì sao:** mô hình đã chuyển sang máy AI riêng; backend và frontend vẫn cần kết quả AI để làm màn đối chiếu, vùng nguồn, tách văn bản, hàng đợi.
- **Đã làm:** `HOSO_AI_PROFILE=fake` sinh chữ OCR mẫu có khối bố cục, chọn loại theo tiêu đề, trích trường có trích dẫn nguyên văn kèm
  `source_region` và `confidence`, báo gói nhiều giấy tờ; chỉnh độ chậm, tỉ lệ lỗi trang bằng `HOSO_AI_FAKE_*` (ai-worker/README mục "AI giả").
  `scripts/dev-up.sh ai fake|real` đổi qua lại và chỉ chạy lại worker. Worker từ chối profile giả khi `HOSO_ENV=production`.
- **Kiểm tra:** `tests/test_fake_engine.py` (9 test), hợp đồng PostgreSQL kiểm vùng nguồn và độ tin cậy ghi xuống CSDL;
  `scripts/smoke-ai-flow.py --file-to-dossier` qua hết với worker giả (bước 6 tự kiểm `fake-classifier`).

### AI-10 · Báo cáo độ đúng của AI từ việc cán bộ đối chiếu ✅ · 1 ngày (19/11/2026)
- **Cách đo:** mỗi trường cán bộ đã xác nhận (`document_field_values`, `needs_review = false`, có `verified_by`, còn trỏ về gợi ý qua `ai_field_suggestion_id`) được so với giá trị AI gợi ý, sau khi gộp khoảng trắng: `accepted` (giữ nguyên), `edited` (sửa), `cleared` (xóa trống: AI đọc cái không có), `missed` (AI để trống, người điền). Trường cả hai để trống không tính.
- **Đã làm:** view `hoso.v_ai_accuracy` (migration 042, đã áp vào `hoso_dev`, sao lưu `data/db-backups/hoso_dev-truoc-042-*.dump`) và `scripts/report-ai-accuracy.py` (chỉ dùng `psql` và thư viện chuẩn): ba bảng (theo mô hình, theo loại giấy tờ thấp nhất trước, 15 trường khó nhất), trường ít mẫu gom riêng (`--min`, mặc định 5); mặc định bỏ mô hình `fake`. Cờ `--model`, `--db`, `--include-fake`, `--out`.
- **Hạn chế phải đọc trước khi dùng con số:** (1) chỉ tính gợi ý ĐÃ được chấp nhận sao sang bảng chính, gợi ý bị bỏ qua không có dòng; (2) dữ liệu do E2E hay smoke tự bấm "đã kiểm" luôn cho 100% chấp nhận, **không phải độ đúng**; số có ý nghĩa chỉ khi cán bộ thật đã đối chiếu (xem AI-12, AI-20).
- **Kiểm tra:** `AiAccuracyViewTests` (backend, 2 ca: đủ bốn loại kết quả, trường chưa đối chiếu không lọt vào) và `tests/test_report_accuracy.py` (3 ca).

### OPS-07 · Môi trường dev chạy đủ luồng AI ✅ · 0,5 ngày
- **Làm:**
  1. Sao lưu `hoso_dev`, rồi áp migration 032 và 033 bằng `backend/scripts/migrate-hoso-dev.sh`: xem danh sách trước, sau đó mới `--apply`. Không chạy `migrate` trần, không chạy 004.
  2. `ALTER ROLE hoso_ai_worker LOGIN PASSWORD ...`. Mật khẩu chỉ ghi trong `ai-worker/.env` (không đưa vào repo). Kiểm lại: role này chỉ ghi được các bảng xử lý.
  3. `ai-worker/.env` từ `.env.example`:
     - `HOSO_AI_PROFILE=mac-mlx`;
     - `HOSO_AI_STORAGE_ROOT` trùng `Storage:Root` của API dev (`data/blobs`);
     - `HOSO_AI_CLASSIFIER_MODEL=Qwen3-1.7B-4bit`.
  4. `scripts/dev-up.sh start|status|stop` chạy ba phần:
     - API ở môi trường Development, cổng 5080;
     - worker;
     - web với `HOSO_API_INTERNAL_URL=http://localhost:5080` và `HOSO_SESSION_COOKIE=hoso_session_dev`. Next chuyển tiếp `/api/*` sang API, nên cookie và SSE cùng origin.
- **Kiểm tra:** một lệnh chạy đủ ba phần; đăng nhập web bằng tài khoản giả lập qua `/api/v1/auth/login`.

### QA-07 · Kịch bản kiểm tra thông luồng AI qua API ✅ · 1 ngày
- **Tệp:** `scripts/smoke-ai-flow.py`.
- **Làm:**
  1. Đăng nhập `demo_cv_ht` bằng dev-login; mở SSE `/api/v1/events`.
  2. Tải lên 2 PDF mẫu; mỗi lần chạy gắn dấu thời gian để không trùng mã băm. Cả hai phải ở khay nền (`queueKind=background`).
  3. Bấm "Trích xuất ngay" cho PDF thứ hai. PDF này phải đọc xong trước PDF thứ nhất; SSE có `job.progress` và `job.completed`.
  4. `GET /documents/{id}/review`: có nhóm, loại và ít nhất một trường có trích dẫn khớp văn bản.
  5. Xác nhận phân loại, sửa một trường, xác nhận giấy tờ; tạo hồ sơ rồi xếp giấy tờ vào.
  6. `ocr_jobs.model_version` ghi `Qwen3-1.7B-4bit@3b1b176`.
  7. In thời gian từng bước.
- **Kiểm tra:** chạy lặp lại được. Dùng làm bài kiểm tra sau mỗi lần cập nhật worker hoặc đổi mô hình (AI-17).
- **Kết quả 17/11/2026 (đã chạy thật, 0 kiểm tra hỏng ở từng lượt):**
  - `smoke-ai-flow.py`: 3 PDF, 65 giây; thêm `--file-to-dossier` (xác nhận phân loại, xác nhận trường, tạo hồ sơ, xếp giấy tờ vào, mở hồ sơ): 46 giây.
  - `smoke-ai-edge.py`: `text`, `mixed`, `reread`, `force`, `packet`, `handsim`, `cancel`, `crash`, mỗi kịch bản qua ít nhất một lượt. Các lượt chạy trên các phiên bản mã khác nhau trong ngày vì có sửa lỗi giữa chừng (xem bảng "Vấn đề tìm thấy"); chưa chạy lại cả bộ trong một lượt trên bản mã cuối.
  - Dữ liệu thử nằm lại trong `hoso_dev` (giấy tờ ở trạng thái đã bỏ khỏi hộp tiếp nhận, một hồ sơ `UBND-2026-000001` do `--file-to-dossier` tạo).

### AI-24 · Worker báo trạng thái máy AI, không nhận việc khi máy AI hỏng ✅ · 1 ngày (19/11/2026)
- **Vì sao:** từ khi mô hình chạy ở máy Windows qua Tailscale (AI-22), máy đó tắt thì worker vẫn "khỏe", cứ 30 giây nhận việc rồi trả lại (việc nhảy giữa "đang đọc" và "chờ", `attempt` và `preempted_count` tăng mãi), `/health/ready` bật tắt theo từng lần gọi, còn người dùng chỉ thấy "đang chờ, vị trí 1" không đổi. Trang vận hành chỉ thấy worker khi nó đang giữ việc nên worker rảnh, worker đã chết và máy AI tắt trông như nhau.
- **Đã làm:**
  1. `Engines.engine` + `Engines.probe` (`engines/base.py`); hồ sơ `ollama` thăm dò `/api/version` và đủ hai mô hình (`engines/ollama.py: probe`). Mô hình nằm trong worker (MLX, giả) không có hàm thăm dò, chỉ biết qua `EngineUnavailable` của job như trước.
  2. Worker (`worker.py`): thăm dò khi khởi động và lúc rảnh (60 giây khi máy trả lời, 10 giây khi máy hỏng); máy hỏng thì **không nhận việc**, việc nằm yên trong hàng; máy trở lại thì nhận việc ngay, không đợi hết khoảng chờ. Lỗi lạ khi thăm dò không làm chết worker.
  3. Ghi `hoso.ai_workers` (migration 044, `queue/postgres.py: report_worker`): khi khởi động, 30 giây một lần (cả lúc đang đọc, qua luồng heartbeat), và ngay khi máy AI đổi trạng thái kèm `NOTIFY ai_worker_status`; tắt êm thì xóa dòng; dòng im lặng quá 7 ngày được dọn. `/health` của worker có thêm `engine`.
  4. API và giao diện: BE-133 (docs/tasks/backend.md), FE-49 (docs/tasks/frontend.md).
- **Kiểm tra:** `tests/test_engine_status.py` (6 test), `test_ollama_engine.py` (+2: thăm dò, hồ sơ ollama gắn hàm thăm dò), `test_postgres_contract.py` (+1, chạy bằng role `hoso_ai_worker`: ghi, NOTIFY khi đổi trạng thái, dọn dòng cũ, ràng buộc "đang hỏng phải có thời điểm"; 23/23 qua trên CSDL sạch dựng bằng migration, còn trên bản sao `hoso_dev` hai ca cũ đếm cứng số nhóm và số trang hỏng vì dữ liệu dev). Chạy thật 19/11/2026: worker trỏ vào cổng chết trên máy Windows (tường lửa bỏ gói, giống máy tắt) → báo hỏng ngay khi khởi động; PDF tải lên nằm `queued`, `attempt=0` suốt 140 giây, không lần nhận việc nào; `/health/ready` Degraded; bật lại worker thật → 2 sự kiện SSE `ai.availability`, việc được nhận sau khoảng 3 giây và xong với 1 lần thử.
- **Còn lại:** độ trễ hủy việc vẫn tới hết trang đang đọc (5–30 giây với Ollama); worker thoát (mã 1) khi PostgreSQL đóng kết nối giữa lúc chờ việc, dịch vụ chạy lại sau 5–30 giây, chưa tự nối lại trong tiến trình.

---

## Thứ tự làm

Xem bảng "Thứ tự làm" ở mục **Thông luồng với Qwen3-1.7B** đầu file. AI-16 (kết quả sớm cho PDF ưu tiên nhiều trang) chỉ làm nếu số đo thật cho thấy cần.
