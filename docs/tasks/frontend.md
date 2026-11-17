# Task chi tiết · Frontend Next.js

Next.js 16 (App Router, React 19, render phía máy chủ), Tailwind 4. Đường dẫn tệp tính từ `frontend/`. Quy ước giao diện và bản đồ đường dẫn: `docs/07-khung-giao-dien.md`.

**Trạng thái:** ✅ xong · 🟡 đã có khung, cần làm tiếp · ⬜ chưa làm

Khung frontend đã kiểm tra trên máy:
- `tsc` sạch, `eslint` sạch, `next build` không cảnh báo;
- chạy `next start` với `HOSO_MOCK=1` và gọi thử 30 đường dẫn bằng 4 vai trò.

## Quy ước chung

**Lấy dữ liệu:** trong Server Component bằng `apiFetch` (`src/lib/api/server.ts`). Hàm này tự chuyển tiếp cookie phiên, `X-Assignment-Id`, `X-Correlation-Id`. Không gọi API từ `useEffect` chỉ để hiện dữ liệu lúc mở trang.

**Ghi dữ liệu:** dùng Server Action (`"use server"`):
- dòng đầu luôn là `requireSession()`;
- sau khi ghi gọi `revalidatePath` hoặc `redirect`;
- lỗi `ApiError` trả về cho form qua `useActionState`, không ném ra trang lỗi.

**Tệp lớn và tiến độ:** trình duyệt gọi thẳng `/api/v1/...` cùng origin, kèm header `X-CSRF: 1`. Gồm tải PDF lên và luồng SSE.

**Kiểm tra quyền:** dùng `pageSession(quyền)` ở đầu trang. Đây chỉ để giao diện gọn; quyền thật do API kiểm tra.

**Đặt tên:**
- đường dẫn tiếng Việt không dấu, tạo bằng `routes.*`;
- tên component tiếng Anh;
- chữ trên giao diện tiếng Việt, viết từ góc nhìn người dùng.

**Mỗi màn hình phải có:** trạng thái đang tải, rỗng, lỗi; dùng được bằng bàn phím; không cuộn ngang ở 768px.

**Khi làm thật một màn:** xóa `PlannedScreen` và dữ liệu `lib/mock` của màn đó.

---

## P5 · Nền tảng

### FE-01 · Khởi tạo dự án 🟡 · 0,5 ngày
- **Đã có:**
  - Next 16.4.6, React 19.3, TypeScript strict, ESLint, Tailwind 4;
  - `typedRoutes`, `output: standalone`;
  - tắt `cacheComponents`;
  - `.env.example`.
- **Làm:**
  1. Thêm Vitest + Testing Library + jsdom; Playwright + `@axe-core/playwright`; Prettier.
  2. Thêm script `test`, `test:e2e`, `typecheck`, `gen:api`.
  3. Thêm `engines.node >= 22`.
- **Kiểm tra:** `npm run typecheck && npm run lint && npm test && npm run build` chạy được trong CI.

### FE-02 · Token giao diện ✅ · 1 ngày
- **Đã có:** `src/app/globals.css` (`@theme`: màu theo `government-theme.css`, màu trạng thái riêng, font hệ thống để build được khi không có internet).
- **Còn lại:** nếu cần chế độ tối, thêm token tối theo đúng cấu trúc biến (không bắt buộc cho bản đầu).

### FE-03 · Bộ thành phần 🟡 · 3 ngày
- **Đã có:** `Button`, `ButtonLink`, `Chip`, `WorkflowChip`, `PageHeader`, `Section`, `EmptyState`, `TabsNav`, `Stepper`, `ErrorPanel`, `NoAccess`.
- **Làm:**
  1. Thêm `Input`, `Textarea` (đếm ký tự), `Select`, `Combobox` có tìm kiếm, `DatePicker` nhập `dd/mm/yyyy`.
  2. Thêm `Dialog`, `ConfirmInline` (xác nhận hai bước trong trang), `DataTable` (sắp xếp, chọn nhiều), `Pagination` keyset, `Toast`, `FieldError`.
  3. Dùng Radix UI (MIT) cho Dialog, Popover, Combobox để có sẵn tiếp cận.
- **Kiểm tra:** mỗi thành phần có test render và test bàn phím; axe không lỗi.

