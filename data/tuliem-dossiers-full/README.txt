BỘ DỮ LIỆU GIẢ ĐẦY ĐỦ GIẤY TỜ - 425 x 2 = 850 BỘ

ĐÃ NẠP VÀO BACKEND LOCAL (16/11/2026)
hoso_dev: 850 hồ sơ TEST-TL-*, 3560 giấy tờ thành phần và 850 PDF gộp tham chiếu.
Origin demo, trạng thái nháp/chờ đối chiếu; nhóm tiếp nhận U27. Các thủ tục lịch sử giữ mã nguồn
trong ghi chú, không gán thành thủ tục hiện hành. Chưa chạy OCR, đáp án JSON vẫn giữ riêng.
Script chạy lại không tạo trùng: backend/scripts/import_synthetic_dossiers.py --apply.
Hướng dẫn, số liệu kiểm chứng và cách chọn phân công để xem: backend/README.md.

425 mục trong danh mục cấp xã Hà Nội ngày 27/4/2026, mỗi mục đúng 2 bộ giả.
850 PDF gộp thực tế; 3560 file giấy tờ, 4228 trang.
Trong đó 404 biểu mẫu nguồn đã điền được giữ nguyên; 3156 giấy tờ tự dựng có nhãn GIẢ LẬP.
Không còn bộ chỉ có checklist. Mỗi thành phần được chọn đều trỏ tới PDF đã điền.

Mỗi bộ có profile.json dùng chung, checklist.json, packet.json, ho-so-test.pdf,
PDF riêng từng giấy tờ và đáp án JSON gồm giá trị, vai trò, số trang, tọa độ.
Tên, số định danh, địa chỉ và mã tham chiếu nhất quán giữa các giấy tờ.
Hai bản dùng profile khác nhau, font Patrick Hand / Mali mô phỏng chữ viết tay.
Hướng dẫn và nhánh không chọn vẫn hiển thị; không ghép các nhánh loại trừ nhau.
Số lượng bản chính/bản sao theo nguồn được giữ trong checklist; một mẫu PDF đại diện cho loại giấy tờ.

PHẠM VI NGUỒN
338 thủ tục có mô tả thành phần nguồn;
87 mục chưa có mô tả nguồn dùng danh sách giấy tờ giả định công khai.
64 bộ thuộc mã đã thay đổi chỉ là mô phỏng lịch sử.
Đủ dữ liệu giả theo checklist kiểm thử không đồng nghĩa đủ điều kiện nộp hành chính.
Không sửa kho nguồn data/tuliem-dossiers hoặc biến giấy tờ tự dựng thành bản cấp chính thức.

MỞ VÀ TẢI
index.html: tìm theo mã, tên thủ tục, giấy tờ; xem hai bản và tải ZIP từng thủ tục.
tuliem-dossiers-full.zip: toàn bộ dữ liệu, giải nén vào thư mục data/ của dự án.
downloads/<mã>.zip: hai bộ, đường dẫn trong packet.json tương đối với bo-01/bo-02.
Chỉ đưa PDF vào OCR; đáp án JSON được giữ riêng để đánh giá, không nạp vào mô hình.
verification.json: kết quả kiểm tra toàn bộ 850 bộ và mỗi thành phần giấy tờ.

TÁI TẠO
/Volumes/quocDisk/AI/document-samples/venv/bin/python skills/vietnamese-form-dataset/scripts/build_complete_dossiers.py --root . --copies 2 --phase all --resume
