# 08 · Sổ tay vận hành (OPS-06)

> **Phạm vi hiện tại: máy dev và môi trường thử.** Quy trình triển khai thật (Docker, Caddy, TLS, Keycloak, giám sát) chưa có vì OPS-01, OPS-02, OPS-05, SEC-01 chưa làm: xem mục cuối. Mọi lệnh dưới đây đã chạy thật trên máy dev; chỗ nào chưa kiểm thì ghi rõ.
> (Kế hoạch đặt tên tệp này là `05-van-hanh.md` nhưng số 05 đã dùng cho tài liệu bảo mật.)

## 1. Các thành phần

| Thành phần | Chạy ở | Cổng | Ghi chú |
|---|---|---|---|
| API .NET | máy dev | 5080 | `dotnet run`; đọc/ghi PostgreSQL bằng role `hoso_api` |
| Web Next.js | máy dev | 3000 | `next dev`; chuyển tiếp `/api/*` sang API nên cookie và luồng SSE cùng origin |
| Worker AI | máy dev | 9108 (`/health`, `/metrics`) | lấy việc từ bảng `ocr_jobs`, role `hoso_ai_worker`; chạy qua `ai-worker/deploy/supervise.sh` (tự chạy lại) |
| PostgreSQL 16 | máy dev | 5432 | CSDL `hoso_dev` |
| Mô hình AI | máy Windows (Ollama, qua Tailscale) | 11434 | hồ sơ `ollama`; xem mục 3 |

Nhật ký và tệp tiến trình của dev nằm ở `data/dev-run/` (`api.log`, `worker.log`, `web.log`, `*.pid`).

## 2. Chạy và dừng

```sh
scripts/dev-up.sh start      # API, worker, web (tách khỏi phiên terminal; chạy lại thì bỏ qua phần đang chạy)
scripts/dev-up.sh status     # từng phần có chạy và có trả lời không; in AI worker đang dùng
scripts/dev-up.sh stop       # dừng cả ba (chờ tối đa 30 giây mỗi phần, quá hạn thì buộc dừng)
scripts/dev-up.sh restart    # sau khi sửa backend (API chạy bằng dotnet run) hoặc đổi ai-worker/.env
scripts/dev-up.sh logs       # đường dẫn nhật ký
```

Lần đầu: `scripts/dev-up.sh init` (cho hai role CSDL đăng nhập bằng mật khẩu dev và tạo `ai-worker/.env`).

**Tài khoản thử theo vai trò:** `backend/scripts/seed-dev-accounts.sh --apply` nạp 26 tài khoản giả lập (mỗi phòng/Ban một chuyên viên và một trưởng phòng/ban, văn thư UBND và HĐND, Chủ tịch, lãnh đạo HĐND, quản trị; không kèm hồ sơ giả lập). Trang web › "Đăng nhập bằng tài khoản cơ quan" mở trang Đăng nhập dev nhóm theo vai trò. `dev_admin` có 18 phân công: vào rồi đổi ở ô **Vai trò** trên thanh trên cùng, đầu menu trên màn hẹp, hoặc trang Tài khoản. Thử luồng nhiều bước thì dùng đúng người từng bước (chuyên viên trình → trưởng phòng cùng phòng → Chủ tịch/lãnh đạo HĐND → văn thư).

**Thử nối toàn bộ nghiệp vụ (QA-02):** `python3 scripts/smoke-nghiep-vu.py` (khoảng 4–6 phút: AI đọc 4 PDF) chạy luồng B (kèm giao việc, kho, nộp lưu, mượn trả, xuất gói), trả bổ sung và trình lãnh đạo, luồng A, luồng C HĐND, lô quét, ủy quyền và các trang của từng vai trò, mỗi bước bằng đúng tài khoản; chọn một phần: `… main return digitize council scan delegation pages`. Luật hay vấp khi thử tay: ý kiến trả lại/trình lãnh đạo/cho ý kiến từ 10 ký tự; giấy tờ phải xác nhận **mọi** trường (kể cả để trống) rồi bấm đã đối chiếu thì hồ sơ mới trình được; chuyên viên chỉ thấy hồ sơ mình chủ trì hoặc phối hợp; thông báo tới chậm vài giây (gửi qua outbox).

**Chạy bộ dev không phụ thuộc phiên Claude Code:** tiến trình do Claude khởi động bị giết khi phiên kết thúc; tự chạy `scripts/dev-up.sh start` trong Terminal của mình (hoặc để Claude mở Terminal chạy hộ bằng tệp `.command`).

## 3. AI

Chọn nơi chạy mô hình bằng `HOSO_AI_PROFILE` trong `ai-worker/.env`, đổi nhanh bằng:

