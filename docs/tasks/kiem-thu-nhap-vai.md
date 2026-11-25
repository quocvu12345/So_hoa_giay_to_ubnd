# Task chi tiết · Kiểm thử nhập vai (QA-08)

Claude tự đóng vai từng loại người dùng của Hồ sơ số: đăng nhập bằng đúng tài khoản thử của vai đó, dùng **giao diện web thật** để làm việc của người đó từ đầu đến cuối như một cán bộ phường. Mọi chỗ hỏng, chặn sai, lộ dữ liệu ngoài phạm vi hoặc khó hiểu đều được ghi lại.

Khác với các lớp kiểm thử đã có:

| Lớp | Cách chạy | Bắt được |
|---|---|---|
| QA-01 `PermissionEnforcementTests` | gọi từng endpoint API bằng 6 vai | API chặn đúng quyền |
| QA-02 `scripts/smoke-nghiep-vu.py` | gọi API theo luồng, đúng người ở từng bước | luồng nghiệp vụ thông ở máy chủ |
| E2E Playwright (`frontend/e2e`, 34 tích hợp + 7 giả lập) | kịch bản cố định cho từng màn | hồi quy của từng màn |
| **QA-08 nhập vai (tệp này)** | bấm, gõ trên giao diện theo mục tiêu công việc của từng người, cả đường sai | lỗi nằm giữa các màn, nút hiện sai theo vai, chữ khó hiểu, dữ liệu lọt phạm vi trên giao diện, việc không làm xong được |

**Trạng thái:** ✅ đã chạy và ghi phát hiện · 🟡 chạy dở · ⬜ chưa chạy. Trạng thái chỉ cho biết đã thử hay chưa; chức năng đạt hay không xem ở mục **Phát hiện**.

## Cách làm chung

**Chuẩn bị (làm một lần ở NV-00):**
- Bộ dev chạy đủ API, worker, web. Người dùng tự chạy `scripts/dev-up.sh start` trong Terminal của mình, vì tiến trình do Claude khởi động sẽ chết theo phiên. Claude chỉ kiểm `scripts/dev-up.sh status` và ghi AI đang dùng (`ollama` hay `fake`) vào nhật ký lượt chạy.
- Tài khoản thử: `backend/scripts/seed-dev-accounts.sh` (chỉ liệt kê), thiếu thì `--apply`.
- Sao lưu CSDL trước mỗi đợt: `pg_dump -h 127.0.0.1 -U quoc -Fc -n hoso -n public hoso_dev > data/db-backups/hoso_dev-truoc-nhap-vai-$(date +%Y%m%d-%H%M%S).dump`.

**Công cụ:** dùng Playwright Chromium có sẵn trong `frontend/` (`@playwright/test`, `@axe-core/playwright`). Kịch bản nhập vai là tệp tạm nằm ngoài repo, không thêm vào `frontend/e2e`. Ca nào đáng giữ làm kiểm thử hồi quy thì NV-13 đề xuất thành E2E.
- Đăng nhập bằng `GET /api/v1/auth/dev-login?username=<tài khoản>&returnUrl=/` trong ngữ cảnh trình duyệt của người đó. Mỗi người một `BrowserContext` riêng, nên chạy song song được nhiều người (người trình và người duyệt mở cùng lúc).
- Thao tác **bằng giao diện**: bấm nút, gõ phím, chọn tệp, dùng Tab và Enter như người thật. Chỉ gọi API trực tiếp khi cố ý thử con đường người dùng không có (NV-10) hoặc để đọc kết quả kiểm chứng.
- Mỗi bước chụp ảnh vào `artifacts/nhap-vai/<ngày>/<NV-xx>/<số bước>-<tên>.png` (thư mục `artifacts/` đã nằm trong `.gitignore`). Đồng thời ghi lỗi console, phản hồi 4xx/5xx bất ngờ và số yêu cầu theo đường dẫn, để bắt các vòng lặp gọi API như lỗi 3.000 yêu cầu/phút ngày 19/11/2026.
- Chờ theo phần tử hoặc chữ trên trang, không dùng `networkidle` vì luồng SSE luôn mở. Nội dung trang khoanh trong `#noi-dung` để tránh bản ẩn lúc `loading.tsx` (xem docs/08 mục 5).

**Dữ liệu thử:**
- Tên hồ sơ, lô và kho bắt đầu bằng `NHẬP VAI <mã lượt>`, mã vị trí bắt đầu bằng `NV-<mã lượt>`, để lọc và dọn được.
- Không sửa, không xóa dữ liệu mà lượt thử không tạo ra. Cài đặt hệ thống sửa xong phải trả lại giá trị cũ. Danh mục chỉ thao tác trên nhóm thử có mã `NV…`.
- Dữ liệu giao diện không dựng được thì dựng bằng SQL như `frontend/e2e/de-nghi-huy.spec.ts`, và ghi rõ trong nhật ký lượt chạy. Ví dụ: hồ sơ đã lưu trữ đủ năm để đề nghị hủy, thông báo gửi cho chính người thao tác.

**Ở mỗi màn đi qua, xét 6 điều:**
1. Dữ liệu đúng phạm vi của người đang dùng: không thiếu, không lọt dữ liệu của đơn vị khác.
2. Nút hiện hoặc ẩn đúng quyền. Nút bị khóa có lý do ngay cạnh.
3. Có trạng thái đang tải, rỗng, lỗi. Lỗi có **Mã lỗi** và nút sao chép.
4. Dùng được bằng bàn phím. Không cuộn ngang ở 768px.
5. Chữ viết từ góc nhìn cán bộ, không lộ thuật ngữ kỹ thuật (`409`, `null`, tên trường API, chuỗi tiếng Anh).
6. Làm xong một việc thì những chỗ liên quan (hàng việc, số trên menu, chuông, nhật ký) tự cập nhật, không phải tải lại trang.

**Ghi kết quả:**
- Mỗi lượt chạy thêm một dòng vào **Nhật ký lượt chạy**. Mỗi lỗi ghi vào mục **Phát hiện** với mã `NV-xx.n`, kèm mức, bước tái hiện, kết quả mong đợi, kết quả thực tế, ảnh và Mã lỗi (nếu có).
- **Không sửa mã trong lúc nhập vai.** Việc sửa thành task FE/BE riêng, làm sau khi người dùng xem danh sách (NV-13).
- Mức:
  - **Chặn:** không làm xong được việc của vai;
  - **Nặng:** sai dữ liệu, lộ dữ liệu ngoài phạm vi, hoặc giao diện cho bấm việc trái quyền (dù API chặn);
  - **Vừa:** làm được nhưng sai hoặc thiếu phản hồi, phải tải lại mới thấy;
  - **Nhẹ:** chữ, bố cục, bàn phím;
  - **Góp ý:** không sai nhưng cán bộ dễ vấp.

## Nhân vật

Tài khoản thử của `backend/scripts/seed-dev-accounts.sh`, cơ quan là UBND hoặc HĐND phường Từ Liêm. Quyền của từng vai xem `docs/ma-tran-quyen.md`.

| Vai | Tài khoản | Đơn vị | Việc trong một ngày |
|---|---|---|---|
| Chuyên viên | `demo_cv_ht` | Phòng Hạ tầng - Nông nghiệp và Môi trường | nạp bản quét, đối chiếu, lập hồ sơ, trình |
| Chuyên viên thứ hai | `demo_cv_ht_02` | Phòng Hạ tầng | nhận hồ sơ được giao, làm tiếp |
| Chuyên viên phòng khác | `demo_cv_kt` | Phòng Kinh tế | số hóa hồ sơ đã kết thúc (luồng A); đối chứng phạm vi |
| Trưởng phòng | `demo_head_ht` | Phòng Hạ tầng | giao việc, kiểm tra, trả lại, trình lãnh đạo, xuất gói |
| Trưởng phòng khác | `demo_head_kt` | Phòng Kinh tế | kiểm tra luồng A; đối chứng phạm vi |
| Văn thư UBND | `demo_clerk_ubnd` | UBND | lô quét, lỗi ảnh, kho, nộp lưu, mượn trả, đề nghị hủy |
| Chủ tịch UBND | `demo_chair` | UBND | xem tổng hợp, cho ý kiến hoặc trả lại, phê duyệt hủy |
| Chuyên viên Ban HĐND | `demo_cv_bkt` | Ban Kinh tế - Ngân sách | chuẩn bị hồ sơ thẩm tra |
| Chuyên viên Thường trực HĐND | `demo_cv_tt` | Thường trực HĐND | hồ sơ đi thẳng tới lãnh đạo HĐND |
| Trưởng Ban HĐND | `demo_head_bkt` | Ban Kinh tế - Ngân sách | kiểm tra, trình lãnh đạo HĐND |
| Lãnh đạo HĐND | `demo_council` | HĐND | xem theo ba lối vào, cho ý kiến |
| Văn thư HĐND | `demo_clerk_hdnd` | HĐND | lưu trữ hồ sơ HĐND |
| Quản trị kỹ thuật | `demo_admin` | toàn hệ thống | người dùng, phân công, ủy quyền, danh mục, vận hành, nhật ký |
| Người kiêm nhiệm | `dev_admin` | 18 phân công | đổi vai trong ngày |
| Người lạ | (chưa đăng nhập) | | chỉ được thấy trang đăng nhập |

## Tổng quan task