### FE-04 · Khung trang và menu ✅ · 1,5 ngày
- **Đã có:**
  - `AppShell`: sidebar theo quyền, ngăn kéo cho màn hẹp, thanh trên;
  - `CommandPalette` (Ctrl+K, `/`, gõ không dấu);
  - `AssignmentSwitcher`, liên kết bỏ qua menu;
  - `config/navigation.ts`, `config/routes.ts`;
  - `loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`.
- **Còn lại:** số đếm trên menu lấy từ API (FE-20).

### FE-05 · Phiên đăng nhập 🟡 · 1,5 ngày
- **Đã có:**
  - `proxy.ts` chặn khi không có cookie, nhớ `?tiep=`;
  - `lib/auth/session.ts` (`getSession` cache theo request, `requireSession`);
  - trang `/dang-nhap` (thật: liên kết `/api/v1/auth/login`; giả lập: chọn tài khoản mẫu);
  - Server Action đổi phân công, đăng xuất.
- **Làm:**
  1. Chạy với API thật (`HOSO_MOCK=0`, `HOSO_API_INTERNAL_URL`): đăng nhập Keycloak, `/me`, đổi phân công, đăng xuất bằng form POST.
  2. Phiên hết hạn giữa chừng: Server Action nhận 401 thì chuyển `/dang-nhap?tiep=<trang hiện tại>`, giữ nháp đang nhập (FE-23).
- **Kiểm tra:** E2E đăng nhập → mở hồ sơ → đổi phân công → menu đổi theo → đăng xuất.

### FE-06 · Gọi API có kiểu ⬜ · 1 ngày
- **Đã có:** `apiFetch` phía máy chủ, lớp `ApiError` (status, code, errorId).
- **Làm:**
  1. `npm run gen:api` sinh `src/api/schema.d.ts` từ `openapi.json` (BE-11) bằng `openapi-typescript`.
  2. `apiFetch` nhận kiểu theo đường dẫn.
  3. Thêm `apiClient` cho trình duyệt (`openapi-fetch`, thêm `X-CSRF: 1`), chỉ dùng cho tải lên và thao tác cần phản hồi tức thì.
- **Kiểm tra:** đổi tên trường ở API thì frontend lỗi biên dịch.

### FE-07 · Mẫu ghi dữ liệu ⬜ · 1 ngày
- **Làm:**
  1. `src/lib/actions.ts`: hàm `action(handler)` gói `requireSession`, bắt `ApiError` và trả `{ ok, fieldErrors, message, errorId }`.
  2. Hook `useActionForm` dựa trên `useActionState` + `useFormStatus` (nút “Đang lưu…”, khóa nút).
  3. `Toast` hiện thông báo thành công hoặc lỗi kèm Mã lỗi.
- **Kiểm tra:** lỗi 422 hiện dưới đúng ô; lỗi 500 hiện toast có Mã lỗi.

### FE-08 · Luồng sự kiện realtime ⬜ · 1 ngày
- **Làm:**
  1. Hook `useServerEvents()` mở `EventSource("/api/v1/events")` một lần trong `AppShell`.
  2. Phát sự kiện qua context.
  3. `job.progress`, `job.completed` cập nhật hộp tiếp nhận; `notification.created` tăng số trên chuông; `dossier.changed` gọi `router.refresh()` nếu đang xem hồ sơ đó.
  4. Hiện chỉ báo khi mất kết nối.
- **Kiểm tra:** tắt mạng 30 giây rồi bật lại thì tự nối lại, không nhân đôi sự kiện.

### FE-09 · Trạng thái trên URL ✅ · 0,5 ngày
- **Đã có:** bộ lọc là form GET (`/ho-so?q=&trang-thai=`, `/tiep-nhan?trang-thai=`, `/tra-cuu?q=`), tab là đường dẫn.
- **Còn lại:** áp dụng cho các màn mới.

### FE-10 · Hạ tầng kiểm thử ⬜ · 1 ngày
- **Làm:**
  1. Vitest cho component và hàm.
  2. Playwright chạy 2 chế độ: giả lập (`HOSO_MOCK=1`, nhanh, chạy mỗi lần merge) và tích hợp (API + Postgres trong CI, hằng đêm).
  3. Fixture đăng nhập theo vai trò; axe trên mọi trang khi chạy E2E.
- **Kiểm tra:** E2E giả lập dưới 3 phút.