```sh
scripts/dev-up.sh ai              # đang dùng gì
scripts/dev-up.sh ai fake         # AI giả: không cần mô hình, kết quả có `model_key='fake'`, tiêu đề [GIẢ LẬP]
scripts/dev-up.sh ai ollama [URL] # mô hình thật ở máy khác qua Ollama, ví dụ http://100.78.102.53:11434
scripts/dev-up.sh ai real         # mô hình thật ngay trên máy này (mac-mlx), cần RAM
```

- **Máy AI tắt hoặc mất mạng** (hồ sơ `ollama`, AI-24): worker thăm dò máy AI lúc rảnh (60 giây một lần khi máy trả lời, 10 giây khi máy hỏng; hỏi `/api/version` và đủ hai mô hình). Máy hỏng thì worker **không nhận việc**: PDF nằm yên ở "chờ đọc", không tính lần thử; việc đang đọc dở thì về lại hàng đợi, không mất trang đã đọc. Hộp tiếp nhận hiện "Máy AI tạm thời không trả lời từ …", trang vận hành hiện lỗi cụ thể, `/health/ready` thành Degraded khi có việc chờ mà máy AI hỏng quá 2 phút. Máy trở lại thì trong khoảng 10 giây worker nhận việc tiếp và băng báo tự tắt (SSE `ai.availability`). Đã thử giả lập ngày 19/11/2026 (worker trỏ vào cổng chết trên máy Windows) và sự cố thật ngày 18/11/2026. Kiểm: `scripts/dev-up.sh status` (dòng `ollama`), `curl http://<IP>:11434/api/version`, ping qua Tailscale, `deploy/run-worker.sh status` ở `ai-worker`.
- **Theo dõi:** trang Quản trị › Vận hành › Máy AI: cảnh báo đầu trang khi PDF không được đọc; mục **Worker AI** (mỗi worker tự báo 30 giây một lần: máy AI trả lời / không trả lời từ bao lâu kèm lỗi / im lặng quá 2 phút là có thể đã dừng); hàng đợi theo mức, nhịp tim việc đang đọc, mô hình đang dùng, việc lỗi. Worker: `curl -s http://127.0.0.1:9108/health` (có `engine`), `/metrics` (`hoso_ai_jobs_total{result=...}` gồm `engine_unavailable`). Bảng `hoso.ai_workers` (migration 044) giữ trạng thái này.
- **Cảnh báo "mô hình lệch ai_models":** tên thẻ Ollama không cho biết commit nguồn. Khi đã chắc mô hình trên máy AI chuyển từ đúng bản đã ghi, đặt `HOSO_AI_OLLAMA_CLASSIFIER_SOURCE=repo@commit` trong `ai-worker/.env` (người vận hành tự khai, worker không kiểm được).
- **Đổi mô hình:** tải và chuyển mô hình (`scripts/setup-document-ai.sh` cho MLX; `ollama create` cho Ollama), đặt `HOSO_AI_CLASSIFIER_MODEL` hoặc `HOSO_AI_OLLAMA_*_MODEL`, ghi nhận bằng migration `ai_models`, chạy `scripts/dev-up.sh restart`, rồi `python3 scripts/smoke-ai-flow.py` và `scripts/smoke-ai-edge.py` (đều phải 0 hỏng). Chi tiết ở [docs/tasks/ai.md](tasks/ai.md) mục AI-17.
- **Độ đúng:** `python3 scripts/report-ai-accuracy.py` (từ `v_ai_accuracy`). Chỉ có ý nghĩa khi cán bộ thật đã đối chiếu; dữ liệu E2E luôn ra 100%.

## 4. Cơ sở dữ liệu

- **Migration:** chỉ dùng `backend/scripts/migrate-hoso-dev.sh` (liệt kê trước, `--apply` mới chạy), sau khi sao lưu. Quy trình và lý do: [CONTRIBUTING.md](../CONTRIBUTING.md). Sau khi áp, khởi động lại API.
- **Sao lưu tay trước khi đổi:** `pg_dump -h 127.0.0.1 -U quoc -Fc -n hoso -n public hoso_dev > data/db-backups/hoso_dev-truoc-<việc>-$(date +%Y%m%d-%H%M%S).dump`.
- **Sao lưu định kỳ và khôi phục:** `ops/backup/` (OPS-03, OPS-04), có hướng dẫn cài và quy trình khôi phục sau sự cố ở [ops/backup/README.md](../ops/backup/README.md). Bản dump không tự dựng lại extension: làm đúng các bước ở đó, đừng `pg_restore` thẳng vào CSDL mới. Chưa có sao lưu WAL.
- **Nhật ký:** `access_events` (xem, tải, in, xuất, tìm kiếm, "Trích xuất ngay") và `audit_events` (thay đổi dữ liệu, có mã tương quan của request) là bất biến. Tra ở Quản trị › Nhật ký hệ thống: theo **Mã lỗi** người dùng đọc trên màn lỗi, theo mã tương quan, người, đối tượng, khoảng thời gian.