| ID | Vai | Nội dung | Ngày | Trạng thái |
|---|---|---|---|---|
| NV-00 | | Chuẩn bị đợt, khung kịch bản | 0,25 | ✅ |
| NV-01 | Chuyên viên | Nạp PDF, hộp tiếp nhận, đối chiếu, tách văn bản, xếp hồ sơ | 0,75 | 🟡 |
| NV-02 | Chuyên viên | Lập, sửa, trình hồ sơ; tra cứu, thủ tục, mượn, thông báo | 0,5 | ✅ |
| NV-03 | Trưởng phòng | Giao việc, kiểm tra, trả lại, trình lãnh đạo, xuất dữ liệu | 0,5 | 🟡 |
| NV-04 | Văn thư UBND | Lô quét, lỗi ảnh, kho, nộp lưu, mượn trả, đề nghị hủy | 0,75 | ✅ |
| NV-05 | Chủ tịch UBND | Tổng hợp, cho ý kiến, phê duyệt hủy | 0,25 | ✅ |
| NV-06 | Khối HĐND | Luồng C từ chuyên viên Ban tới văn thư HĐND | 0,5 | 🟡 |
| NV-07 | Quản trị kỹ thuật | Người dùng, ủy quyền, danh mục, vận hành, nhật ký | 0,5 | ✅ |
| NV-08 | Người kiêm nhiệm, người lạ | Đổi vai, phiên, đăng xuất, Đi nhanh | 0,25 | ⬜ |
| NV-09 | Nhiều người cùng lúc | Ba luồng trọn vẹn, cập nhật trực tiếp, thao tác trùng | 0,5 | ⬜ |
| NV-10 | Người tò mò | Mở địa chỉ và liên kết ngoài quyền, ngoài phạm vi | 0,5 | ⬜ |
| NV-11 | Người ít quen máy | Chỉ bàn phím, màn hẹp, trình đọc màn hình, chữ | 0,5 | ⬜ |
| NV-12 | Ngày xấu | Máy AI tắt, mạng chập chờn, tệp hỏng, hết phiên | 0,5 | ⬜ |
| NV-13 | | Tổng hợp, phân loại, đề xuất task sửa | 0,25 | ⬜ |

**Thứ tự chạy:** NV-00 → NV-01 → NV-02 → NV-03 → NV-05 → NV-04 (văn thư nhận các hồ sơ mà NV-01…03 và NV-05 đã đẩy tới bước nộp lưu) → NV-06 → NV-07 → NV-08 → NV-09 → NV-10 → NV-11 → NV-12 → NV-13. NV-10 và NV-11 cần hồ sơ ở nhiều bước khác nhau nên chạy sau các vai. Đề nghị hủy ở NV-04 cần quy tắc bảo quản đã xác nhận (NV-07 bước 4) và Chủ tịch duyệt (NV-05 bước 4): chạy phần đó sau cùng trong NV-04.

---

## NV-00 · Chuẩn bị đợt nhập vai ✅ · 0,25 ngày
- **Làm:**
  1. `scripts/dev-up.sh status`: API, web, worker đều trả lời; ghi AI đang dùng. Thiếu phần nào thì nhờ người dùng chạy, không tự `start`.
  2. Tài khoản thử đủ 26 người; `dev_admin` còn 18 phân công.
  3. Sao lưu CSDL.
  4. Bộ PDF:
     - `data/citizen-samples/pdf/` (12 tệp: có lớp chữ, chữ tay giả lập, `citizen-mixed-packet.pdf` gồm nhiều văn bản để tách);
     - `data/filled-samples/pdf/` (các tệp E2E đang dùng);
     - tệp xấu tự dựng: ảnh đổi đuôi `.pdf`, tệp rỗng, PDF hỏng giữa chừng, PDF có mật khẩu, PDF ≥ 100 trang, tệp > 200 MB (dựng dạng tệp thưa, không giữ lại).
     Mỗi tệp thêm một dòng riêng ở cuối như `samplePdf()` trong `frontend/e2e/fixtures.ts` để không bị chặn tải trùng, trừ ca cố ý thử trùng.
  5. Khung kịch bản:
     - `as(tài khoản)` mở ngữ cảnh đã đăng nhập;
     - `shot(tên)` chụp ảnh theo quy ước thư mục;
     - bộ nghe lỗi console, phản hồi ≥ 400 và số yêu cầu theo đường dẫn;
     - ghi kết quả từng bước ra JSON để NV-13 tổng hợp.
  6. Chạy thử: mỗi nhân vật mở `/viec-cua-toi` và chụp ảnh; menu khớp `config/navigation.ts` theo quyền của vai.
- **Xong khi:** 15 nhân vật vào được trang đầu (người lạ bị đưa về `/dang-nhap`), có ảnh, không lỗi console.

## NV-01 · Chuyên viên: nạp và đối chiếu bản quét 🟡 · 0,75 ngày
- **Vai:** `demo_cv_ht`.
- **Mục tiêu:** "Sáng nay tôi nhận năm bộ giấy tờ của dân. Tôi cần đưa lên máy, kiểm lại chữ máy đọc và xếp vào đúng hồ sơ."
- **Kịch bản:**
  1. **Việc của tôi:** hàng mặc định là "Cần bạn làm"; số trên menu khớp số trên trang.
  2. **Nạp PDF** (`/tiep-nhan/tai-len`):
     - kéo thả 5 tệp cùng lúc: thấy tiến độ từng tệp, 3 tệp tải song song;
     - hủy một tệp đang tải;
     - tải xong thấy vị trí trong khay, rồi "Đang đọc trang a/b", rồi "Đã đọc xong", tự đổi không cần tải lại.
  3. **Hộp tiếp nhận:**
     - ba thẻ Chờ xếp / Đã xếp / Đã bỏ;
     - lọc theo tình trạng đọc (số trên nút khớp danh sách), nhóm, loại giấy tờ, lô;
     - bộ lọc nằm trên địa chỉ: sao chép sang thẻ mới vẫn đúng bộ lọc;
     - "Tải thêm".
  4. **AI:**
     - "Trích xuất ngay" ở PDF cuối khay: chuyển sang "Ưu tiên" và được đọc xong trước các PDF khác;
     - "Hủy đọc" một PDF đang chờ;
     - "Trích xuất lại" một PDF đã đọc xong.
  5. **Đối chiếu:**
     - bấm từng trường thì ảnh nhảy tới đúng trang và có khung vùng nguồn; phóng to thì khung vẫn đúng chỗ;
     - trường cần chú ý nằm đầu danh sách; sửa giá trị thì ô "đã kiểm" tự bật;
     - nhập ngày `31/02/2026` thì báo lỗi ngay tại ô;
     - đổi loại giấy tờ thì bộ trường đổi theo;
     - "Đọc lại trang này";
     - điền "Thông tin đầu văn bản";
     - `Ctrl+Enter` xác nhận và sang bước Xếp hồ sơ.
  6. **Nháp:**
     - sửa vài ô rồi tải lại trang: nháp được khôi phục;
     - bấm một liên kết rời trang khi còn thay đổi: có hộp thoại hỏi.
  7. **Tách văn bản** với `citizen-mixed-packet.pdf`:
     - điểm tách AI gợi ý đã có sẵn;
     - thêm điểm tách, "Gộp lại", "Bỏ hết điểm tách";
     - đặt tên từng phần, xác nhận: văn bản con vào hộp tiếp nhận, văn bản nguồn thành "đã tách";
     - mở lại văn bản nguồn thấy "đã được tách", không phải "Không tìm thấy".
  8. **Xếp hồ sơ:**
     - có hồ sơ gợi ý; tìm được hồ sơ khác theo mã hoặc tên;
     - hồ sơ không còn nhận giấy tờ hiện mờ kèm lý do;
     - tạo hồ sơ mới ngay trong hộp thoại: chọn thủ tục, chỉ thấy nhóm của phòng mình;
     - chọn chiều đến/đi/nội bộ; gán thành phần thủ tục;
     - "Lưu và mở PDF tiếp theo" ba lần liên tiếp (E2E chưa có ca này).
  9. **Chọn nhiều** ở hộp tiếp nhận: "Chọn tất cả"; xếp 2 PDF vào một hồ sơ; bỏ 2 PDF rồi "Hoàn tác".
  10. **Chi tiết giấy tờ** (`/giay-to/{id}`):
      - phiên bản tệp, trường dữ liệu, "Trang N · chỉ vùng";
      - thêm và gỡ liên kết văn bản (phụ lục, thay thế, sửa đổi, trả lời, liên quan);
      - thay bản quét kèm lý do (lý do dưới 10 ký tự bị chặn);
      - kiểm tra chữ ký số.
- **Thử sai:**
  - tệp `.docx` đổi đuôi, tệp rỗng, tệp quá 200 MB: báo ngay tại tệp;
  - tải lại đúng một tệp đã có: báo trùng kèm liên kết tới giấy tờ cũ;
  - xác nhận đối chiếu khi còn trường chưa kiểm: bị chặn và chỉ ra trường nào;
  - xếp vào hồ sơ đã trình: không được, có lý do.
- **Không được thấy:**
  - nút In ở chi tiết giấy tờ (chuyên viên không có `document.print`);
  - menu Kho bản giấy, Nộp lưu, Xuất dữ liệu, Đề nghị hủy, Quản trị;
  - nút mở lô, đóng lô và đánh dấu lỗi ảnh ở Lô quét (chỉ được xem).
- **Xong khi:** 5 PDF đã đối chiếu và nằm trong hồ sơ, ít nhất một hồ sơ theo thủ tục và một hồ sơ thường; mọi bước có ảnh và kết quả.

