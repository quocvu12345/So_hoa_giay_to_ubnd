# Tài liệu thiết kế Hồ sơ số

| Tệp | Nội dung |
|---|---|
| [01-tong-quan-du-an.md](01-tong-quan-du-an.md) | Hiện trạng repo, vai trò, luồng nghiệp vụ, nguyên tắc dữ liệu, khoảng trống |
| [02-kien-truc-server.md](02-kien-truc-server.md) | Quyết định kiến trúc (ADR-01…12), sơ đồ C4, solution .NET, module, sequence, danh sách API |
| [03-thiet-ke-csdl.md](03-thiet-ke-csdl.md) | 60 bảng trong 10 nhóm, class diagram, view, hàm, chỉ mục, thứ tự migration |
| [04-ke-hoach-task.md](04-ke-hoach-task.md) | 171 task trong 10 giai đoạn, phụ thuộc, ước lượng, mốc M1–M5 |
| [05-bao-mat.md](05-bao-mat.md) | Phương án bảo mật: căn cứ, phân loại dữ liệu, ranh giới tin cậy, STRIDE, biện pháp theo lớp, ứng phó sự cố |
| [06-log-va-giam-sat.md](06-log-va-giam-sat.md) | Ghi log, báo lỗi (GlitchTip), mã tương quan, cảnh báo, bảng theo dõi |
| [07-khung-giao-dien.md](07-khung-giao-dien.md) | Bản đồ 36 đường dẫn trang, bố cục, thành phần dùng chung, quy tắc tương tác |
| [tasks/backend.md](tasks/backend.md) | Từng task backend: trạng thái khung, tệp, các bước, cách kiểm tra |
| [tasks/frontend.md](tasks/frontend.md) | Từng task frontend Next.js: trạng thái khung, tệp, các bước, cách kiểm tra |
| [tasks/ai.md](tasks/ai.md) | Worker AI: phương án tốc độ trên Mac M4 16 GB, mức ưu tiên và khay nền, task AI-12 trở đi |
| [tasks/kiem-thu-nhap-vai.md](tasks/kiem-thu-nhap-vai.md) | Kiểm thử nhập vai (QA-08): từng loại người dùng làm việc của mình trên giao diện thật, ghi phát hiện |

Mã nguồn mới:
- [backend/](../backend/): .NET 10, khung đã viết, chưa build;
- [frontend/](../frontend/): Next.js 16, khung đã build và chạy thử.

Mã thí điểm cũ (`*.html`, `assets/`, `sam3_service/`) giữ nguyên tới giai đoạn P7.
