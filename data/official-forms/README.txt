DANH MỤC HỒ SƠ, GIẤY TỜ VÀ THỦ TỤC CẤP PHƯỜNG
Địa bàn đối chiếu: phường Từ Liêm, thành phố Hà Nội
Ngày lấy dữ liệu: 12–13/11/2026 (Asia/Ho_Chi_Minh)

MỞ DANH MỤC
- Trên máy đang chạy dịch vụ: http://127.0.0.1:8765/official-forms/
- Ngoại tuyến: mở index.html trong thư mục đã giải nén.
- Excel: Danh-muc-ho-so-thu-tuc-phuong-Tu-Liem.xlsx.
- Giữ nguyên cấu trúc thư mục của gói ZIP để liên kết từ Excel/HTML đến bản mềm hoạt động.

PHẠM VI VÀ KẾT QUẢ
1. Đủ 425 dòng, STT 1–425, theo phụ lục Thông báo 87/TB-TTPVHCC ngày
   27/4/2026 của Trung tâm Phục vụ hành chính công thành phố Hà Nội.
   Giữ nguyên mã, tên, cơ quan, cấp thực hiện, ủy quyền, hạn ủy quyền và trang nguồn.
2. Từ danh sách công khai trên Cổng DVC Quốc gia, lấy 733 thủ tục có cấp thực
   hiện COMMUNE, không phải thủ tục nội bộ, do bộ/ngành hoặc cơ quan Hà Nội công bố.
   Đây là danh sách đối chiếu cấp xã; không tự coi tất cả là thẩm quyền giải quyết
   của UBND phường Từ Liêm. Trong số này có 705 mục bộ/ngành và 28 mục Hà Nội.
3. Gộp hai nguồn theo ID DVC: 861 mục, trong đó có chi tiết cho 774 mục.
   Có 5.596 mục thành phần hồ sơ/hướng dẫn. Một mục nguồn có thể là điều kiện
   hoặc lời hướng dẫn, không nhất thiết là một giấy tờ phải nộp riêng.
4. Đã tải 1.085 tệp mẫu giấy, gồm 768 mã băm nội dung khác nhau;
   774 PDF hướng dẫn thủ tục; 28 cấu hình biểu mẫu điện tử JSON.
   Các bản sao cùng nội dung vẫn giữ theo nguồn để truy vết.
5. Có thêm 34 tệp/gói nguồn từ văn bản ban hành, gồm Word hộ tịch năm 2024,
   tài liệu công khai hộ tịch năm 2026, bộ biểu mẫu hộ kinh doanh hợp nhất
   tháng 8/2026, quy trình Hà Nội, PDF trích mẫu và các quyết định thay thế/bãi bỏ. Phiên bản và lưu ý nằm trong sheet
   "Bo mau nguon ban hanh". Không dùng gói cũ để mặc định kết luận mẫu hiện hành.

NHỮNG MỤC CHƯA ĐỦ CĂN CỨ
- Trong 425 mục Hà Nội, 338 mục tra được chi tiết: 334 theo mã và 4 mục
  không ghi mã được đối chiếu theo tên trùng khớp với bản công bố của cơ quan Hà Nội.
  87 mục chưa có chi tiết theo mã: 32 đã có quyết định thay thế/bãi bỏ để đối chiếu,
  còn 55 mục chưa làm rõ nguyên nhân. Giữ nguyên mã nguồn, ghi riêng mã tìm thấy.
  Các mã khác chỉ trùng tên được giữ là ứng viên, chưa khẳng định mã thay thế.
- 2 tệp đính kèm công khai trả về rỗng:
  + Mẫu số 02.docx, thủ tục 1.003702.
  + Mu05.docx, thủ tục 2.002770.
  Đã có bản PDF trích nguyên trang cho cả hai mẫu, gắn vào từng mục:
  + Mẫu số 02: trang 79 Công báo 857 + 858 ngày 28/7/2023, có sửa đổi NĐ 104/2022.
  + Mẫu số 05: trang 27 PDF NĐ 66/2025/NĐ-CP.
  Bản trích được kiểm tra kết xuất giống hệt trang nguồn; tệp Word gốc vẫn ghi lỗi tải.
  Xem sheet "Ban PDF trich tu nguon" và template-alternatives.json.
