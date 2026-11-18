# Migration SQL

DbUp chạy các tệp `*.sql` trong thư mục này theo thứ tự tên, mỗi tệp một transaction, ghi lịch sử vào `public.hoso_schema_versions`.

| Tệp | Nội dung | Ghi chú |
|---|---|---|
| `000` | Tạo schema `hoso` | |
| `001`–`003` | Baseline: bảng gốc, danh mục (38 nhóm, 427 loại, 2.624 trường), 19 văn bản công khai | Chép từ `database/` ở gốc dự án, bỏ lệnh riêng của psql |
| `004`, `007` | Dữ liệu mẫu GIẢ LẬP | Tên `*_optional.sql`; không chạy ở Production |
| `008` | `unaccent`, `pg_trgm`, `f_unaccent`/`f_fold`, mã lỗi nghiệp vụ `HS001…HS006` | |
| `009` | Danh mục mở rộng: tên cơ quan theo thời kỳ, ngừng dùng thay cho xóa, thành phần bắt buộc, trường quan trọng, quy tắc bảo quản (xác nhận cần người xác nhận + căn cứ pháp lý) | |
| `010` | Ủy quyền, cấp quyền xem hồ sơ hạn chế, nhật ký truy cập (phân vùng theo tháng), quyền mới | |
| `011` | Thủ tục hành chính: thủ tục, thành phần, loại giấy tờ, biểu mẫu, sự kiện vòng đời | Nạp bằng `scripts/import_procedures.py` |
| `012` | Lô quét, ảnh từng trang, lỗi chất lượng, chống nạp trùng SHA-256 | |
| `013` | Hàng đợi AI: `ocr_jobs` mở rộng, `ocr_pages`, `ai_suggestions`, `ai_models`, thu hồi job treo | Giao kèo với `ai-worker/` |
| `014` | Tách văn bản, liên kết văn bản, kết quả kiểm tra chữ ký | |
| `015` | Ba quy trình, phân công nhiều người, cấp mã hồ sơ | |
| `016` | Kho bản giấy: cây vị trí (kho › phòng › tủ › kệ › hộp, trigger kiểm cấp và cơ quan), lịch sử chuyển vị trí bất biến, mượn trả (chỉ mục duy nhất: một khoản hiệu lực mỗi hồ sơ) | |
| `017` | Nộp lưu theo đợt, gói xuất, đề nghị hủy (chỉ một đề nghị mở mỗi hồ sơ; hủy cần văn bản quyết định), `files.disposed_at` | |
| `018` | Thông báo, outbox, cấu hình, sao lưu, trigger audit mở rộng | |
| `019` | `scope_matches` (ủy quyền, hồ sơ hạn chế), `transition_dossier` (mã lỗi, phiên bản), `assign_dossier`, `my_queue` | |
| `020` | Role CSDL tối thiểu quyền: `hoso_api`, `hoso_ai_worker`, `hoso_readonly`, `hoso_migrator` | Role tạo `NOLOGIN`; đặt mật khẩu ngoài repo |
| `021` | Người dùng quản trị phát triển `dev_admin` và các phân công theo phân quyền | `*_optional`; không chạy ở Production |
| `022` | Trigger audit cho bảng `users` | |
| `023` | Bảng thủ tục ↔ biểu mẫu | |
| `024` | Gói xuất: nhịp sống của việc đang chạy, thông báo tiến độ (`export_progress`), `requeue_stale_exports()` | |
| `025` | Chỉ mục trigram cho số ký hiệu (tra cứu gần đúng) | |
| `026` | `transition_dossier` chặn (HS004) khi thiếu thành phần bắt buộc của thủ tục, do cài đặt `dossier.enforce_procedure_components` (mặc định tắt) | |
| `027` | `auth_sessions`: phiên đăng nhập phía máy chủ (cookie chỉ chứa khóa; thu hồi ngay khi đăng xuất, khóa tài khoản, quản trị buộc đăng xuất) | |
| `028` | Gán kiểu `date` cho các trường ngày của danh mục (trước đó cả 2.624 trường đều `text`) | |
| `029` | Phạm vi theo ĐÚNG phân công đang chọn: `assignment_scope`, `scope_matches(user, dossier, mã phân công)`, `transition_dossier`, `assign_dossier`, `my_queue` nhận mã phân công thay cho vai trò | Xóa các hàm cũ nhận vai trò |
| `030` | Gói xuất ghi phân công đã tạo, trạng thái `revoked`, hàm `revoke_exports` | |
| `031` | `access_events.assignment`: phân công đã dùng khi xem/tải/xuất | |
| `032` | Khay nền và ưu tiên hàng đợi AI: `ocr_jobs.prioritized_at/prioritized_by/preempted_count`, chỉ mục theo thứ tự lấy việc, trigger báo khi đổi mức, `requeue_stale_jobs` không tính lần nhường chỗ | BE-97, AI-15 |
| `033` | Dòng `classifier` của `ai_models` ghi Qwen3-1.7B (kèm lý do và cách quay lại) | AI-14 |
| `036` | Dòng `classifier` của `ai_models` ghi Qwen3-4B-Instruct-2507 IFStruct (thay 1.7B; worker nạp bản MLX 4-bit tự chuyển) | |
| `037` | `error_events`: Mã lỗi người dùng nhận → mã tương quan, request, người (quản trị tra ở `/admin/errors`); giữ 90 ngày | BE-117 |
| `038` | Chỉ mục sắp danh sách hồ sơ theo tên và hạn nội bộ (20.000 hồ sơ: ~350 ms → vài ms) | BE-111 |

Số thứ tự giữ nguyên theo `docs/03-thiet-ke-csdl.md` mục 15; `005`, `006` không dùng (dành cho bản gốc ngoài thư mục này).

- Không sửa tệp đã chạy ở bất kỳ môi trường nào; thay đổi tiếp theo là tệp mới. Tệp đã chạy trên máy nào (kể cả CSDL phát triển `hoso_dev`) xem ở bảng `public.hoso_schema_versions`; chưa có môi trường thật nào, nên tệp chưa chạy ở đâu thì còn sửa tại chỗ được.
- `tests/verify_after_020.sql`: bản của `database/006_verify.sql` bắt mã lỗi `HS00x` thay cho `P0001`; chạy trong `MigrationTests`.

Chạy: `dotnet run --project src/HoSoSo.Api -- migrate [--dry-run] [--baseline 000,001,…]` (dùng `ConnectionStrings:HoSoMigrator`).