## NV-02 · Chuyên viên: lập, sửa, trình hồ sơ và tra cứu ✅ · 0,5 ngày
- **Vai:** `demo_cv_ht`, dùng hồ sơ từ NV-01.
- **Mục tiêu:** "Hoàn thiện hồ sơ cho đủ rồi trình trưởng phòng; tra lại một văn bản cũ; mượn bản giấy để đối chiếu."
- **Kịch bản:**
  1. **Tạo hồ sơ** (`/ho-so/tao-moi`):
     - tên dưới 5 ký tự, hạn nội bộ trước hôm nay, ngày sai dạng: báo tại ô khi rời ô;
     - chọn thủ tục bằng cách gõ không dấu;
     - tạo xong mở thẳng tab Giấy tờ.
  2. **Tab Tổng quan:** danh sách kiểm tra nói rõ thiếu thành phần nào và vì sao chưa trình được; có thời hạn bảo quản, vị trí bản giấy.
  3. **Tab Giấy tờ:**
     - thêm giấy tờ từ hộp tiếp nhận và bằng ô "Hoặc tìm giấy tờ đã có";
     - đổi thứ tự bằng nút lên/xuống; gán thành phần;
     - bỏ một giấy tờ khỏi hồ sơ;
     - "Trích xuất ngay" cho cả hồ sơ.
  4. **Sửa hồ sơ:**
     - nhóm hồ sơ chỉ đọc;
     - mở hai thẻ cùng sửa: thẻ lưu sau báo "vừa được người khác sửa" và có nút Tải lại.
  5. **Trình:**
     - thanh thao tác chỉ bật "Trình" khi đủ điều kiện;
     - trình xong thì nút chuyển bước biến mất, hồ sơ chỉ còn xem;
     - nhật ký có dòng trình.
  6. **Danh sách hồ sơ:**
     - lọc theo từ khóa, trạng thái, nhóm, năm, "chỉ hồ sơ tôi chủ trì", "quá hạn"; sắp xếp theo cột; trang sau;
     - gửi liên kết có bộ lọc cho người khác: mở ra đúng bộ lọc;
     - "Xuất CSV" bị khóa kèm lý do.
  7. **Tra cứu:**
     - gõ không dấu ("to khai khai sinh");
     - lọc theo phạm vi, nhóm, hình thức, ngày ban hành, cơ quan ban hành;
     - đoạn trích có tô đậm; bấm kết quả mở đúng trang trúng;
     - "Trang sau →" và "← Về trang đầu" (E2E chưa có).
  8. **Thủ tục:**
     - tìm, lọc lĩnh vực, cấp thực hiện, hiệu lực;
     - chi tiết; tải mẫu biểu đúng tên tệp gốc;
     - "Tạo hồ sơ theo thủ tục này"; thủ tục đã bãi bỏ không cho tạo và nói rõ lý do.
  9. **Mượn trả:**
     - đề nghị mượn bản giấy một hồ sơ; mục đích dưới 5 ký tự bị chặn;
     - đề nghị trùng bị từ chối, có hạn trả của khoản đang mượn;
     - không có nút duyệt, giao.
  10. **Thông báo và Tài khoản:**
      - chuông; lọc "Chưa đọc"; bấm thông báo mở đúng nơi; "Đánh dấu tất cả đã đọc";
      - trang Tài khoản có các phân công và lịch sử đăng nhập.
- **Không được thấy:** tab Phân công; hồ sơ của Phòng Kinh tế trong danh sách và tra cứu.
- **Xong khi:** có ít nhất ba hồ sơ đã trình: một để NV-03 trả lại, một để NV-03 trình lãnh đạo, một để NV-03 giao chủ trì cho Chuyên viên 02.

## NV-03 · Trưởng phòng: giao việc, kiểm tra, trả lại, trình lãnh đạo 🟡 · 0,5 ngày
- **Vai:** `demo_head_ht`; đối chứng bằng `demo_head_kt`.
- **Mục tiêu:** "Đầu giờ xem phòng có gì chờ mình, giao việc cho anh em, kiểm từng bộ; bộ nào chưa đạt thì trả, bộ nào cần ý kiến Chủ tịch thì trình."
- **Kịch bản:**
  1. **Việc của tôi:**
     - hàng "Chờ bạn kiểm tra" lên đầu;
     - hồ sơ quá hạn có chip đỏ, sắp đến hạn có chip vàng;
     - đã có thông báo "có hồ sơ trình".
  2. **Tab Phân công:**
     - danh sách chuyên viên của phòng, kèm số hồ sơ đang giữ và số quá hạn;
     - gõ tên không dấu để lọc;
     - giao `demo_cv_ht_02` chủ trì, hạn 7 ngày (hạn trong quá khứ bị chặn);
     - "Xem hồ sơ" của một người mở danh sách lọc `?nguoi=`.
  3. **Đọc bộ giấy tờ:**
     - tab Giấy tờ chỉ xem: không có nút sửa, đổi thứ tự, bỏ;
     - chi tiết giấy tờ thấy trường đã đối chiếu và người đối chiếu, không sửa được trường;
     - không có nút In; tải xuống được.
  4. **Trả lại:** ý kiến dưới 10 ký tự thì nút Gửi bị khóa; trả lại kèm lý do thì hồ sơ về chuyên viên và nhật ký ghi lý do.
  5. **Đạt** (hoàn tất kiểm tra) hồ sơ thứ hai: hồ sơ sang "Chờ tiếp nhận nộp lưu".
  6. **Trình lãnh đạo** hồ sơ thứ ba kèm ý kiến: hồ sơ sang Chủ tịch.
  7. **Luồng A** (với `demo_head_kt`, hồ sơ của `demo_cv_kt`): không có nút trình lãnh đạo.
  8. **Xuất:**
     - "Xuất CSV" theo bộ lọc: mở bằng Excel đúng dấu tiếng Việt (có BOM);
     - Xuất dữ liệu: tạo gói theo điều kiện, tiến độ chạy trực tiếp, tải được ZIP, thấy mã băm;
     - thiếu điều kiện bị chặn; không hồ sơ nào khớp thì báo rõ.
  9. **Mượn trả:** đề nghị mượn được, không duyệt được.
- **Thử sai:** hồ sơ chuyên viên chưa trình không có nút kiểm tra; người của phòng khác không có trong danh sách giao.
- **Không được thấy:** menu Tiếp nhận PDF; nút Tạo hồ sơ, sửa hồ sơ, sửa trường; hồ sơ của Phòng Kinh tế.

## NV-04 · Văn thư UBND: lô quét, kho, nộp lưu, mượn trả, đề nghị hủy ✅ · 0,75 ngày
- **Vai:** `demo_clerk_ubnd`.
- **Mục tiêu:** "Nhận lô giấy các phòng giao để quét, kiểm ảnh, xếp bản giấy vào kho, nhận nộp lưu những bộ đã đạt, cho mượn và theo dõi trả, lập đề nghị hủy tài liệu hết hạn."
- **Kịch bản:**
  1. **Việc của tôi:** hàng "Chờ tiếp nhận nộp lưu" đứng đầu, rồi "Cần bạn làm".
  2. **Lô quét:**
     - mở lô: đơn vị giao, nhãn hộp, số tờ dự kiến;
     - "Nạp PDF vào lô" mở trang nạp đã chọn sẵn lô;
     - số trang quét ít hơn số tờ dự kiến thì có cảnh báo;
     - trang AI nghi ngờ: xác nhận **đạt** hoặc **cần quét lại**; ghi lỗi ảnh bằng tay;
     - thay bản quét (lý do 10–500 ký tự): lỗi ảnh của bản cũ tự đóng;
     - đóng lô còn lỗi phải ghi lý do từ 10 ký tự;
     - lọc lô đang mở / đã đóng.
  3. **Kho bản giấy:**
     - tạo cây Kho › Phòng › Tủ › Kệ › Hộp mã `NV-…`; chỉ chọn được cấp sâu hơn cấp cha;
     - sửa tên, ghi chú;
     - dán nội dung mã QR vào ô tìm: mở thẳng vị trí;
     - in nhãn QR cả nhánh ra PDF;
     - ngừng dùng một vị trí còn hồ sơ: bị chặn, có lý do.
  4. **Vị trí bản giấy của hồ sơ** (tab Tổng quan của hồ sơ chờ nộp lưu): đặt, chuyển, gỡ; lịch sử chuyển có ghi chú; số hồ sơ cộng dồn lên các cấp cha.
  5. **Nộp lưu:**
     - chọn nhiều hồ sơ chờ nộp lưu, ghi chú, tạo đợt; hồ sơ không hợp lệ được báo ngay dưới hồ sơ đó;
     - chi tiết đợt: nộp → tiếp nhận cả đợt (xác nhận hai bước) → tải biên bản PDF;
     - một đợt khác: trả lại kèm lý do;
     - xóa một đợt đang soạn;
     - đợt có một hồ sơ trống: tiếp nhận báo lỗi và không hồ sơ nào đổi trạng thái.
  6. **Chuyển bước:** trả lại hồ sơ luồng A về chuyên viên (lý do từ 10 ký tự); lưu trữ trực tiếp hồ sơ Chủ tịch đã cho ý kiến (NV-05).
  7. **Hồ sơ đã lưu trữ:** không còn nút sửa, thêm hay bỏ giấy tờ.
  8. **Mượn trả:**
     - thấy đề nghị của cả cơ quan;
     - duyệt (hạn mặc định 14 ngày; quá 90 ngày bị chặn) → giao → nhận trả kèm tình trạng;
     - từ chối phải ghi lý do.
  9. **Chi tiết giấy tờ:** nút In mở bản in ở thẻ mới (NV-07 kiểm dòng nhật ký `print`).
  10. **Hộp tiếp nhận và đối chiếu:** văn thư cũng có quyền nạp và sửa giấy tờ; chỉ lướt qua, không lặp lại NV-01.
  11. **Xuất dữ liệu:** tạo gói các hồ sơ đã lưu trữ trong một khoảng thời gian.
  12. **Đề nghị hủy** (chạy cuối, sau NV-07 bước 4 và cần dữ liệu dựng bằng SQL: hồ sơ thử đã lưu trữ đủ năm):
      - danh sách hồ sơ đủ điều kiện;
      - lập đề nghị, lý do từ 10 ký tự;
      - không thấy nút phê duyệt đề nghị của chính mình;
      - sau khi Chủ tịch duyệt (NV-05): thực hiện hủy qua hai bước xác nhận; kết quả nêu số tệp đã hủy, số giấy tờ giữ lại.