### FE-11 · Log và báo lỗi phía web 🟡 · 1 ngày
- **Đã có:**
  - `lib/log.ts` (JSON, lọc khóa nhạy cảm);
  - `instrumentation.ts` (`onRequestError` kèm digest);
  - `instrumentation-client.ts` (lỗi trình duyệt), `/client-log` (giới hạn kích thước, tần suất, kiểm tra Origin);
  - `ErrorPanel` hiện Mã lỗi.
- **Làm:**
  1. Gửi lỗi sang GlitchTip khi có DSN (LOG-04).
  2. `ErrorPanel` hiện cả `errorId` của API khi lỗi đến từ `ApiError`.
- **Kiểm tra:** ném lỗi thử trong một trang thì có dòng `request_failed` với digest trùng mã trên màn hình.

### FE-12 · CSP và header 🟡 · 0,5 ngày
- **Đã có:** CSP nonce với `strict-dynamic` trong `proxy.ts`; header tĩnh trong `next.config.ts`; đã kiểm tra bằng `curl`.
- **Làm:** khi thêm pdf.js, cho phép `worker-src 'self' blob:` (đã có) và đặt `pdf.worker` ở `public/`; chạy kiểm tra CSP trên mọi trang trong E2E (không lỗi console).
- **Kiểm tra:** E2E không có cảnh báo vi phạm CSP.

---

## P6 · Màn hình nghiệp vụ

Mỗi màn đã có tệp `page.tsx` trong `src/app/(app)/…`, đầu trang đúng chuẩn và ghi chú `PlannedScreen` liệt kê việc còn lại.

### FE-20 · Việc của tôi 🟡 · 2 ngày
- **Tệp:** `app/(app)/viec-cua-toi/page.tsx`, `app/(app)/layout.tsx` (số đếm menu).
- **Làm:**
  1. Lấy `summary` và `queue` (BE-69), bỏ `QUEUES` giả lập.
  2. Quá hạn lên đầu, có chip đỏ; còn 2 ngày thì chip vàng.
  3. Số trên menu lấy từ `summary`.
  4. Cập nhật khi có sự kiện SSE.
- **Kiểm tra:** 6 vai trò, mỗi vai trò thấy đúng hàng việc.

### FE-21 · Hộp tiếp nhận và nạp PDF 🟡 · 2 ngày
- **Tệp:** `tiep-nhan/page.tsx`, `tiep-nhan/tai-len/page.tsx`, `features/intake/uploader.tsx` (client).
- **Làm:**
  1. Kéo thả nhiều tệp; tải 3 tệp song song bằng XHR để có tiến độ; hủy được.
  2. Trùng tệp (409) hiện liên kết tới giấy tờ cũ; sai định dạng báo ngay tại tệp đó.
  3. Danh sách lấy từ BE-42; tiến độ đọc qua SSE.
  4. Bỏ PDF có Hoàn tác.
- **Kiểm tra:** E2E tải 3 PDF mẫu, thấy “Thứ 2 trong hàng đợi” rồi “Đã đọc xong”.

### FE-22 · Trình xem PDF ⬜ · 3 ngày
- **Tệp:** `components/pdf/pdf-viewer.tsx` (client, tải động `pdfjs-dist`).
- **Làm:**
  1. Đọc theo Range từ `/api/v1/files/{id}/content`; tắt `isEvalSupported`.
  2. Phóng to, xoay hiển thị, chuyển trang, ảnh thu nhỏ.
  3. Làm nổi vùng theo `source_region`; API `scrollTo(page, region)`.
- **Kiểm tra:** PDF 300 trang mở dưới 2 giây, cuộn mượt.

### FE-23 · Đối chiếu 🟡 · 3 ngày
- **Tệp:** `tiep-nhan/[documentId]/doi-chieu/page.tsx`, `features/review/review-form.tsx`.
- **Làm:**
  1. Dữ liệu từ BE-47; form sinh theo `field_definitions`, `value_type`.
  2. Trường cần chú ý lên đầu; bấm trường thì trình xem nhảy tới đúng vùng.
  3. Đổi loại giấy tờ (BE-48); lưu nháp tự động mỗi 5 giây vào `sessionStorage`.
  4. Rời trang khi còn thay đổi chưa lưu thì hỏi lại trong trang.
  5. `Ctrl+Enter` lưu và sang bước 3.
  6. Bản đầu để thông luồng (docs/tasks/ai.md) được xem bản gốc bằng ảnh trang WebP của BE-43 (`/files/{id}/pages/{n}/preview`), chưa cần trình xem PDF đầy đủ của FE-22.
