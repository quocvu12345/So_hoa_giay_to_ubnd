SQL + SEED THỰC TẾ CHO HỒ SƠ SỐ UBND / HĐND PHƯỜNG TỪ LIÊM
PostgreSQL 16 trở lên · Rà soát nguồn ngày 11/11/2026

1. Có gì trong bộ dữ liệu

- 19 văn bản công khai có thật của Từ Liêm: 5 văn bản UBND, 14 nghị quyết HĐND.
- 20 tệp nguồn trong manifest: 19 PDF và 1 XLSX phụ lục; đã tải kiểm tra và tính SHA-256.
- Kèm sẵn 3 PDF trong samples/ để thử đọc bản quét. Các tệp còn lại tải bằng script.
- 11 đầu mối, 38 nhóm công việc, 427 mục loại giấy tờ và các trường dữ liệu lấy từ
  danh mục giao diện hiện có. Đây là DANH MỤC ĐỀ XUẤT, không phải danh mục hồ sơ
  đã được phường phê duyệt. Một hồ sơ không bắt buộc có đủ mọi loại giấy tờ.
- Bộ giả lập riêng: 8 bộ hồ sơ, 24 giấy tờ, tài khoản demo và phân vai để thử SQL.
  Không dùng tên cán bộ thật, mật khẩu mặc định hoặc dữ liệu hồ sơ cá nhân.

Đây là bộ seed được tuyển chọn từ văn bản công khai, không phải bản sao CSDL nội bộ
của UBND/HĐND. Mã public-001... là mã nhập liệu của dự án, không phải mã hồ sơ cơ quan.
URL và thông tin nguồn nằm trong data/public_documents.json và bảng hoso.sources.
Không khẳng định đây là dữ liệu mở có giấy phép tái sử dụng riêng.

2. Chạy SQL

Chạy từ thư mục gốc project, với PostgreSQL của bạn đã hoạt động:

  createdb hoso_dev
  psql -X -v ON_ERROR_STOP=1 -d hoso_dev -f database/install.sql

install.sql tạo schema hoso, các bảng/hàm/view và nạp danh mục + văn bản công khai.
Không tạo tài khoản ứng dụng hoặc hồ sơ giả lập trong bước này.
Chạy lại install.sql không xóa dữ liệu và không ghi đè hàng đã có.
File install.sql dùng lệnh \ir của psql; GUI SQL có thể chạy từng file 001, 002, 003
sau khi tạo schema hoso. Ưu tiên psql để quản lý migration và transaction đúng thứ tự.

Nạp thêm dữ liệu kiểm thử, nếu cần:

  psql -X -v ON_ERROR_STOP=1 -d hoso_dev -f database/004_seed_demo_optional.sql
  psql -X -v ON_ERROR_STOP=1 -d hoso_dev -f database/005_example_queries.sql

Kiểm tra tính toàn vẹn trên database dành cho phát triển đã nạp demo:

  psql -X -v ON_ERROR_STOP=1 -d hoso_dev -f database/006_verify.sql

Bài kiểm tra chạy trong transaction và ROLLBACK, không giữ các thay đổi kiểm thử.
Script tạo CSDL tạm để kiểm thử tự động không sửa database PostgreSQL sẵn có trên máy.

  python3 database/scripts/test_database.py

Đã chạy thành công với PostgreSQL 16.13: cài mới, nạp lặp hai bộ seed, ràng buộc
dữ liệu, phạm vi vai trò, chuyển bước, truy vấn mẫu và rollback bài kiểm thử.