- **Không được thấy:** tab Phân công; nút Đạt, Trình lãnh đạo, Cho ý kiến; nút phê duyệt hủy; menu Quản trị; hồ sơ HĐND.

## NV-05 · Chủ tịch UBND: tổng hợp, cho ý kiến, phê duyệt hủy ✅ · 0,25 ngày
- **Vai:** `demo_chair`.
- **Mục tiêu:** "Xem các phòng đang thế nào, đọc những bộ được trình, cho ý kiến hoặc yêu cầu làm rõ; duyệt đề nghị hủy."
- **Kịch bản:**
  1. **Việc của tôi:** hàng "Chờ bạn cho ý kiến" và bảng tổng hợp theo phòng; số liệu khớp danh sách hồ sơ lọc theo phòng (`?phong=`).
  2. **Hồ sơ được trình** từ NV-03:
     - thấy ý kiến trình của trưởng phòng, bộ giấy tờ, trường đã đối chiếu, bản gốc;
     - In và tải xuống được.
  3. **Trả lại** kèm ý kiến từ 10 ký tự: hồ sơ về trưởng phòng. Trưởng phòng (NV-03) trình lại, rồi Chủ tịch **cho ý kiến hoàn tất**: hồ sơ sang "Chờ tiếp nhận nộp lưu".
  4. **Đề nghị hủy:**
     - phê duyệt một đề nghị kèm văn bản quyết định (tìm trong phạm vi; văn bản nằm trong chính hồ sơ bị hủy thì không được chọn);
     - từ chối một đề nghị khác kèm lý do.
  5. **Xuất dữ liệu:** tạo và tải được gói.
- **Không được thấy:**
  - menu Tiếp nhận PDF, Lô quét, Kho bản giấy, Nộp lưu; nút sửa trường;
  - hồ sơ HĐND, kể cả khi gõ thẳng địa chỉ;
  - nút chuyển bước ở hồ sơ chưa trình tới lãnh đạo (vẫn xem được).

## NV-06 · Khối HĐND: thẩm tra từ Ban tới lưu trữ 🟡 · 0,5 ngày
- **Vai lần lượt:** `demo_cv_bkt` → `demo_head_bkt` → `demo_council` → `demo_clerk_hdnd`. Đối chứng: `demo_chair`, `demo_clerk_ubnd`, `demo_cv_tt`.
- **Mục tiêu:** hồ sơ thẩm tra của Ban đi đúng đường HĐND và không lọt sang khối UBND.
- **Kịch bản:**
  1. **Chuyên viên Ban:**
     - nạp tờ trình và báo cáo thẩm tra, đối chiếu;
     - tạo hồ sơ: chỉ chọn được nhóm của Ban;
     - liên kết báo cáo thẩm tra với tờ trình ("trả lời" hoặc "liên quan");
     - trình.
  2. **Trưởng Ban:** kiểm tra, trả lại một lần, rồi trình lãnh đạo HĐND.
  3. **Lãnh đạo HĐND:** ba lối vào (kỳ họp và nghị quyết; thẩm tra; giám sát và kiến nghị) đếm đúng; cho ý kiến.
  4. **Văn thư HĐND:** lưu trữ; kho và đợt nộp lưu của HĐND tách khỏi UBND (không thấy kho, đợt của UBND).
  5. **Thường trực HĐND** (`demo_cv_tt`): theo thiết kế, hồ sơ đi thẳng tới lãnh đạo HĐND, không qua một "trưởng phòng HĐND". Đây là luồng đề xuất, chưa chắc đã làm: ghi lại giao diện thực tế xử lý ra sao.
- **Không được thấy:** Chủ tịch UBND và văn thư UBND không thấy hồ sơ HĐND ở danh sách, tra cứu, hàng việc, kể cả khi gõ thẳng địa chỉ.

## NV-07 · Quản trị kỹ thuật ✅ · 0,5 ngày
- **Vai:** `demo_admin`.
- **Mục tiêu:** "Cấp tài khoản cho cán bộ mới, phân công có thời hạn, ủy quyền khi trưởng phòng đi vắng, chỉnh danh mục, theo dõi máy AI và sao lưu, tra lỗi người dùng báo."
- **Kịch bản:**
  1. **Việc của tôi:** chỉ có lối vào vận hành; menu không có Hồ sơ, Tiếp nhận PDF, Tra cứu.
  2. **Người dùng:**
     - thêm người dùng tên đăng nhập `nv.<mã lượt>.…`;
     - phân công có thời hạn và căn cứ (căn cứ dưới 10 ký tự bị chặn); cơ quan, đơn vị đúng luật của từng vai;
     - lọc "sắp hết hạn": có chip vàng;
     - kết thúc phân công ngay;
     - khóa: người đó đang mở trình duyệt ở ngữ cảnh khác bị đăng xuất; mở khóa; buộc đăng xuất;
     - không khóa được chính mình.
  3. **Ủy quyền:**
     - trưởng phòng Hạ tầng ủy quyền `dossier.assign` cho Chuyên viên 02 trong một ngày;
     - quá 90 ngày bị chặn; chỉ chọn được quyền mà người ủy quyền thật sự có;
     - đăng nhập Chuyên viên 02: thấy thêm phân công ủy quyền và giao việc được;
     - thu hồi: phân công ủy quyền biến mất.
  4. **Danh mục** (nhóm thử mã `NV…`):
     - nhóm: thêm, sửa, xác nhận, ngừng dùng, xóa; nhóm đã có dữ liệu thì không xóa được và được gợi ý ngừng dùng;
     - loại giấy tờ, trường dữ liệu; biểu thức kiểm tra sai cú pháp bị chặn;
     - thời hạn bảo quản: đề xuất, rồi xác nhận kèm căn cứ (dùng cho NV-04 đề nghị hủy).
  5. **Vận hành:**
     - Máy AI: worker, nhịp tim, mô hình, cảnh báo lệch bảng ghi nhận;
     - Việc AI: hủy việc đang chờ của lượt thử, chạy lại việc lỗi;
     - Sao lưu: tình trạng, ghi tay một lần;
     - Cài đặt: sửa một giá trị rồi trả lại; JSON sai bị chặn.
  6. **Nhật ký hệ thống:**
     - tìm được lần In của NV-04, lần "Trích xuất ngay" của NV-01, các thay đổi hồ sơ của NV-03;
     - dán **Mã lỗi** thu được ở NV-12: ra đúng request và người.
- **Không được thấy:** nội dung hồ sơ, giấy tờ, bản quét. Gõ thẳng `/ho-so/{id}`, `/giay-to/{id}`: báo không có quyền và không lộ tên hồ sơ.

## NV-08 · Người kiêm nhiệm và người lạ ⬜ · 0,25 ngày
- **Vai:** `dev_admin` (18 phân công) và trình duyệt chưa đăng nhập.
- **Kịch bản:**
  1. **Người lạ** mở `/ho-so/<id>`: về `/dang-nhap?tiep=…`; đăng nhập xong quay lại đúng trang.
  2. **Đổi vai** ở ô Vai trò trên thanh trên, ở đầu menu khi màn hẹp, và ở trang Tài khoản:
     - menu, hàng việc, số đếm, dữ liệu đổi theo vai;
     - trang đang mở thuộc phạm vi vai cũ: tải lại thì có thông báo dễ hiểu.
  3. **Hai thẻ:** đổi vai ở thẻ này, thao tác ở thẻ kia. Cookie phân công dùng chung nên ghi lại hành vi thực tế.
  4. **Phân công hết hạn khi đang dùng** (NV-07 kết thúc phân công): có thông báo phiên (FE-46), không kẹt vòng đăng nhập.
  5. **Đăng xuất:** bấm Back không thấy lại dữ liệu cũ; luồng SSE đóng.
  6. **Đi nhanh** (Ctrl+K hoặc `/`): gõ không dấu tới được màn; chỉ hiện màn có quyền.

## NV-09 · Nhiều người làm cùng lúc ⬜ · 0,5 ngày
- **Vai:** mọi vai, mỗi người một ngữ cảnh trình duyệt mở song song.
- **Kịch bản:** chạy trọn các luồng trong `nghiep-vu-vai-tro.html` bằng giao diện (QA-02 chạy cùng các luồng này nhưng qua API):
  - **Luồng B:** chuyên viên trình → trưởng phòng giao Chuyên viên 02 → đạt → văn thư đặt vị trí kho, nộp lưu → chuyên viên mượn → văn thư duyệt, giao, nhận trả → trưởng phòng xuất gói.
  - **Trả bổ sung và trình lãnh đạo:** trưởng phòng trả lại → chuyên viên trình lại → trưởng phòng trình lãnh đạo → Chủ tịch trả lại → trưởng phòng trình lại → Chủ tịch cho ý kiến → văn thư lưu trữ.
  - **Luồng A** ở Phòng Kinh tế, văn thư trả lại một lần. Luồng C đã có ở NV-06, chỉ chạy lại nếu NV-06 có sửa.
