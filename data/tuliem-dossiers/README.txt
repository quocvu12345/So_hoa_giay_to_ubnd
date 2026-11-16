Bộ hồ sơ test cấp phường Từ Liêm

Mốc kiểm kê: 425 mục theo danh mục cấp xã Hà Nội ngày 27/4/2026; không gọi là toàn bộ thủ tục còn hiệu lực ngày hôm nay.
Đã lập 850 kịch bản/checklist, 2 bản cho mỗi mục thủ tục.
Trong đó 332 bộ có PDF đã điền, phủ 166 thủ tục; 518 bộ chỉ có profile/checklist hoặc mã cũ được giữ để đối chiếu.
Có 406 file giấy tờ được điền lại từ 1074 trang nguồn; không lấy các PDF có người khai khác nhau để ghép thành một hồ sơ.

Mỗi bộ gồm profile.json dùng chung, checklist.json, packet.json, giấy tờ đã điền, đáp án từng ô và PDF gộp nếu có giấy tờ thực tế.
Phần giấy tờ chỉ xuất trình, giấy tờ có điều kiện, mẫu điện tử, hướng dẫn và phần cơ quan lập được phân loại riêng.
Giấy tờ chưa có bản mềm hoặc bản sao/căn cước/giấy tờ đã cấp chưa được cung cấp được ghi thiếu; không tính là đã đủ hồ sơ.
Không biến required=false trong API thành khẳng định rằng giấy tờ luôn tùy chọn. Tất cả hồ sơ là dữ liệu test, chưa xác nhận đủ điều kiện nộp hành chính.
Schema suy luận tự động còn cần duyệt ngữ nghĩa; các vị trí không đọc rõ/không đủ chỗ ghi được giữ trống với lý do trong đáp án.
Chữ điền là font Patrick Hand và Mali mô phỏng viết tay.

Tải từng thủ tục tại downloads/<id>.zip hoặc toàn bộ tại tuliem-dossiers.zip. ZIP từng thủ tục dùng đường dẫn tương đối trong bo-01/packet.json và bo-02/packet.json. Bản PDF nguồn trong metadata là tham chiếu kho mẫu, không nằm trong ZIP từng thủ tục.
Nếu dùng ZIP toàn bộ với project này, giải nén vào thư mục data/ để giữ đúng đường dẫn data/tuliem-dossiers trong manifest. Chỉ đưa ho-so-test.pdf vào OCR; đáp án/profile dùng để chấm riêng.