3. Tệp dữ liệu và cách cập nhật

  data/public_documents.json       Metadata thực tế đã tuyển chọn, kèm ghi nhận nguồn.
  data/file_manifest.json          URL, kích thước, hash và số trang tệp gốc.
  data/excluded_sources.json       Liên kết bị loại vì nội dung không khớp.
  data/counts.json                 Số lượng chính xác do script tạo.
  001_schema.sql                  Cấu trúc, ràng buộc, chỉ mục, view, hàm chuyển bước.
  002_seed_catalog.sql            Danh mục, vai trò, quyền, trạng thái và luật chuyển bước.
  003_seed_public_documents.sql   Văn bản thật và bằng chứng nguồn.
  004_seed_demo_optional.sql      Người dùng và hồ sơ GIẢ LẬP, tách khỏi seed thật.
  005_example_queries.sql         Truy vấn theo vai trò, danh mục, OCR và lịch sử.
  006_verify.sql                 Kiểm thử dữ liệu, ràng buộc và bàn giao nghiệp vụ.

Tạo lại SQL sau khi sửa JSON/danh mục JS:

  python3 database/scripts/build_seeds.py
  python3 database/scripts/build_seeds.py --check

Các script chỉ cần Python 3, không cần pip hoặc Node.js.
SQL sinh tự động dùng ON CONFLICT DO NOTHING: cập nhật JSON rồi chạy seed không
ghi đè dữ liệu người dùng đã sửa. Muốn thay dữ liệu đang chạy, viết migration UPDATE
có điều kiện hoặc nhập vào CSDL phát triển mới để đối chiếu.

Kiểm tra 3 PDF đã kèm trong project:

  python3 database/scripts/fetch_sources.py --verify-included

Tải một tài liệu hoặc toàn bộ tệp theo manifest:

  python3 database/scripts/fetch_sources.py --key public-016
  python3 database/scripts/fetch_sources.py

Mặc định lưu ở database/downloads/. Script xác minh kích thước + SHA-256 và không
ghi đè tệp có nội dung khác. Nếu bên phát hành thay tệp, script báo lỗi để kiểm tra
lại nguồn; không tự đổi hash. local_path là đường dẫn tương đối với database/.
Tải về thư mục downloads không tự cập nhật local_path hay storage_key trong SQL.

4. Những trường hợp nguồn cần lưu ý

- public-019, kế hoạch 26/KH-UBND: trang đăng ghi ngày 26/01/2026, phần đầu PDF ghi
  20/01/2026. issued_on = NULL; giữ cả hai ngày trong source_observations và đánh dấu
  needs_review. Không coi giá trị OCR hoặc ngày đăng bài là ngày ban hành đã xác nhận.
- public-001, kế hoạch 446/KH-UBND: số/ngày lấy theo bảng metadata; phần đầu tệp PDF
  để trống số/ngày. metadata_status = registry_verified, không phải header_checked.
- public-017, quyết định 1360/QĐ-UBND: ngày ban hành 29/12/2025 đối chiếu trên PDF;
  ngày đăng bài là 31/12/2025. Lưu ở hai trường riêng.
- public-015 có nghị quyết 01/NQ-HĐND ngày 23/03/2026 và phụ lục XLSX riêng.
- Không gộp văn bản chỉ vì trùng số: 15, 16, 17/NQ-HĐND xuất hiện ở cả 2025 và 2026.
- Trạng thái header_checked chỉ nói đã xem phần đầu PDF. Chưa kiểm chứng chữ ký số,
  toàn bộ nội dung, tình trạng hiệu lực pháp lý hoặc tính đầy đủ của một hồ sơ.
- Nhóm công việc gợi ý trong document_classifications luôn đánh dấu proposed đối
  với văn bản thật. Không suy ra đơn vị chủ trì, người được giao hoặc vị trí bản giấy.

5. Mô hình dữ liệu

organizations -> department_scopes -> work_groups -> document_types -> field_definitions
users -> user_roles -> roles -> role_permissions
sources -> documents -> files -> ocr_jobs
documents -> document_field_values
dossiers -> dossier_documents -> documents
dossiers -> workflow_events; thay đổi bảng quan trọng -> audit_events