- **Kiểm thêm:**
  - người nhận việc thấy chuông tăng và hồ sơ xuất hiện trong hàng việc **mà không tải lại**, trong vài giây (thông báo đi qua outbox);
  - hai người thao tác cùng lúc:
    - trưởng phòng bấm Đạt trong khi chuyên viên đang sửa giấy tờ;
    - hai thẻ văn thư cùng tiếp nhận một đợt: một bên báo hồ sơ đã đổi, không ghi hai lần;
  - người lập đang mở hồ sơ thì trưởng phòng giao chủ trì cho Chuyên viên 02: tải lại thấy gì (theo luật phạm vi, người lập không còn xem được);
  - đọc nhật ký hồ sơ ở cuối luồng: kể lại được toàn bộ câu chuyện (ai, bước nào, lúc nào, ý kiến gì).

## NV-10 · Người tò mò: phạm vi và quyền trên giao diện ⬜ · 0,5 ngày
- **Mục đích:** bổ sung cho QA-01 (kiểm ở API) bằng góc nhìn giao diện: người dùng thấy gì khi đi vào con đường không dành cho mình.
- **Kịch bản** (mỗi ca ghi vai, địa chỉ, thấy gì, có lộ tên, mã hay nội dung không):
  1. Mỗi vai gõ thẳng mọi đường dẫn trong `config/routes.ts` không có trong menu của mình: báo không có quyền rõ ràng, không lỗi 500, không lộ dữ liệu.
  2. Liên kết của **đơn vị khác** do người khác gửi: hồ sơ, giấy tờ, ảnh trang (`/api/v1/files/{id}/pages/1/preview`), tải tệp, biên bản nộp lưu, gói xuất. Mong đợi "Không tìm thấy", không phân biệt "có nhưng không cho xem".
  3. Tra cứu bằng số ký hiệu hoặc trích yếu có thật của phòng khác: không ra kết quả, con số đếm cũng không lộ.
  4. Các ô tìm ở Xếp hồ sơ, Thêm giấy tờ có sẵn, Liên kết văn bản, Mượn trả, Văn bản quyết định hủy: không gợi ý hồ sơ hay giấy tờ ngoài phạm vi.
  5. Thông báo cũ trỏ tới hồ sơ đã giao chủ trì cho người khác: mở ra có thông báo dễ hiểu.
  6. Tham số địa chỉ lạ: `?trang=-1`, `?tep=<id tệp của giấy tờ khác>`, `?vung=` hỏng, `?lo=` không tồn tại, `?tiep=https://ngoai.example` (không được chuyển ra trang ngoài).
  7. Nút bị ẩn thì API vẫn phải chặn: dùng phiên của vai mình gửi lại yêu cầu của vai khác (ví dụ chuyên viên gửi "accept"). Mong đợi bị từ chối, giao diện báo lỗi có Mã lỗi.
- **Mức:** bất kỳ dữ liệu ngoài phạm vi nào hiện ra trên giao diện đều tính **Nặng**.

## NV-11 · Người ít quen máy: bàn phím, màn hẹp, chữ ⬜ · 0,5 ngày
- **Vai:** chuyên viên (thao tác nhiều nhất) và Chủ tịch (thao tác ít nhất).
- **Kịch bản:**
  1. **Chỉ dùng bàn phím** làm hết NV-01 bước 5–8 và NV-05 bước 2–3:
     - Tab tới được mọi nút, tiêu điểm luôn nhìn thấy;
     - ↑ ↓ Enter trong danh sách (hộp tiếp nhận, hồ sơ, tra cứu, thông báo);
     - Esc đóng hộp thoại; liên kết bỏ qua menu hoạt động.
  2. **Khổ màn hình:**
     - 768px và 1024px ở mọi màn trong menu của mỗi vai: không cuộn ngang, nút không bị đẩy ra ngoài;
     - 390px (điện thoại): chỉ ghi Góp ý cho những màn không dùng được, không phải mục tiêu bắt buộc.
  3. **axe trên mọi màn con:** đối chiếu, xếp hồ sơ, tách văn bản, từng tab của hồ sơ, chi tiết giấy tờ, chi tiết lô, chi tiết đợt nộp lưu, chi tiết người dùng. QA-05 mới quét các màn trong menu.
  4. **Đọc lại mọi chữ** trên đường đi (thông báo lỗi, chú thích, nhãn nút): tìm câu tiếng Anh, mã kỹ thuật, câu khó hiểu, hoặc câu không nói người dùng phải làm gì tiếp.
  5. **Phóng to trình duyệt 200%:** vẫn dùng được.

## NV-12 · Ngày xấu: sự cố giữa lúc làm việc ⬜ · 0,5 ngày
- **Vai:** chuyên viên, văn thư, quản trị.
- **Kịch bản:**
  1. **Máy AI không trả lời.** **Hỏi người dùng trước** khi chuyển worker sang cổng chết (như lần thử 19/11/2026) hoặc nhờ người dùng tắt Ollama.
     - hộp tiếp nhận hiện băng báo dễ hiểu; PDF nằm ở "chờ đọc", không bị đánh lỗi;
     - máy AI trở lại thì tự đọc tiếp, băng báo tự tắt;
     - trang vận hành hiện lỗi cụ thể.
  2. **Mạng chập chờn** (Playwright `setOffline`):
     - giữa lúc tải PDF: thử lại được;
     - giữa lúc gửi xác nhận đối chiếu: không mất nháp;
     - luồng SSE đứt rồi nối lại: có băng kết nối, dữ liệu đồng bộ lại.
  3. **Tệp xấu** (bộ ở NV-00): hộp tiếp nhận báo gì; worker có bị kẹt không.
  4. **Hết phiên giữa thao tác** (xóa cookie phiên lúc đang đối chiếu): Server Action chuyển sang `/dang-nhap?tiep=`, đăng nhập lại quay về đúng chỗ, nháp còn nguyên.
  5. **Lỗi máy chủ:** gây một lỗi có Mã lỗi, bấm "Sao chép mã", chuyển cho NV-07 tra.
  6. **Bấm liên tiếp nhiều lần** một nút (Trình, Tiếp nhận đợt, Thực hiện hủy): việc không bị làm hai lần.
  7. Trong suốt NV-12, theo dõi `data/dev-run/api.log`: không đường dẫn nào bị gọi lặp bất thường, không có 429.

## NV-13 · Tổng hợp và đề xuất sửa ⬜ · 0,25 ngày
- **Làm:**
  1. Gom phát hiện từ NV-01…12, bỏ trùng, xếp theo mức.
  2. Với mỗi phát hiện mức Chặn, Nặng, Vừa: soạn task sửa (FE hoặc BE, đánh số tiếp theo số đang có). Chỉ ghi vào `docs/tasks/frontend.md` hoặc `backend.md` **sau khi người dùng đồng ý**.
  3. Ca đáng giữ làm hồi quy thì đề xuất E2E mới, ví dụ "Lưu và mở PDF tiếp theo" ba lần, phân trang tra cứu.
  4. Cập nhật trạng thái các NV ở tệp này và dòng QA-08 ở `docs/04-ke-hoach-task.md`.
  5. Dọn dữ liệu thử nếu người dùng muốn: liệt kê trước những gì sẽ xóa, hỏi rồi mới xóa.
- **Báo cáo ngắn:** số ca đã chạy theo vai, số phát hiện theo mức, năm việc nên sửa trước.

---

## Nhật ký lượt chạy

