# Hồ sơ số UBND

Project số hóa, tiếp nhận, đối chiếu và quản lý hồ sơ hành chính, gồm API .NET,
giao diện Next.js, worker AI và các công cụ chuẩn bị dữ liệu biểu mẫu tiếng Việt.

## Thành phần

| Thư mục | Nội dung |
|---|---|
| [backend/](backend/README.md) | API ASP.NET Core, phân quyền, quy trình hồ sơ và kiểm thử |
| [frontend/](frontend/README.md) | Giao diện Next.js và hướng dẫn chạy với API hoặc dữ liệu giả lập |
| [ai-worker/](ai-worker/README.md) | Worker xử lý tài liệu và công cụ huấn luyện, đánh giá |
| [document_ai/](document_ai/README.md) | Hướng dẫn xử lý và trích xuất tài liệu |
| [sam3_service/](sam3_service/README.md) | Dịch vụ phục vụ bản thí điểm |
| [database/](database/) | SQL cài đặt và dữ liệu danh mục |
| [scripts/](scripts/) | Thu thập, chuẩn hóa và chuẩn bị bộ mẫu |
| [docs/](docs/README.md) | Thiết kế kiến trúc, cơ sở dữ liệu, bảo mật và kế hoạch công việc |

## Chạy khi phát triển

Làm theo [hướng dẫn backend](backend/README.md) để cấu hình PostgreSQL, migration
và API; làm theo [hướng dẫn frontend](frontend/README.md) để chạy giao diện.
Các tệp `.env.example` cung cấp cấu hình mẫu; cấu hình riêng và bí mật được giữ
ngoài Git.

## Dữ liệu

Repository lưu dữ liệu danh mục, schema, blueprint và bộ mẫu nhỏ tại
[data/citizen-samples/](data/citizen-samples/README.md).

Các bộ PDF sinh hàng loạt, gói ZIP, tài liệu nguồn dung lượng lớn, kho blob,
kết quả chạy và bản sao lưu CSDL được giữ ở máy theo [.gitignore](.gitignore).
Một số manifest và danh mục tham chiếu tới các tệp này; cần chuẩn bị dữ liệu
tương ứng trước khi chạy công cụ nhập, sinh hoặc đánh giá toàn bộ bộ dữ liệu.
Xem hướng dẫn từng bộ dữ liệu và các script trong `scripts/` cùng
`skills/vietnamese-form-dataset/`.