- **Kiểm tra:** nhập ngày sai hiện lỗi tại ô; lưu xong tải lại trang thấy đúng giá trị.

### FE-24 · Xếp vào hồ sơ 🟡 · 2 ngày
- **Tệp:** `tiep-nhan/[documentId]/xep-ho-so/page.tsx`.
- **Làm:**
  1. Gợi ý từ BE-63, ô tìm hồ sơ khác.
  2. Tạo hồ sơ mới trong hộp thoại (dùng lại form FE-27).
  3. Chọn chiều đến/đi/nội bộ, thành phần thủ tục.
  4. “Lưu và mở PDF tiếp theo” chuyển tới PDF kế tiếp đã đọc xong.
- **Kiểm tra:** E2E xếp liên tiếp 3 PDF không quay về danh sách.

### FE-25 · Tách văn bản 🟡 · 2,5 ngày
- **Làm:**
  1. Dải ảnh thu nhỏ; bấm khoảng giữa hai trang để đặt điểm tách.
  2. Gán loại cho từng phần; đánh dấu phụ lục.
  3. Hoàn tác trước khi xác nhận; gọi BE-51.
- **Kiểm tra:** PDF 12 trang tách 4 phần đúng dải trang.

### FE-26 · Danh sách hồ sơ 🟡 · 2 ngày
- **Đã có:** bảng, lọc từ khóa và trạng thái bằng form GET, chip trạng thái, trạng thái rỗng.
- **Làm:**
  1. Dữ liệu BE-60; thêm lọc nhóm, đầu mối, năm, người chủ trì, quá hạn.
  2. Sắp xếp theo cột (trên URL); phân trang keyset.
  3. Xuất CSV theo bộ lọc.
- **Kiểm tra:** gửi đường dẫn có bộ lọc cho người khác thì mở đúng.

### FE-27 · Tạo, sửa hồ sơ 🟡 · 1,5 ngày
- **Làm:**
  1. Ô chọn liên kết tổ chức → đầu mối → nhóm (BE-31); thủ tục (BE-33).
  2. Server Action tạo hồ sơ; lỗi hiện dưới đúng ô.
  3. Sửa gửi `rowVersion`; xung đột thì báo và cho tải lại.
- **Kiểm tra:** tạo xong mở tab Giấy tờ của hồ sơ mới.

### FE-28 · Hồ sơ · Tổng quan 🟡 · 2 ngày
- **Đã có:** layout hồ sơ (đầu trang, tab, thanh thao tác), danh sách kiểm tra giả lập.
- **Làm:**
  1. Lấy hồ sơ và checklist (BE-60, BE-64).
  2. Thành phần thiếu có nút mở hộp tiếp nhận lọc sẵn loại giấy tờ.
  3. Vị trí bản giấy bấm được, mở Kho bản giấy.
- **Kiểm tra:** hồ sơ ngoài phạm vi hiện “Không tìm thấy”.

### FE-29 · Hồ sơ · Giấy tờ 🟡 · 1,5 ngày
- **Làm:** danh sách theo thứ tự; kéo thả sắp xếp (dùng được bằng bàn phím); gỡ; thêm từ hộp tiếp nhận (BE-62). Chỉ sửa được ở bước được phép.
- **Kiểm tra:** sắp xếp bằng bàn phím (Space, mũi tên).

### FE-30 · Hồ sơ · Thanh thao tác 🟡 · 1,5 ngày
- **Đã có:** `ActionBar`: nút theo luật, ô ý kiến tại chỗ đếm 10 ký tự, lý do khi bị khóa, câu “đang chờ ai”.
- **Làm:**
  1. Lấy thao tác từ BE-66; bỏ `mockAllowedActions`.
  2. Gửi qua Server Action (BE-67) kèm `rowVersion`.
  3. 409 thì báo “hồ sơ vừa thay đổi” và tải lại; thành công thì toast và `router.refresh()`.
- **Kiểm tra:** E2E đủ luồng: trình → trả lại → trình lại → đạt → nộp lưu.