| Ngày | Task | AI | Mã lượt | Ghi chú (dữ liệu dựng bằng SQL, bước bỏ qua và lý do) |
|---|---|---|---|---|
| 19/11/2026 | NV-00 | `ollama` (IFStruct 4B, OCR PaddleOCR-VL) | `NVOZPY` | Sao lưu `data/db-backups/hoso_dev-truoc-nhap-vai-20261119-160143.dump`. 14 tài khoản + người lạ: menu khớp quyền ở cả 14, không lỗi console, không gọi lặp. Kịch bản ở `artifacts/nhap-vai/kich-ban/` (`lib.cjs` là khung, chạy bằng `NV_RUN=NVOZPY node nvXXx.cjs` từ thư mục đó; không nằm trong git), ảnh và `results.jsonl` ở `artifacts/nhap-vai/2026-11-19/` |
| 19/11/2026 | NV-01 (phần lớn) | `ollama` | `NVOZPY` | Đã chạy bước 2–9 và phần thử sai về tệp. Dữ liệu tạo: hồ sơ UBND-2026-000125, 000126 (`NHẬP VAI …`), 3 văn bản con của `NVOZPY-p5-…`. **Đạt:** tiến độ nạp, tệp rỗng/sai đuôi/ảnh đổi đuôi bị chặn tại tệp, tải trùng có liên kết giấy tờ cũ, Trích xuất ngay (lên "Ưu tiên · thứ 1"), Hủy đọc + Đọc lại, ba thẻ, lọc trên địa chỉ (mở thẻ mới giữ lọc), Bỏ + Hoàn tác, chọn tất cả (báo rõ PDF chưa đọc xong không xếp được), vùng nguồn nhảy đúng trang và đúng khung, ngày sai chặn Ctrl+Enter, nháp khôi phục sau tải lại, hỏi trước khi rời trang, đổi loại có bước "Áp dụng loại này", hộp thoại tạo hồ sơ chỉ cho nhóm của phòng (gợi ý nhóm U27 của đơn vị khác thì để "Chọn nhóm…"), tên dưới 5 ký tự bị chặn, "Lưu và mở PDF tiếp theo" mở đúng PDF đã đọc xong kế tiếp, tách 3 phần. **Chưa chạy:** bước 10 (chi tiết giấy tờ), gán thành phần thủ tục, "Lưu và mở PDF tiếp theo" ba lần liên tiếp, mục "Không được thấy" |
| 19/11/2026 | NV-01 (tiếp) | `ollama` | `NVOZPY` | Bước 10: không có nút In (đúng), liên kết văn bản thêm/gỡ được, thay bản quét (lý do dưới 10 ký tự bị chặn, bản cũ giữ "phiên bản 1", bản mới "Bản thay thế · Hiện hành" kèm lý do), Lô quét chỉ xem. "Lưu và mở PDF tiếp theo" ba lần liên tiếp chạy đúng (làm ở NV-02). Còn thiếu: kiểm tra chữ ký số (không có PDF ký số mẫu) |
| 19/11/2026 | NV-02 | `ollama` | `NVOZPY` | Tạo UBND-2026-000127 theo thủ tục 1.116442; trình 125, 126, 127 (để NV-03 dùng). **Đạt:** luật form tạo hồ sơ (tên, hạn quá khứ, năm sai, chưa chọn nhóm) báo khi rời ô; gán thành phần khi xếp; đổi thứ tự lên/xuống; gỡ giấy tờ; sửa ở hai thẻ thì thẻ sau báo "vừa được người khác sửa"; nhóm chỉ đọc ở màn sửa; trình xong khóa sửa; lọc danh sách theo từ khóa, trạng thái, "của tôi", quá hạn, năm, sắp xếp theo hạn (chưa có hạn ở cuối); không thấy hồ sơ Phòng Kinh tế; thủ tục: tìm không dấu, chi tiết, tải mẫu (JSON biểu mẫu điện tử, PDF hướng dẫn), "Tạo hồ sơ theo thủ tục này"; mượn: mục đích dưới 5 ký tự và hạn quá khứ bị chặn, không có nút Duyệt/Giao; thông báo, tài khoản (phân công, lịch sử đăng nhập). Dữ liệu dev: quy tắc bảo quản của U15 là bản E2E ("E2E 5 năm · Thông tư thử nghiệm E2E"), hiện cả ở hồ sơ thật |
| 19/11/2026 | NV-03 | `ollama` | `NVOZPY` | **Đạt:** hàng "Chờ bạn kiểm tra" có đủ 3 hồ sơ vừa trình, có thông báo; không thấy menu Tiếp nhận, nút sửa hồ sơ, sửa trường, In, Thay bản quét, Thêm liên kết; tải được tệp gốc; tab Phân công lọc tên, giao Chuyên viên 02 kèm hạn và lý do (đầu trang đổi ngay); trả lại (ý kiến dưới 10 ký tự khóa nút Gửi); Đạt; Trình lãnh đạo; CSV có BOM; gói xuất (thiếu điều kiện bị chặn, chuyển "Sẵn sàng" qua SSE, tải ZIP, có mã băm); không có nút Duyệt ở Mượn trả. **Chưa chạy:** luồng A với `demo_head_kt` (để NV-09) |
| 19/11/2026 | NV-05 | `ollama` | `NVOZPY` | **Đạt:** bảng tổng hợp theo phòng, số trong ô là liên kết lọc đúng (`?trang-thai=…&phong=ht`); chỉ hai nút Cho ý kiến hoàn tất, Trả lại; trả lại thì trưởng phòng thấy hồ sơ quay lại hàng việc **không cần tải lại**; trình lại → cho ý kiến → "Chờ tiếp nhận nộp lưu"; In mở PDF; phê duyệt hủy kèm văn bản quyết định, từ chối kèm lý do |
| 19/11/2026 | NV-04 | `ollama` | `NVOZPY` | Dữ liệu dựng bằng SQL: 2 hồ sơ `NV-HUY-NVOZPY-A/B` đã lưu trữ cách đây 6 năm ở U15 (quy tắc bảo quản E2E 5 năm đã xác nhận sẵn). Tạo: lô LQ-2026-0025, kho `NV-NVOZPY` (5 cấp), đợt NL-2026-0045 (đã tiếp nhận: 126, 127 lưu trữ), NL-2026-0046 (trả lại). **Đạt:** hàng "Chờ tiếp nhận nộp lưu" đứng đầu; tạo lô, "Nạp PDF vào lô" chọn sẵn lô, ghi lỗi ảnh, đóng lô còn lỗi phải ghi lý do từ 10 ký tự, chốt đúng số trang khi đóng; cây kho chỉ cho cấp sâu hơn, đặt vị trí ở Tổng quan, cộng dồn số hồ sơ lên cấp cha, quét QR mở đúng hộp, in nhãn cả nhánh ra PDF, ngừng dùng hộp còn hồ sơ bị chặn; đợt nộp lưu hiện vị trí và số trang từng hồ sơ, nộp → tiếp nhận → biên bản PDF, hồ sơ lưu trữ khóa sửa, đợt có hồ sơ trống tiếp nhận lỗi mà không hồ sơ nào đổi trạng thái, trả lại đợt cần lý do; mượn trả: hạn quá 90 ngày bị chặn, duyệt, từ chối, giao, nhận trả kèm tình trạng; đề nghị hủy (lý do dưới 10 ký tự bị chặn, không tự phê duyệt), thực hiện hủy có bước "Xác nhận hủy vĩnh viễn" |
| 19/11/2026 | NV-07 | `ollama` | `NVOZPY` | Tạo người dùng `nv.nvozpy.cv` (đặt `is_demo` bằng SQL để đăng nhập dev được), nhóm thử `NVOZ` (loại NVOZ-D01, trường "Số biên bản", thời hạn 10 năm đã xác nhận, cuối cùng **ngừng dùng**). **Đạt:** thêm người dùng; phân công có hạn, đơn vị lọc theo cơ quan, căn cứ dưới 10 ký tự bị chặn; lọc "sắp hết hạn"; khóa thì phiên của người đó mất ngay; mở khóa; không tự khóa được mình; kết thúc phân công có xác nhận tại chỗ; ủy quyền quá 90 ngày bị chặn, ủy quyền 1 ngày cho Chuyên viên 02 có hiệu lực ngay, thu hồi được; thêm nhóm (mã bắt đầu bằng số bị chặn), loại, trường, đề xuất và xác nhận thời hạn (căn cứ dưới 5 ký tự bị chặn); Vận hành 4 mục; Nhật ký: tra Mã lỗi ra đúng request, người, đường dẫn; nhật ký truy cập và thay đổi dữ liệu. **Không chạy:** sửa cài đặt hệ thống (môi trường đang có người khác dùng), chạy lại việc AI lỗi |
| 19/11/2026 | NV-06 (dừng giữa chừng) | `ollama` | `NVOZPY` | `demo_cv_bkt` nạp 2 PDF nhóm H03 (`NVOZPY-hdnd1/2-…`). **Dừng** vì có người khác đang dùng cùng tài khoản: lúc 16:41–16:44 người đó nạp `1-17622231853201738584229.pdf`, tạo HDND-2026-000003, 000004 (chứa PDF `NVOZPY-hdnd1` của lượt này, đã trình), 000005. Không đụng vào các hồ sơ đó. Chạy lại NV-06 khi môi trường chỉ có một người thử |

## Phát hiện