- 746 thủ tục không cung cấp cấu hình form điện tử qua điểm tra cứu công khai.
  Điều này không có nghĩa các thủ tục không có mẫu giấy.
- Không có tệp đính kèm không đồng nghĩa không cần giấy tờ: giấy tờ tùy thân,
  giấy chứng nhận, chứng cứ, bản sao, bản vẽ... có thể do người nộp cung cấp.
- Ngày tải không phải ngày xác nhận hiệu lực toàn bộ danh mục. Các lỗi đánh máy
  trong nguồn và nội dung khác giữa danh mục tháng 4 và DVC được giữ để đối chiếu.

TỆP VÀ THƯ MỤC
- templates/: tệp mẫu giấy nguyên bản từ các mục đính kèm công khai.
- procedure-pdf/: PDF chi tiết do chức năng xuất PDF trên DVC cung cấp.
- electronic-forms/: JSON cấu hình biểu mẫu điện tử, không phải bản giấy.
- originals/: các bộ tài liệu nguồn; chỉ những tệp liệt kê trong source-bundles.json
  được đưa vào gói ZIP này.
- lifecycle.json và sheet "Thay the va bai bo": 32 mục có quyết định thay thế/bãi bỏ,
  kèm trang PDF và mã mới liên quan; không dùng mẫu cũ của các mục này làm mẫu hiện hành.
- template-alternatives.json: 2 PDF mẫu trích nguyên trang, trang và tệp nguồn.
- files.json: URL/điểm tải, tham số, tên gốc, thời điểm, kích thước, SHA-256,
  liên kết đến thủ tục và thành phần hồ sơ tương ứng.
- library.json: dữ liệu phục vụ bảng tra cứu, có nguồn và các mục chưa đủ.
- reconciliation.json: kết quả tìm lại 91 mục theo tên.
- coverage.json, validation.json: số liệu phạm vi và kiểm tra tính toàn vẹn.
- missing-files.csv và các sheet "Can doi chieu", "Doi chieu ten va ma":
  danh sách cần xử lý tiếp.

KIỂM TRA ĐÃ CHẠY
- Đủ và không trùng STT 1–425 của danh mục gốc.
- Đối chiếu kích thước và SHA-256 của 1.887 tệp tải được.
- Kiểm tra gói Word/OpenXML, chữ ký tệp Office cũ, JSON; mở và kết xuất
  trang đầu của tất cả PDF tải được. Không phát hiện tệp hỏng.
- Dữ liệu và giấy tờ được lấy từ nguồn công khai; chưa tạo dữ liệu giả ở giai đoạn này.

NGUỒN CHÍNH
- Công bố danh mục 425 thủ tục Hà Nội:
  https://donganh.hanoi.gov.vn/thu-tuc-hanh-chinh/thong-bao-cong-khai-danh-muc-thu-tuc-hanh-chinh-thuoc-tham-quyen-giai-quyet-cua-ubnd-cap-xa-tren-dia-ban-thanh-pho-ha-noi-2834260520183115549.htm
- Cổng Dịch vụ công Quốc gia:
  https://dichvucong.gov.vn/thu-tuc-hanh-chinh
  Mỗi bản ghi trong Excel/HTML có liên kết chi tiết riêng.

TÁI LẬP TRONG PROJECT
Môi trường: /Volumes/quocDisk/AI/document-samples/venv/bin/python
Thứ tự script: collect-official-procedures.py → collect-current-ward-procedures.py
→ download-official-procedure-files.py → extract-official-template-alternatives.py
→ audit-procedure-lifecycle.py → build-procedure-library.py
→ verify-procedure-library.py → package-procedure-library.py. Các phản hồi nguồn được lưu để truy vết.