### FE-31 · Hồ sơ · Phân công 🟡 · 1 ngày
- **Làm:** chọn chuyên viên có tìm kiếm, hiện số hồ sơ mỗi người đang giữ; hạn không trước hôm nay; đổi người chủ trì phải ghi lý do (BE-65).
- **Kiểm tra:** tab chỉ hiện với `dossier.assign`.

### FE-32 · Hồ sơ · Nhật ký 🟡 · 0,5 ngày
- **Làm:** dữ liệu BE-68, lọc theo loại sự kiện, phân trang.
- **Kiểm tra:** ý kiến trả lại hiện đúng người, thời điểm.

### FE-33 · Chi tiết giấy tờ 🟡 · 2 ngày
- **Làm:**
  1. Trình xem và trường đã đối chiếu; nhãn “đã sửa” so với AI.
  2. Phiên bản tệp, chữ ký số, liên kết, các hồ sơ chứa giấy tờ.
  3. `?trang=` mở đúng trang; tải và in theo quyền.
- **Kiểm tra:** từ Tra cứu bấm kết quả thì mở đúng trang trúng.

### FE-34 · Tra cứu 🟡 · 2 ngày
- **Làm:** kết quả BE-80; đoạn trích tô đậm; bộ lọc thời gian, cơ quan, loại, nhóm trên URL; phân trang.
- **Kiểm tra:** gõ không dấu ra kết quả có dấu.

### FE-35 · Thủ tục hành chính 🟡 · 2 ngày
- **Làm:** danh sách, lọc, chi tiết thành phần, tải mẫu (BE-33); thủ tục bãi bỏ có cảnh báo; nút “Tạo hồ sơ theo thủ tục này”.
- **Kiểm tra:** thay được trang `data/official-forms/index.html` của bản thí điểm.

### FE-36 · Kho bản giấy, mượn trả 🟡 · 3 ngày
- **Làm:**
  1. Cây vị trí và hồ sơ trong vị trí; in nhãn QR (BE-81).
  2. Ô tìm nhận mã từ đầu đọc mã vạch (nhập như bàn phím, Enter để mở).
  3. Chuyển vị trí; mượn trả theo tab (BE-83).
- **Kiểm tra:** quét QR mở đúng hộp.

### FE-37 · Nộp lưu 🟡 · 2 ngày
- **Làm:** hàng chờ; chọn nhiều để tạo đợt; kiểm tra từng hồ sơ; tiếp nhận hoặc trả lại; tải biên bản (BE-84, BE-85).
- **Kiểm tra:** một hồ sơ lỗi thì cả đợt chưa tiếp nhận, hiện lý do.

### FE-38 · Xuất dữ liệu 🟡 · 1 ngày
- **Làm:** chọn phạm vi, tiến độ qua SSE, tải gói, hiện mã băm (BE-86).
- **Kiểm tra:** gói hết hạn hiện trạng thái rõ.

### FE-39 · Đề nghị hủy 🟡 · 1 ngày
- **Làm:** tạo, duyệt kèm văn bản quyết định, thực hiện với xác nhận hai bước trong trang (BE-87).
- **Kiểm tra:** không thể thực hiện khi chưa duyệt.

### FE-40 · Thông báo 🟡 · 1 ngày
- **Làm:** danh sách (BE-70), đánh dấu đã đọc, đánh dấu tất cả; chuông cập nhật qua SSE; bấm thông báo mở đúng hồ sơ.
- **Kiểm tra:** thông báo mới đến trong 1 giây.

### FE-41 · Lô quét và lỗi ảnh 🟡 · 2 ngày
- **Làm:** danh sách lô, tạo lô, chi tiết lô, bảng lỗi ảnh theo trang, đánh dấu đã quét lại (BE-40, BE-53).
- **Kiểm tra:** đóng lô còn lỗi thì hiện cảnh báo nhưng vẫn cho đóng.

### FE-42 · Tài khoản, người dùng, phân công 🟡 · 2,5 ngày
- **Làm:** trang tài khoản (BE-30); quản trị người dùng, phân công có thời hạn và căn cứ, ủy quyền, khóa tài khoản (BE-34).
- **Kiểm tra:** phân công sắp hết hạn (≤ 7 ngày) có chip vàng.