| Mã | Mức | Vai | Màn | Tóm tắt | Xử lý |
|---|---|---|---|---|---|
| NV-02.1 | Nặng | Chuyên viên | Hồ sơ theo thủ tục | Mọi thành phần của 773 thủ tục đều "không bắt buộc": hồ sơ trình được khi thiếu cả đơn đăng ký | chờ duyệt |
| NV-01.1 | Vừa | Chuyên viên | Nạp PDF, Hộp tiếp nhận | PDF hỏng được nhận, sau đó báo "lỗi hệ thống" thay vì "tệp hỏng, quét lại" | chờ duyệt |
| NV-01.2 | Vừa | Chuyên viên | Đối chiếu, Tách văn bản | AI đã nhận ra gói nhiều văn bản nhưng giao diện không báo, cán bộ không biết phải tách | chờ duyệt |
| NV-01.3 | Vừa | Chuyên viên | sau khi tách | Văn bản nguồn biến mất (mọi đường dẫn báo "Không tìm thấy"), văn bản con không dẫn về nguồn | chờ duyệt |
| NV-02.2 | Vừa | Chuyên viên | Tra cứu | Kết quả không liên quan vẫn báo "Tìm thấy"; tô đậm cả "Tô" trong "Tôi" | chờ duyệt |
| NV-05.1 | Vừa | Chuyên viên, trưởng phòng, Chủ tịch | Hồ sơ › Tổng quan, Việc của tôi | Ý kiến khi trình hoặc trả lại chỉ nằm trong tab Nhật ký; người nhận việc không thấy ở nơi họ mở ra | chờ duyệt |
| NV-07.1 | Vừa | Quản trị | Người dùng › Ủy quyền | Người nhận ủy quyền là bất kỳ ai, kể cả người của HĐND; trưởng phòng UBND ủy quyền được cho chuyên viên Ban HĐND | chờ duyệt |
| NV-00.1 | Nhẹ | Người lạ | Đăng nhập | Mỗi lần mở trang đăng nhập khi chưa có phiên, máy chủ web ghi một cảnh báo `api_call_failed` 401 | chờ duyệt |
| NV-01.4 | Nhẹ | Chuyên viên | Tách văn bản | Ảnh trang thu nhỏ quá nhỏ, không phóng to được để thấy chỗ chuyển văn bản | chờ duyệt |
| NV-01.5 | Nhẹ | Chuyên viên | Đối chiếu | Ngày không có thật (31/02) bị báo là sai dạng; Ctrl+Enter bị chặn mà thanh trạng thái không nói vì sao | chờ duyệt |
| NV-01.6 | Nhẹ | Chuyên viên | Hộp tiếp nhận | Thỉnh thoảng có cảnh báo hydration (HTML máy chủ khác máy khách) | chờ duyệt |
| NV-02.3 | Nhẹ | Chuyên viên | Hồ sơ › Nhật ký | Vai trò hiện mã tiếng Anh "(employee)" | chờ duyệt |
| NV-02.4 | Nhẹ | Chuyên viên, quản trị | Danh sách hồ sơ, Người dùng | Nút bị khóa chỉ có lý do trong `title` ("Xuất danh sách"; "Khóa tài khoản" ở trang của chính mình), người dùng bàn phím, màn cảm ứng không đọc được | chờ duyệt |
| NV-02.5 | Nhẹ | Chuyên viên | Mượn trả | Cùng người gửi hai đề nghị mượn chờ duyệt cho một hồ sơ, không bị chặn | chờ duyệt |
| NV-03.1 | Nhẹ | Trưởng phòng | Xuất danh sách CSV | Cột Phòng/Ban ghi mã "ht" thay vì tên phòng | chờ duyệt |
| NV-04.1 | Nhẹ | Văn thư | Lô quét | Lô đang mở ghi "Hiện có: 0 trang đã quét" dù đã có tệp 2 trang | chờ duyệt |
| NV-07.2 | Nhẹ | Quản trị | Ủy quyền, Danh mục, Nhật ký | Mã kỹ thuật lộ ra giao diện: "dossier.accept · Thao tác accept…", "· ht", "ht · tl-ubnd", "Xem dossier/file" | chờ duyệt |
| NV-07.3 | Nhẹ | Quản trị | Danh mục › Thêm nhóm | Chọn cơ quan HĐND vẫn liệt kê đơn vị UBND; chọn thì báo "Dữ liệu tham chiếu tới mục không tồn tại" | chờ duyệt |
| NV-01.7 | Góp ý | Chuyên viên | Hộp tiếp nhận | Giờ nạp ghi "16:04 19-11", nơi khác ghi "19/11/2026" | chờ duyệt |
| NV-01.8 | Góp ý | Chuyên viên | Chọn thủ tục | Danh mục 861 thủ tục không có thủ tục chứng thực hợp đồng về quyền sử dụng đất | chờ duyệt |
| NV-01.9 | Góp ý | Chuyên viên | Hộp tiếp nhận | Ba văn bản con sau tách cùng hiện "Đang chờ · thứ 1" | chờ duyệt |
| NV-02.6 | Góp ý | Chuyên viên, trưởng phòng | Mượn trả, Phân công | Hạn trả (mượn) và hạn nội bộ (tab Phân công) dùng ô ngày của trình duyệt, khác ô dd/mm/yyyy ở form hồ sơ và đối chiếu | chờ duyệt |
| NV-02.7 | Góp ý | Chuyên viên | Hồ sơ › Giấy tờ | "Tìm giấy tờ đã có" nói chỉ gồm giấy tờ đã đối chiếu nhưng ra cả PDF đang ở hộp tiếp nhận | chờ duyệt |
| NV-02.8 | Góp ý | Chuyên viên | Hồ sơ | Tên tab đọc là "Giấy tờ1" (số đếm dính chữ, không có nhãn cho trình đọc màn hình) | chờ duyệt |
| NV-04.2 | Góp ý | Văn thư | Kho bản giấy | Trang vị trí ghi "xếp vào vị trí khi nộp lưu hoặc khi sửa thông tin hồ sơ", thực tế đặt bằng nút "Đặt vị trí" ở Tổng quan | chờ duyệt |
| NV-04.3 | Góp ý | Văn thư | Đặt vị trí bản giấy | Ô chọn liệt kê mọi hộp/kệ của cơ quan, không tìm hay quét QR được; kho thật có hàng trăm hộp sẽ khó chọn | chờ duyệt |
| NV-04.4 | Góp ý | Văn thư | Nộp lưu | Một người vừa lập, nộp vừa tiếp nhận đợt (thiết kế ghi bản thật cần tách văn thư và lưu trữ) | chờ duyệt |
| NV-04.5 | Góp ý | Văn thư | Kho, Nộp lưu | Từ chối theo luật nghiệp vụ (ngừng dùng hộp còn hồ sơ, đợt có hồ sơ lỗi) vẫn kèm "Mã lỗi", dễ bị hiểu là hệ thống hỏng | chờ duyệt |

### NV-01.1 · PDF hỏng được nhận rồi báo "lỗi hệ thống" · Vừa
- Vai, tài khoản: chuyên viên `demo_cv_ht`.
- Bước tái hiện: nạp một PDF bị cắt cụt (20 KB đầu của một PDF thật).
- Mong đợi: bị từ chối ngay lúc nạp như ảnh đổi đuôi; nếu không, hộp tiếp nhận nói tệp hỏng và chỉ cách xử lý (quét hoặc xuất lại, dùng "Thay bản quét").
- Thực tế: tệp được nhận ("Đã nạp"), AI đọc lỗi ngay (3 lần thử). Trang Vận hành › Việc AI của quản trị cũng chỉ ghi cùng câu này, nên quản trị cũng không biết lỗi do tệp. Hộp tiếp nhận ghi "Đọc lỗi · Chưa đọc được PDF do lỗi hệ thống; đã ghi nhật ký." kèm nút "Đọc lại" (bấm cũng sẽ lỗi lại). Cán bộ sẽ hiểu là máy hỏng và gọi quản trị. Ảnh: `NV-01/04-…-sau-khi-tai.png`, `NV-01/03-…-loc-loi.png`.
- Đề xuất: kiểm tra cấu trúc PDF khi nhận tệp (mở được bằng pdfium, có trang); worker phân biệt lỗi do tệp với lỗi hệ thống và ghi lý do dành cho cán bộ.

### NV-01.2 · Gói nhiều văn bản không được báo cần tách · Vừa
- Vai, tài khoản: chuyên viên `demo_cv_ht`.
- Bước tái hiện: nạp `citizen-mixed-packet.pdf` (7 trang: đất đai trang 1–3, thừa kế 4–5, xe 6–7), chờ AI đọc xong, mở Đối chiếu, rồi mở Tách văn bản.
- Mong đợi: màn đối chiếu và hộp tiếp nhận nói "PDF này có vẻ gồm nhiều văn bản, nên tách trước khi đối chiếu".
- Thực tế: `ai_suggestions.mixed_documents = true` và `GET /documents/{id}/review` có trả `mixedDocuments: true`, nhưng `frontend/src` không đọc trường này ở đâu. Màn đối chiếu gợi ý một loại "Hợp đồng chuyển nhượng quyền sử dụng đất" cho cả 7 trang; màn tách mở với "0 điểm tách" (`/segments` rỗng). Cán bộ không xem kỹ sẽ xếp cả gói vào một hồ sơ. Ảnh: `NV-01/28-…-tach-van-ban.png`.
- Đề xuất: hiện cảnh báo nổi bật và nút "Tách thành nhiều văn bản" làm hành động chính khi `mixedDocuments`; thêm nhãn ở hộp tiếp nhận. Gợi ý vị trí điểm tách theo trang đổi tiêu đề là việc riêng của AI.

### NV-01.3 · Sau khi tách, văn bản nguồn không còn đường tới · Vừa
- Vai, tài khoản: chuyên viên `demo_cv_ht`.
- Bước tái hiện: tách `NVOZPY-p5-citizen-mixed-packet.pdf` thành 3 phần, rồi mở lại văn bản nguồn theo các đường dẫn cũ.
- Mong đợi: văn bản nguồn vẫn tra được (dù chỉ đọc), nói rõ "đã tách thành 3 văn bản" kèm liên kết tới từng văn bản con; văn bản con ghi "tách từ … trang 1–3".
- Thực tế: `/tiep-nhan/{nguồn}/doi-chieu`, `/xep-ho-so` và `/giay-to/{nguồn}` đều báo "Không tìm thấy trang hoặc hồ sơ này… không thuộc phạm vi phân công của bạn". Liên kết "Đối chiếu" trên đường dẫn của màn tách cũng dẫn tới trang đó. Văn bản nguồn không có trong thẻ nào của hộp tiếp nhận. Văn bản con ghi "Bản gốc · phiên bản 1" và không nhắc tới nguồn. Chỉ màn tách nói "đã được tách hoặc đã xếp vào hồ sơ" (chữ "hoặc" khiến người đọc không biết trường hợp nào).
- Đề xuất: trang chi tiết của văn bản nguồn ở trạng thái `split` hiện các phần đã tách; văn bản con có dòng "Tách từ …"; bỏ liên kết "Đối chiếu" khi văn bản đã tách.

### NV-01.4 · Không phóng to được trang ở màn tách · Nhẹ
- Thực tế: ảnh thu nhỏ khoảng 95×135 px, bấm vào không phóng to, không có xem trước. Với gói viết tay giả lập, không nhìn ra trang nào bắt đầu văn bản mới; phải quay lại màn đối chiếu để lật từng trang. Ảnh: `NV-01/28-…-tach-van-ban.png`.
- Đề xuất: bấm ảnh thì mở trang lớn (dùng lại `page-viewer`), hoặc có nút phóng to dải ảnh.