## 5. Sự cố thường gặp

| Dấu hiệu | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Trang báo "Chưa tải được nội dung này" kèm **Mã lỗi** | lỗi từ API hoặc máy chủ web | Người dùng gửi mã (nút "Sao chép mã"); quản trị nhập ở Nhật ký hệ thống › Mã lỗi ra request, người, đường dẫn |
| API trả **429** hàng loạt | vượt giới hạn mỗi người (dev: 3000 yêu cầu/phút, mặc định thật 300) hoặc một trang đang lặp gọi API. Một số nhóm có giới hạn riêng nhỏ hơn (`Limits:OpsRequestsPerMinute` và `Limits:AiExtractPerMinute` mặc định 20/phút; tải PDF lên cũng có nhóm riêng) | Đếm yêu cầu theo giây trong `data/dev-run/api.log`; nếu một đường dẫn chiếm gần hết thì tìm vòng lặp ở giao diện (đã gặp: gọi Server Action trong lúc render, sửa ngày 19/11/2026). Đừng thăm dò bằng vòng lặp gọi `dev-login` |
| Web báo "X is not a function" dù mã đã có | `next dev` trên ổ ngoài bỏ sót thay đổi tệp | `kill -TERM -- -$(cat data/dev-run/web.pid)`, xóa `web.pid`, `scripts/dev-up.sh start` |
| Worker không nhận việc, `/health` không trả lời | worker thoát vì kẹt (mã 75) hoặc bị giết | `supervise.sh` tự chạy lại sau 5 giây (giãn dần tới 60); xem `data/dev-run/worker.log`, `kill -USR1 <pid>` ghi ngăn xếp các luồng |
| `dev-up.sh start` báo cổng 9108 đang bị giữ | worker cũ chưa thoát | `scripts/dev-up.sh stop` rồi `start` |
| Hộp tiếp nhận báo **"Máy AI tạm thời không trả lời"**, nhật ký worker có `engine_down` | máy Ollama tắt, Tailscale ngắt, Ollama chỉ nghe localhost, hoặc thiếu mô hình trên máy đó (lỗi ghi rõ ở trang vận hành) | Kiểm `curl http://<IP>:11434/api/version` và `/api/tags`; trên máy AI đặt `OLLAMA_HOST=0.0.0.0`; không cần làm gì với PDF: tự đọc tiếp khi máy AI trả lời (`engine_back` trong nhật ký) |
| Hộp tiếp nhận báo **"Bộ đọc PDF đang không hoạt động"** | không worker nào báo trạng thái trong 2 phút: worker đã dừng hoặc chưa chạy | `scripts/dev-up.sh status`; chạy lại bằng `scripts/dev-up.sh start` (máy thật: dịch vụ launchd/systemd) |
| Cả API, worker, web cùng chết, nhật ký không có dòng tắt êm | bộ chạy được khởi động từ một phiên Claude Code; phiên đó kết thúc thì các tiến trình con bị giết theo, dù đã tách phiên | Xóa `data/dev-run/{api,web,worker}.pid` còn sót rồi chạy `scripts/dev-up.sh start` **từ terminal của mình** |
| Tải PDF báo trùng (409) | cùng nội dung SHA-256 đã có | Mở giấy tờ cũ mà API trả kèm; muốn thay bản quét dùng "Thay bản quét" (có lý do) |
| Máy hết RAM, swap đầy | chạy cùng lúc mô hình MLX, build và E2E | Dùng hồ sơ `ollama` hoặc `fake`; không chạy benchmark LLM cùng worker |
| Test .NET báo không kết nối được PostgreSQL | thiếu `HOSO_TEST_PG` | `HOSO_TEST_PG="Host=127.0.0.1;Port=5432;Username=<bạn>"` |
| E2E "strict mode violation" ngay sau `goto` | trang có `loading.tsx` nên lúc vừa tải còn một bản ẩn của nội dung | Khoanh locator vào `#noi-dung` hoặc dùng `.filter({ visible: true })` |

## 6. Chưa có (cần làm trước khi triển khai thật)

OPS-01 (Dockerfile), OPS-02 (`docker-compose.prod.yml`, Caddy, TLS nội bộ, bí mật ngoài repo), OPS-05 và LOG-01, LOG-02, LOG-07 (giám sát, GlitchTip, cảnh báo), SEC-01 (Keycloak, MFA), AI-19 (cài worker như dịch vụ trên máy AI). Khi có, mục này cần thêm: khởi động và dừng theo dịch vụ, cập nhật phiên bản, xoay khóa, quy trình sự cố. Trạng thái từng việc: [docs/04](04-ke-hoach-task.md) mục "Trạng thái thực tế".