### FE-43 · Quản trị danh mục 🟡 · 2,5 ngày
- **Làm:** cây danh mục; sửa nhóm, loại, trường; xác nhận; ngừng dùng; thời hạn bảo quản (BE-32, BE-35).
- **Kiểm tra:** ngừng dùng loại đã có giấy tờ, không có nút xóa.

### FE-44 · Quản trị vận hành 🟡 · 2 ngày
- **Làm:** hàng đợi AI, đọc lại hoặc hủy job, mô hình, sao lưu, cài đặt (BE-88, BE-89); liên kết công cụ thử nghiệm SAM 3.
- **Kiểm tra:** chỉ `technical_admin` thấy.

### FE-45 · Khay chờ AI và "Trích xuất ngay" ✅ · 1,5 ngày (chế độ giả lập; nối API thật cùng FE-21)
- **Phụ thuộc:** BE-97, BE-98, BE-99. Thiết kế mức ưu tiên ở `docs/tasks/ai.md`.
- **Trạng thái 17/11/2026:** `tsc`, `eslint`, `next build` sạch; đã bấm thử bằng Chromium (Playwright) với `HOSO_MOCK=1`: nút "Trích xuất ngay", "Trích xuất lại" và "cả hồ sơ" chạy Server Action, kết quả hiện cạnh nút, không có lỗi trình duyệt. **Chưa thử với API thật** (hộp tiếp nhận còn dữ liệu mẫu cho tới FE-21):
  - `lib/ai-queue.ts` (nhãn khay, thời gian chờ, tóm tắt kết quả);
  - Server Action `app/actions/ai-extract.ts` (gọi BE-98; ở chế độ giả lập trả kết quả mẫu; lỗi 403/404/409/422/429 thành thông báo cạnh nút);
  - `features/intake/extract-now-button.tsx`, `ai-status.tsx`;
  - gắn vào hộp tiếp nhận, màn đối chiếu, tab Giấy tờ của hồ sơ, trang vận hành (`features/ops/ai-queue-panel.tsx`).
  Hộp tiếp nhận vẫn đọc dữ liệu mẫu cho tới khi FE-21 nối API thật.
- **Tệp:**
  - `features/intake/ai-status.tsx` (mới);
  - `features/intake/extract-now-button.tsx` (mới, client);
  - `tiep-nhan/page.tsx`, trang hồ sơ tab Giấy tờ (FE-29), màn đối chiếu (FE-23), quản trị vận hành (FE-44).
- **Làm:**
  1. Hộp tiếp nhận có cột trạng thái AI, lọc được theo trạng thái:
     - "Chờ trong khay · thứ N · khoảng X phút" (không có ước tính thì bỏ phần thời gian);
     - "Ưu tiên · thứ N";
     - "Đang đọc trang a/b";
     - "Đã đọc xong" hoặc "Lỗi".
  2. Nút **Trích xuất ngay**:
     - có ở từng giấy tờ (hộp tiếp nhận, màn đối chiếu) và ở hồ sơ (tab Giấy tờ: cả hồ sơ);
     - gọi BE-98 rồi báo kết quả, ví dụ "Đã đưa 3 giấy tờ lên đầu hàng · 1 giấy tờ đã đọc xong";
     - giấy tờ đã xong có thêm lựa chọn "Trích xuất lại" (`force`).
  3. Tiến độ cập nhật qua SSE, không tải lại trang.
  4. Màn vận hành hiển thị số việc theo mức và số lần nhường chỗ (BE-99).
- **Kiểm tra:** E2E:
  - tải 3 PDF, cả ba ở trạng thái "Chờ trong khay";
  - bấm **Trích xuất ngay** ở PDF thứ 3 thì PDF này chuyển sang "Ưu tiên" và được đọc xong trước hai PDF còn lại;
  - người không có quyền không thấy nút.

---

## Sau khi xong các màn

| ID | Task | Ngày |
|---|---|---|
| MG-04 | Chuyển `index.html`, `nghiep-vu-vai-tro.html` vào `public/nghien-cuu/` dạng tĩnh, liên kết từ trang đăng nhập | 0,5 |
| QA-02 | E2E đủ kịch bản theo vai trò trong `nghiep-vu-vai-tro.html` | 3 |
| QA-05 | Kiểm tra tiếp cận (axe + bàn phím) 10 màn chính | 1 |
| OPS-01 | Docker image `node .next/standalone/server.js` (không dùng `next start` với `output: standalone`), chạy không phải root | 0,5 |