### NV-01.5 · Thông báo ngày chưa đúng trường hợp · Nhẹ
- Thực tế: nhập `31/02/2026` (đúng dạng nhưng không có ngày này) thì ô báo "Nhập ngày dạng ngày/tháng/năm, ví dụ 20/01/2026". Bấm Ctrl+Enter thì bị chặn đúng, nhưng thanh dưới vẫn ghi "Có thay đổi chưa xác nhận… Ctrl+Enter để sang bước tiếp" và không nói vì sao chưa sang được (ô lỗi nằm ngoài khung nhìn).
- Đề xuất: "Không có ngày 31/02/2026, kiểm tra lại với bản gốc"; khi Ctrl+Enter bị chặn thì cuộn tới ô lỗi đầu tiên và ghi "Còn 1 ô cần sửa".

### NV-01.6 · Cảnh báo hydration ở hộp tiếp nhận · Nhẹ
- Thực tế: React báo "A tree hydrated but some attributes of the server rendered HTML didn't match" ở `/tiep-nhan` và `/tiep-nhan?doc=loi` trong 2 trên khoảng 6 lần mở, khi có PDF đang chờ hoặc đang đọc. Không tái hiện được theo ý. Nghi do chữ ước tính "khoảng N phút" hoặc tiến độ tính theo `Date.now()` lúc render.
- Đề xuất: tính phần phụ thuộc thời gian sau khi gắn (hoặc dùng `suppressHydrationWarning` đúng chỗ) và thêm test.

### NV-02.1 · Thành phần thủ tục không có cờ bắt buộc · Nặng
- Vai, tài khoản: chuyên viên `demo_cv_ht`.
- Bước tái hiện: tạo hồ sơ theo thủ tục "(Hà Nội) Đăng ký đất đai… lần đầu đối với tổ chức…" (mã 1.116442), xếp 3 giấy tờ bất kỳ, mở Tổng quan.
- Mong đợi: "Đơn đăng ký đất đai… theo Mẫu số 15 (Bản chính)" là thành phần bắt buộc; thiếu thì chưa trình được, đúng như dòng chữ ở form ("hệ thống kiểm tra đủ thành phần bắt buộc trước khi trình").
- Thực tế: cả 11 thành phần ghi "(không bắt buộc)"; trang báo "Đủ điều kiện trình: 3/3 giấy tờ đã đối chiếu" và trình được ngay. Trong CSDL, `procedure_components.required_as_published = false` ở **cả 5.596 dòng của 773 thủ tục**, nên kiểm tra thành phần khi trình (BE-64) không bao giờ chặn. Ngoài ra 301 dòng thành phần bắt đầu bằng "Trường hợp…" là câu ghi chú của thành phần đứng trước bị tách ra thành dòng riêng (ví dụ "Trường hợp nhiều người cùng sử dụng đất… theo Mẫu số 15a;"); ô chọn thành phần khi xếp hồ sơ vì thế có những lựa chọn không phải giấy tờ.
- Thêm: cài đặt hệ thống `dossier.enforce_procedure_components = false` ("false: chỉ cảnh báo", xem Quản trị › Vận hành › Cài đặt), nên kể cả khi có cờ bắt buộc cũng chỉ cảnh báo; hiện tại không có cảnh báo nào vì không thành phần nào bắt buộc.
- Đề xuất: sửa bước nhập thủ tục (`scripts/collect-*-procedures.py`, `build-procedure-library.py`) để lấy cờ bắt buộc và gộp câu "Trường hợp…" vào thành phần cha; nếu nguồn không có cờ thì giao diện không được nói "kiểm tra thành phần bắt buộc" và cần màn để cán bộ đánh dấu.

### NV-02.2 · Tra cứu ra kết quả không liên quan · Vừa
- Bước tái hiện: chuyên viên Hạ tầng tra "to khai khai sinh".
- Thực tế: báo "Tìm thấy 9 giấy tờ", 5 kết quả đầu là hợp đồng chuyển nhượng đất và đơn thừa kế; không kết quả nào chứa "khai sinh" (phạm vi Hạ tầng không có giấy tờ hộ tịch). Trang tô đậm 24 chỗ gồm "tô", "Tô" (trong "Tôi"), "to" (trong "toạ"), "tờ", "TỔ". Người dùng thấy "tìm thấy" sẽ mở từng kết quả để tìm.
- Đề xuất: từ ngắn một âm tiết không đủ để coi là khớp; ưu tiên khớp cả cụm; không có kết quả khớp đủ từ thì nói "không có giấy tờ chứa đủ các từ…" rồi mới liệt kê kết quả gần đúng; chỉ tô đậm khớp trọn từ.

### NV-02.5 · Đề nghị mượn trùng không bị chặn · Nhẹ
- Thực tế: cùng `demo_cv_ht` gửi hai đề nghị mượn UBND-2026-000104 liên tiếp, cả hai ở "Chờ duyệt", không cảnh báo. Kiểm tra trùng ở `LoansHandler` chỉ xét khoản đã duyệt hoặc đang mượn.
- Đề xuất: chặn hoặc cảnh báo khi người đó đã có đề nghị đang chờ cho cùng hồ sơ.

### NV-05.1 · Ý kiến trình và trả lại không hiện ở nơi người nhận việc mở ra · Vừa
- Bước tái hiện: trưởng phòng trình lãnh đạo UBND-2026-000127 kèm ý kiến; Chủ tịch mở hồ sơ. Chủ tịch trả lại kèm lý do; trưởng phòng mở hồ sơ. Trưởng phòng trả lại UBND-2026-000125; chuyên viên mở Việc của tôi rồi mở hồ sơ.
- Mong đợi: người nhận việc thấy ngay ý kiến gần nhất (ai, lúc nào, nội dung) ở đầu hồ sơ hoặc ở dòng trong hàng việc. Thiết kế (`nghiep-vu-vai-tro.html` mục 05) ghi "Lãnh đạo cần thấy nội dung trình… đọc ý kiến"; "Ý kiến yêu cầu hoàn thiện phải chỉ rõ nội dung".
- Thực tế: ở cả ba lần, tab Tổng quan chỉ có trạng thái và các nút; ý kiến chỉ đọc được khi mở tab Nhật ký. Dòng hồ sơ trong "Việc của tôi" cũng không có ý kiến. Thông báo "Hồ sơ bị trả lại" không kèm lý do.
- Đề xuất: khối "Ý kiến gần nhất" ở đầu tab Tổng quan khi hồ sơ đang ở bước có ý kiến (trả lại, chờ lãnh đạo); đưa đoạn đầu ý kiến vào dòng hàng việc và nội dung thông báo.

### NV-04.1 · Lô đang mở báo 0 trang đã quét · Nhẹ
- Thực tế: lô LQ-2026-0025 có 1 tệp 2 trang (đã đọc xong) nhưng ghi "Hiện có: 0 trang đã quét / 10 tờ dự kiến: ít trang hơn số tờ". Sau khi đóng lô thì "Đã chốt: 2 trang". `IntakeHandler` trả `b.ScannedPageCount`, cột này chỉ được tính lại lúc đóng lô hoặc thay bản quét.
- Đề xuất: khi lô còn mở, tính tổng số trang của các bản quét hiện hành mỗi lần đọc (như lúc đóng lô).

### NV-07.1 · Ủy quyền không giới hạn người nhận · Vừa
- Bước tái hiện: quản trị mở trang `demo_head_ht` › Tạo ủy quyền; ô "Người nhận ủy quyền" liệt kê mọi tài khoản (Chủ tịch, quản trị, người của HĐND, tài khoản thử E2E). Chọn `demo_cv_bkt` (chuyên viên Ban Kinh tế - Ngân sách HĐND), quyền `dossier.assign`, 1 ngày, có căn cứ.
- Mong đợi: chỉ chọn được người cùng cơ quan (tốt nhất cùng đơn vị) hoặc ít nhất cảnh báo rõ khi ủy quyền sang cơ quan khác. Thiết kế tách khối UBND và HĐND (Luật 72/2025), "cấp phó dùng phạm vi được phân công hoặc ủy quyền".
- Thực tế: ủy quyền được tạo; `demo_cv_bkt` có ngay phân công thứ hai "Trưởng phòng / Trưởng Ban · UBND · Phòng Hạ tầng (ủy quyền)", tức một người của HĐND được giao việc trong hồ sơ của Phòng Hạ tầng UBND. Đã thu hồi sau khi thử.
- Đề xuất: API chỉ nhận người nhận có phân công còn hiệu lực ở cùng cơ quan với phân công ủy quyền; giao diện lọc danh sách theo đó và có ô tìm thay cho ô chọn dài.

### NV-00.1 · Trang đăng nhập ghi cảnh báo thừa · Nhẹ
- Thực tế: người chưa đăng nhập mở `/ho-so` thì về `/dang-nhap?tiep=%2Fho-so`, đúng. Nhưng máy chủ web vẫn gọi `/api/v1/me` và ghi `level: warn, event: api_call_failed, status: 401` cho mỗi lượt. Khi triển khai thật, mỗi người mở trang đăng nhập sinh một dòng cảnh báo, lấn các cảnh báo cần chú ý.
- Đề xuất: trang đăng nhập không gọi `/me` khi không có cookie phiên, hoặc 401 ở đó ghi mức `debug`.

Mẫu ghi chi tiết cho từng phát hiện:

```
### NV-01.1 · <tóm tắt> · <mức>
- Vai, tài khoản: …
- Bước tái hiện: 1. … 2. …
- Mong đợi: …
- Thực tế: … (ảnh: artifacts/nhap-vai/<ngày>/NV-01/…png; Mã lỗi: …)
- Đề xuất: …
```
