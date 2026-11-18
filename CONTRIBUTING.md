# Đóng góp mã (P0-05)

Dự án: backend .NET (`backend/`), frontend Next.js (`frontend/`), worker AI Python (`ai-worker/`, `document_ai/`), CSDL PostgreSQL (`backend/database/migrations`).
Kế hoạch và trạng thái từng task: [docs/04-ke-hoach-task.md](docs/04-ke-hoach-task.md) và [docs/tasks/](docs/tasks/).

## Nhánh và commit

- Một task, một nhánh: `feat/BE-31-upload-file`, `fix/FE-23-doi-chieu-ngay`, `docs/AI-21-vung-nguon`. Mã task lấy từ docs/04.
- Commit nhỏ, mô tả **việc đã làm** (không chỉ "fix"). Dòng đầu nên có mã task: `FE-27: chọn thủ tục khi tạo hồ sơ`.
- Không commit dữ liệu thật, mật khẩu, `.env`, mô hình AI (`data/`, `*.dump`, `ai-worker/.env` đã nằm ngoài git). Không dán nội dung giấy tờ hay số định danh cá nhân vào mã, test, log, issue.
- Phần AI được xuất thành repo riêng `hoso-ai`: sửa ở đây rồi chạy `scripts/export-ai-repo.sh`, **không** sửa trực tiếp ở repo kia.

## Trước khi mở PR: định nghĩa hoàn thành

Theo [docs/04 mục 0](docs/04-ke-hoach-task.md). Tóm tắt, những gì CI (`.github/workflows/ci.yml`) và máy bạn phải xanh:

| Phần | Lệnh | Ghi chú |
|---|---|---|
| Frontend | `cd frontend && npm run typecheck && npm run lint && npm test` | Lint có luật an toàn riêng (SEC-04, `eslint-rules/hoso.mjs`): cấm `dangerouslySetInnerHTML`, `eval`, import mô-đun máy chủ vào tệp `"use client"`, Server Action không qua `runAction`/kiểm phiên |
| Frontend E2E giả lập | `cd frontend && npx playwright test` | Không cần API; tự dựng web ở cổng 3100 |
| Backend | `cd backend && CI=true dotnet build HoSoSo.slnx && HOSO_TEST_PG="Host=127.0.0.1;Port=5432;Username=<bạn>" dotnet test --solution HoSoSo.slnx` | Cảnh báo là lỗi. Test tự tạo và xóa CSDL `hoso_tpl_*`, `hoso_test_*` trên PostgreSQL. 15 test kho S3 báo "bỏ qua" nếu không có máy chủ S3 cục bộ |
| Worker AI | `cd ai-worker && PYTHONPATH=src:.. python -m pytest -q` | Dùng AI giả, không cần mô hình. Phải là Python có pytest: trên máy dev là venv AI `/Volumes/quocDisk/AI/paddleocr/venv/bin/python` (`python3` trong thư mục `backend` trỏ vào `backend/.venv`, không có pytest). 152 đạt, 22 bỏ qua (test CSDL cần cấu hình) |
| E2E tích hợp | `scripts/dev-up.sh start`, rồi `cd frontend && E2E_MODE=integration npx playwright test` | Cần cả stack (API, worker, web, CSDL dev). Xem [docs/08-so-tay-van-hanh.md](docs/08-so-tay-van-hanh.md) |

Mỗi thay đổi hành vi có test đi kèm. Endpoint mới: có ít nhất một ca **ngoài phạm vi** (403/404), có trong OpenAPI (`backend/scripts/export-openapi.sh` rồi `npm run gen:api` ở frontend) và trong ma trận quyền (`docs/ma-tran-quyen.md` do `PermissionMatrixTests` sinh ra; test đỏ nếu quên cập nhật). Màn hình mới: dùng được bằng bàn phím, đúng ở 1280px và 768px, có trạng thái đang tải, rỗng, lỗi.

## Quy ước

- **Ngôn ngữ:** chữ hiển thị cho người dùng, tài liệu, thông báo lỗi và bình luận trong mã bằng tiếng Việt, nói rõ sai gì và cách sửa. Tên mã (biến, hàm, tệp component) bằng tiếng Anh; đường dẫn giao diện tiếng Việt không dấu (`routes.*`).
- **Quyền và phạm vi:** quyền thật do API kiểm tra. Mọi truy vấn danh sách đi qua `IScopeFilter`; không trả entity EF trực tiếp. Giao diện chỉ ẩn nút cho gọn.
- **Dữ liệu và nhật ký:** không ghi nội dung giấy tờ vào log. Nhật ký truy cập và thay đổi bất biến (không sửa/xóa).
- **Giả lập:** dữ liệu giả chỉ hiện khi `HOSO_MOCK=1`; chạy API thật mà chưa nối màn nào thì hiện `NeedsRealApi`, không bao giờ hiện dữ liệu giả cho người dùng thật.

## Migration CSDL

- Tệp mới `backend/database/migrations/NNN_ten.sql`, đánh số tiếp theo, mỗi tệp một transaction, **chạy lại không lỗi** và chạy được cả trên CSDL đã có dữ liệu. Thêm một dòng vào bảng ở `backend/database/migrations/README.md`.
- Máy dev: **chỉ dùng `backend/scripts/migrate-hoso-dev.sh`** (mặc định chỉ liệt kê; `--apply` mới chạy). Không chạy `dotnet ... migrate` trần: ở Development nó nạp cả các tệp `*_optional.sql` (dữ liệu mẫu). Sao lưu trước: `pg_dump -Fc -n hoso -n public hoso_dev > data/db-backups/hoso_dev-truoc-NNN-$(date +%Y%m%d-%H%M%S).dump`.
- Đổi cấu trúc mà API đang chạy: sau khi áp migration phải khởi động lại API (`scripts/dev-up.sh restart`).

## Gặp sự cố khi chạy cục bộ

Xem mục "Sự cố thường gặp" của [docs/08-so-tay-van-hanh.md](docs/08-so-tay-van-hanh.md).