Một văn bản có thể liên kết nhiều bộ hồ sơ với vai trò thành phần hoặc tài liệu
tham chiếu. Hướng đến/đi/nội bộ nằm ở liên kết với hồ sơ, không phải loại giấy tờ.
Mỗi thành phần tệp có component_key và phiên bản riêng; phụ lục XLSX không bị coi
là bản sửa của PDF nghị quyết. Các phiên bản có hash và có thể lưu URI object storage. Không nhét
file nhị phân hoặc base64 vào SQL. Không tạo kết quả OCR hoặc độ tin cậy giả cho tài
liệu công khai. OCR thật lưu job/model, trường, trang/vùng nguồn và người đối chiếu.
Không tự đặt thời hạn bảo quản; chỉ lưu tham chiếu quy định khi đơn vị xác nhận.

6. Phân vai và chuyển bước

Vai trò trong SQL khớp UI: employee, clerk, manager, chair, council; thêm
technical_admin để tách vận hành kỹ thuật khỏi thẩm quyền xử lý hồ sơ.
Phân công có phạm vi tổ chức/đơn vị và thời hạn. Chuyên viên chỉ có hồ sơ được giao;
trưởng phòng/Ban theo đơn vị; Chủ tịch UBND và lãnh đạo HĐND theo khối riêng.
Văn thư/lưu trữ được cấp theo từng tổ chức; không mặc định thấy toàn bộ hai khối.

Luồng đề xuất cho gói số hóa:
draft/returned -> department_review -> [leadership_review nếu cần] -> ready_archive -> archived
Hồ sơ Thường trực/Tổ đại biểu HĐND có nhánh trình trực tiếp lãnh đạo HĐND.

Hàm transition_dossier kiểm tra vai trò, phạm vi, bước hiện tại, giấy tờ đã đối chiếu,
ý kiến bắt buộc khi trả/trình và ghi lịch sử trong cùng transaction có khóa hàng.
Đây là kiểm tra gói hồ sơ số, không thay ký văn bản, phê duyệt chuyên môn hoặc biểu quyết.
Ví dụ thao tác trên bộ giả lập:

  SELECT hoso.transition_dossier(
    (SELECT id FROM hoso.dossiers WHERE code='DEMO-2026-0002'),
    (SELECT id FROM hoso.users WHERE username='demo_head_kt'),
    'manager', 'accept', 'Đã kiểm tra bộ hồ sơ giả lập.');

7. Phạm vi bàn giao

Đã có schema + seed + truy vấn + kiểm thử SQL. Giao diện HTML hiện vẫn dùng
localStorage; CHƯA có API nối giao diện vào PostgreSQL.

scope_matches và transition_dossier là helper cho backend tin cậy, KHÔNG phải
đăng nhập hay hàng rào phân quyền hoàn chỉnh. API phải xác thực người dùng, ràng
buộc actor vào tài khoản đăng nhập và áp dụng phạm vi cho mọi đọc/tải/xuất/sửa.
Chưa bật Row Level Security, chưa cung cấp kết nối SQL trực tiếp cho trình duyệt.
Người có quyền sửa bảng trực tiếp có thể vượt luồng helper. Chủ sở hữu database vẫn
có quyền quản trị log; trigger append-only không phải cơ chế lưu vết chống can thiệp.

Khi triển khai thật cần migration và API cho phân công, phiên bản, kiểm tra nội dung,
ký số, nộp lưu, quyền tài liệu hạn chế và tích hợp hệ thống cơ quan. Việc đổi nhóm hồ
sơ không được tự xóa giấy tờ đã gắn; cần đối chiếu lại phân loại và ghi lịch sử.

BỘ TEST HỒ SƠ CÔNG DÂN (12/11/2026)

Đã bổ sung 8 loại giấy tờ và các trường đất đai/thừa kế/xe. Bộ test tùy chọn có
12 PDF / 38 trang, 3 hồ sơ demo; không nằm trong seed công khai 003.
Xem data/citizen-samples/README.md từ gốc project. Nạp bằng:
  psql -X -v ON_ERROR_STOP=1 -d hoso_dev -f database/007_seed_citizen_samples_optional.sql
  SELECT * FROM hoso.v_citizen_samples;
006_verify.sql dành cho bộ cơ sở + 004 trước khi nạp 007; test_database.py kiểm tra
cả hai giai đoạn và tính lặp lại của 007.
