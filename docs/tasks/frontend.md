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
  - `.env.example`;
  - (17/11/2026) Vitest 3 + Testing Library + jsdom (`vitest.config.ts`), Playwright 1.64 + `@axe-core/playwright` (`playwright.config.ts`, thư mục `e2e/`), Prettier (`.prettierrc.json`);
  - script `typecheck`, `test`, `test:watch`, `test:e2e`, `gen:api`, `format`; `engines.node >= 22`.
- **Còn lại:** nối `typecheck`, `lint`, `test`, `build` vào CI (P0-06); chạy `npm run format` một lần cho cả cây mã (chưa chạy để diff không lẫn việc khác).
- **Kiểm tra:** `npm run typecheck && npm run lint && npm test && npm run build` chạy được cục bộ (đã chạy 17/11/2026).

### FE-02 · Token giao diện ✅ · 1 ngày
- **Đã có:** `src/app/globals.css` (`@theme`: màu theo `government-theme.css`, màu trạng thái riêng, font hệ thống để build được khi không có internet).
- **Còn lại:** nếu cần chế độ tối, thêm token tối theo đúng cấu trúc biến (không bắt buộc cho bản đầu).

### FE-03 · Bộ thành phần 🟡 · 3 ngày
- **Đã có:** `Button`, `ButtonLink`, `Chip`, `WorkflowChip`, `PageHeader`, `Section`, `EmptyState`, `TabsNav`, `Stepper`, `ErrorPanel`, `NoAccess`, `NeedsRealApi`; (17/11/2026) `Dialog` (phần tử `<dialog>` gốc: bẫy tiêu điểm, Esc, nền bị vô hiệu), `Toast` (có nút hành động như "Hoàn tác", lỗi kèm Mã lỗi, `role=alert`), `ConnectionBanner`.
- **Làm:**
  1. Thêm `Input`, `Textarea` (đếm ký tự), `Select`, `Combobox` có tìm kiếm, `DatePicker` nhập `dd/mm/yyyy`. Hiện các màn đối chiếu và xếp hồ sơ tự viết ô nhập tại chỗ; gom lại khi làm FE-27.
  2. Thêm `ConfirmInline` (xác nhận hai bước trong trang), `DataTable` (sắp xếp, chọn nhiều), `Pagination` keyset, `FieldError`.
  3. Dùng Radix UI (MIT) cho Popover, Combobox để có sẵn tiếp cận (Dialog đã dùng `<dialog>` gốc nên không cần Radix).
- **Kiểm tra:** mỗi thành phần có test render và test bàn phím; axe không lỗi.

### FE-04 · Khung trang và menu ✅ · 1,5 ngày
- **Đã có:**
  - `AppShell`: sidebar theo quyền, ngăn kéo cho màn hẹp, thanh trên;
  - `CommandPalette` (Ctrl+K, `/`, gõ không dấu);
  - `AssignmentSwitcher`, liên kết bỏ qua menu;
  - `config/navigation.ts`, `config/routes.ts`;
  - `loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`.
- **Đã làm thêm 17/11/2026:** số đếm trên menu và chuông lấy từ `GET /workspace/summary` khi chạy thật (`(app)/layout.tsx`); thanh trên gọn ở 768–1279px (nút Đi nhanh chỉ hiện từ 1024px, tên người dùng từ 1280px).
- **Còn lại:** chuông chưa tăng theo SSE `notification.created` (FE-40).

### FE-05 · Phiên đăng nhập 🟡 · 1,5 ngày
- **Đã có:**
  - `proxy.ts` chặn khi không có cookie, nhớ `?tiep=`;
  - `lib/auth/session.ts` (`getSession` cache theo request, `requireSession`);
  - trang `/dang-nhap` (thật: liên kết `/api/v1/auth/login`; giả lập: chọn tài khoản mẫu);
  - Server Action đổi phân công, đăng xuất.
- **Đã kiểm 17/11/2026:** với API thật (đăng nhập dev `dev_admin`) trang đọc phiên qua `/api/v1/me`, đổi phân công làm đổi menu và dữ liệu (E2E `signIn`). **Chưa kiểm** đăng nhập Keycloak thật.
- **Làm:**
  1. Chạy với API thật (`HOSO_MOCK=0`, `HOSO_API_INTERNAL_URL`): đăng nhập Keycloak, `/me`, đổi phân công, đăng xuất bằng form POST.
  2. Phiên hết hạn giữa chừng: Server Action nhận 401 thì chuyển `/dang-nhap?tiep=<trang hiện tại>`, giữ nháp đang nhập (FE-23).
- **Kiểm tra:** E2E đăng nhập → mở hồ sơ → đổi phân công → menu đổi theo → đăng xuất.

### FE-06 · Gọi API có kiểu ✅ · 1 ngày
- **Đã có (17/11/2026):**
  - `npm run gen:api` (`scripts/gen-api.mjs`) sinh `src/api/schema.d.ts` từ `openapi.json`. Script gỡ nhánh `string` của số nguyên (.NET khai `["integer","string"]` vì nhận số từ chuỗi) nên kiểu là `number`, không phải `number | string`;
  - `serverApi()` + `ok()` (`lib/api/server.ts`): client `openapi-fetch` có kiểu theo đường dẫn và tham số, tự chuyển tiếp cookie phiên, `X-Assignment-Id`, `X-Correlation-Id`, `X-CSRF`; mọi lỗi HTTP thành `ApiError` (`lib/api/problem.ts`: mã lỗi, Mã lỗi, lỗi theo ô, `details`);
  - `createBrowserApi(assignmentId)`, `browserHeaders()`, `uploadPdf()` (XHR có tiến độ) ở `lib/api/client.ts`.
- **Lưu ý quan trọng:** API chỉ nhận phân công đang dùng qua header `X-Assignment-Id`. `<img>` và `EventSource` không gửi được header, cookie `hoso_assignment` lại là httpOnly. Vì vậy mọi lệnh gọi trực tiếp từ trình duyệt phải gắn header bằng `useAssignmentId()` (`lib/auth/client-session.tsx`), và ảnh trang, SSE đọc bằng `fetch`. Nếu không, người kiêm nhiệm nhiều phân công bị tính theo phân công đầu danh sách (ảnh trang trả 403).
- **Còn lại:** chuyển các chỗ cũ còn dùng `apiFetch<T>` viết tay (`getSession`, `app/actions/ai-extract.ts`, `quan-tri/van-hanh/page.tsx`) sang `serverApi()`.
- **Kiểm tra:** đổi tên trường hoặc đường dẫn trong `openapi.json` rồi `npm run gen:api && npm run typecheck` thì chỗ gọi lỗi biên dịch.

### FE-07 · Mẫu ghi dữ liệu ✅ · 1 ngày
- **Đã có (17/11/2026):**
  - `lib/actions.ts`: `runAction(tên, handler)` kiểm phiên (không có thì trả 401), bắt `ApiError` và trả `{ ok, data }` hoặc `{ ok: false, message, status, code, errorId, fieldErrors, details }` (`lib/action-result.ts`);
  - hook `useServerAction(action)` (`lib/use-server-action.ts`): trạng thái đang gửi, hết phiên (401) thì chuyển `/dang-nhap?tiep=<trang hiện tại>`, lỗi thì hiện `Toast` kèm Mã lỗi, riêng lỗi theo ô thì để form tự hiện dưới ô;
  - `Toast` (xem FE-03).
- **Khác kế hoạch:** dùng `useTransition` thay vì `useActionState` vì các màn đối chiếu và xếp hồ sơ gọi action nhiều lần theo thao tác (không phải một form gửi một lần). Form một lần gửi vẫn nên dùng `useActionState`.
- **Kiểm tra:** lỗi 422 và lỗi theo ô hiện đúng ô (đối chiếu: ngày sai ở đầu văn bản; xếp hồ sơ: tên hồ sơ), có test đơn vị `lib/api/problem.test.ts`; lỗi 5xx hiện toast có Mã lỗi.

### FE-08 · Luồng sự kiện realtime ✅ · 1 ngày
- **Đã có (17/11/2026):**
  - `ServerEventsProvider` (`lib/events/server-events.tsx`, đặt trong `(app)/layout.tsx`): một luồng SSE tới `/api/v1/events` cho cả ứng dụng, không mở lại khi chuyển trang;
  - hook `useServerEvent(loại, hàm)`; `useConnectionStatus()`; `ConnectionBanner` báo khi mất kết nối quá 3 giây;
  - tự nối lại 1→30 giây, gửi `Last-Event-ID`, đánh thức khi có mạng hoặc quay lại tab, phát `resync` sau khi nối lại; coi kết nối treo khi 70 giây không có byte nào (API gửi nhịp tim mỗi 25 giây);
  - hộp tiếp nhận và trang Nạp PDF nghe `job.progress`/`job.completed`/`job.failed`/`job.cancelled`; màn đối chiếu nghe tiến độ của đúng giấy tờ đang mở.
- **Khác kế hoạch:** đọc luồng bằng `fetch` + bộ đọc SSE tự viết (`lib/events/sse-parser.ts`, có test), không dùng `EventSource`, vì `EventSource` không gửi được header `X-Assignment-Id` (xem FE-06). Hệ quả: luồng luôn mở nên `networkidle` của Playwright không bao giờ đạt, E2E không dùng.
- **Còn lại:** `notification.created` tăng số trên chuông và `dossier.changed` gọi `router.refresh()` khi đang xem hồ sơ đó (làm cùng FE-40 và FE-28).
- **Kiểm tra:** E2E thấy bảng hộp tiếp nhận đổi sang "Đã đọc xong" không cần tải lại. **Chưa kiểm** kịch bản tắt mạng 30 giây rồi bật lại.

### FE-09 · Trạng thái trên URL ✅ · 0,5 ngày
- **Đã có:** bộ lọc là form GET (`/ho-so?q=&trang-thai=`, `/tiep-nhan?trang-thai=`, `/tra-cuu?q=`), tab là đường dẫn.
- **Còn lại:** áp dụng cho các màn mới.

### FE-10 · Hạ tầng kiểm thử 🟡 · 1 ngày
- **Đã có (17/11/2026):**
  - Vitest: `npm test` (45 test: logic đối chiếu, hàng đợi tải lên, tiến độ hộp tiếp nhận, bộ đọc SSE, ProblemDetails, nhãn khay AI, Toast);
  - Playwright 1.64 + axe: `e2e/fixtures.ts` (`signIn` theo vai trò qua dev-login, `samplePdf`, `watchConsole` bắt lỗi CSP, `expectAccessible`), `playwright.config.ts` có hai chế độ qua `E2E_MODE`.
- **Còn lại:** chế độ giả lập (`HOSO_MOCK=1`, `webServer` tự chạy) và chạy trong CI; fixture đủ 6 vai trò (hiện mới `employee`, `manager`, `clerk` qua tài khoản `dev_admin`); axe trên mọi trang.
- **Chạy E2E tích hợp:** xem `frontend/README.md`.

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
- **Đã có:** CSP nonce với `strict-dynamic` trong `proxy.ts`; header tĩnh trong `next.config.ts`; đã kiểm tra bằng `curl`; E2E tiếp nhận (`e2e/tiep-nhan.spec.ts`) kiểm console không có cảnh báo CSP trên các màn nạp, hộp tiếp nhận, đối chiếu, xếp hồ sơ (ảnh trang dùng blob URL, `img-src` đã có `blob:`).
- **Làm:** khi thêm pdf.js, cho phép `worker-src 'self' blob:` (đã có) và đặt `pdf.worker` ở `public/`; chạy kiểm tra CSP trên mọi trang trong E2E (không lỗi console).
- **Kiểm tra:** E2E không có cảnh báo vi phạm CSP.

---

## P6 · Màn hình nghiệp vụ

Mỗi màn đã có tệp `page.tsx` trong `src/app/(app)/…`, đầu trang đúng chuẩn và ghi chú `PlannedScreen` liệt kê việc còn lại.

### FE-20 · Việc của tôi ✅ · 2 ngày
- **Đã có (17/11/2026, API thật):** `viec-cua-toi/page.tsx`, `features/workspace/`:
  - hàng việc lấy từ `GET /workspace/queue` và số lượng từ `/workspace/summary` theo phân công đang dùng; mỗi vai trò mở ra đúng hàng mặc định: chuyên viên "Cần bạn làm", văn thư "Chờ tiếp nhận nộp lưu" rồi "Cần bạn làm", trưởng phòng "Chờ bạn kiểm tra" rồi "Cần bạn làm", lãnh đạo "Chờ bạn cho ý kiến", quản trị kỹ thuật chỉ có lối vào vận hành (`workspace-queue.ts`, có test);
  - thứ tự: quá hạn lên đầu (chip đỏ "Quá hạn N ngày"), bị trả lại, sắp đến hạn (≤ 2 ngày, chip vàng), còn lại; mỗi hàng hiện 10 hồ sơ ưu tiên nhất vì API trả cả nghìn hồ sơ cho văn thư, có "Xem tất cả";
  - số trên menu và chuông lấy từ summary (FE-04); trang tự làm mới khi có `dossier.changed`, `notification.created`, `job.completed` hoặc `resync` qua SSE (`RefreshOnEvents`).
- **Đã nối thêm (18/11/2026):** bảng tổng hợp theo phòng cho Chủ tịch và ba lối vào của lãnh đạo HĐND (FE-47, BE-115).
- **Còn lại:** lối "Xem tất cả" của hàng Cần bạn làm mở danh sách hồ sơ tôi chủ trì (`?cua-toi=1`), chưa lọc riêng "bị trả lại".
- **Kiểm tra:** E2E đăng nhập từng vai trò thấy đúng hàng việc (đã thử văn thư và chuyên viên bằng API thật).

### FE-21 · Hộp tiếp nhận và nạp PDF ✅ · 2 ngày
- **Đã có (17/11/2026, chạy với API thật):**
  - `tiep-nhan/tai-len`: `features/intake/uploader.tsx` kéo thả nhiều tệp, tải 3 tệp song song bằng XHR có tiến độ, hủy từng tệp, thử lại khi lỗi tạm thời, chọn lô quét đang mở (nhớ lô vừa dùng). Tệp sai đuôi, rỗng, quá 200 MB báo ngay tại tệp (`upload-queue.ts`), tệp trùng (409 `duplicate_file`) hiện liên kết tới giấy tờ cũ. Sau khi tải xong, mỗi tệp hiện vị trí trong khay rồi "Đang đọc trang a/b", "Đã đọc xong" qua SSE;
  - `tiep-nhan`: `features/intake/inbox-table.tsx` đọc `GET /intake/inbox` (`{ items, nextCursor }`, không coi là mảng), nút "Tải thêm" dùng `cursor`, đổi thẻ là bắt đầu lại; ba thẻ Chờ xếp / Đã xếp / Đã bỏ; lọc theo tình trạng đọc; "Bỏ" có "Hoàn tác" (toast và thẻ Đã bỏ); tiến độ và thứ tự cập nhật qua SSE.
  - dưới 1280px mỗi PDF hiện thành một thẻ (bảng cần 820px nên ở 1024px có menu trái sẽ đẩy nút ra ngoài); nút "Hủy đọc" cho PDF đang chờ hoặc đang đọc (`POST /jobs/{id}/cancel`, chỉ người tải lên hoặc quản trị hàng đợi).
- **Còn lại:** lọc theo lô quét và người nạp; chọn nhiều để bỏ hoặc xếp cùng một hồ sơ; bộ lọc tình trạng đọc mới lọc trong phần đã tải (chưa có tham số lọc ở API).
- **Kiểm tra:** E2E `e2e/tiep-nhan.spec.ts` tải 3 PDF mẫu, thấy "Chờ trong khay"/"Đang đọc" rồi "Đã đọc xong".

### FE-22 · Trình xem PDF 🟡 · 3 ngày
- **Đã có (18/11/2026, BE-114):** làm nổi vùng nguồn của trường trên ảnh trang. `features/review/page-viewer.tsx` nhận `highlight` (khung đặt theo PHẦN TRĂM của ảnh nên đúng ở cả hai mức phóng; tự cuộn vào giữa khung nhìn; nét liền khi vùng lấy từ khối bố cục, nét đứt kèm lời nhắc khi chỉ ước theo dòng); `features/review/source-region.ts` (kiểm vùng, đổi sang CSS, đọc/ghi `?vung=`, có test). Dùng ở màn đối chiếu (bấm trường: nhảy trang và làm nổi vùng) và chi tiết giấy tờ (`?trang=2&vung=x,y,w,h&truong=…`, liên kết "Trang N · chỉ vùng" ở từng trường).
- **Còn lại:** trình xem PDF đầy đủ bằng pdf.js (đọc theo Range từ `/files/{id}/content`, tắt `isEvalSupported`, xoay, ảnh thu nhỏ). Ảnh trang WebP hiện đủ cho đối chiếu; chỉ làm khi cần xoay hoặc tài liệu rất dài. Lưu ý CSP của trang (`object-src 'none'`, khung `blob:` không được phép) khi chọn cách nhúng PDF.
- **Kiểm tra:** E2E `vung-nguon.spec.ts` (khung đúng toạ độ API trả, di chuyển khi đổi trường, đúng sau khi phóng to, `?vung=` hỏng thì không dựng khung). **Chưa đo** PDF 300 trang.

### FE-23 · Đối chiếu ✅ (bản đầu, xem bản gốc bằng ảnh trang) · 3 ngày
- **Đã nối (18/11/2026):** BE-114 (bấm trường làm nổi vùng nguồn trên trang, xem FE-22) và BE-116 ("Đã xác nhận bởi … lúc …").
- **Đã có (17/11/2026, chạy với API thật):** `tiep-nhan/[documentId]/doi-chieu/page.tsx`, `features/review/review-screen.tsx`, `page-viewer.tsx`, `review-state.ts`, `app/actions/review.ts`.
  - dữ liệu từ `GET /documents/{id}/review`; trường lấy từ `field_definitions` theo `value_type` (ngày `dd/mm/yyyy` kiểm ngay khi rời ô, số, có/không, văn bản), trường cần chú ý lên đầu và phải đánh dấu "đã kiểm" (tự bật khi sửa giá trị) mới xác nhận được;
  - bấm vào trường thì bản gốc nhảy tới trang nguồn; xem bản gốc bằng ảnh trang (`/files/{id}/pages/{n}/preview`, tải bằng `fetch` có header phân công), đổi trang, phóng to;
  - chấp nhận gợi ý hoặc đổi nhóm/loại giấy tờ (BE-48), bộ trường đổi theo loại;
  - phần "Thông tin đầu văn bản": tiêu đề, hình thức, số, ngày ban hành, ghi chú; hiện thời điểm và ghi chú đã xác nhận; xác nhận qua `PUT /documents/{id}/metadata` kèm `version` mới nhất (BE-103/107). Một lần bấm xác nhận gửi lần lượt loại giấy tờ (nếu chưa) → trường → đầu văn bản → đánh dấu đã đối chiếu, không tự xác nhận thay người dùng; sửa đầu văn bản thì đặt lại về chưa đối chiếu nên bước xác nhận luôn ở cuối;
  - nháp tự lưu mỗi 5 giây vào `sessionStorage` (khôi phục sau khi hết phiên đăng nhập hoặc tải lại, bỏ nếu giấy tờ đã đổi phiên bản), `beforeunload` và hộp thoại trong trang khi bấm liên kết rời đi lúc còn thay đổi; `Ctrl+Enter` xác nhận và sang bước xếp hồ sơ;
  - AI đang đọc thì hiện tiến độ và tự cập nhật khi xong; AI vừa cập nhật lúc có thay đổi chưa lưu thì hỏi trước khi nạp dữ liệu mới; "Đọc lại trang này" (BE-44); 409 thì tải lại; ngoài phạm vi hiện "Không tìm thấy".
- **Còn lại (FE-22):** trình xem PDF đầy đủ bằng pdf.js. Vùng nguồn chỉ có khi AI giả ghi (`scripts/dev-up.sh ai fake`); AI thật chưa ghi vùng (AI-21) nên trường không có khung. Không có nút "Lưu tạm" lên máy chủ: nháp chỉ ở trình duyệt, ghi lên máy chủ khi xác nhận.
- **Kiểm tra:** E2E nhập ngày sai (31/02/2026) hiện lỗi tại ô, sửa rồi `Ctrl+Enter` sang bước xếp hồ sơ; test đơn vị `review-state.test.ts`.

### FE-24 · Xếp vào hồ sơ ✅ · 2 ngày
- **Đã có (17/11/2026, chạy với API thật):** `tiep-nhan/[documentId]/xep-ho-so/page.tsx`, `features/dossier/file-screen.tsx`, `app/actions/file-dossier.ts`.
  - hồ sơ gợi ý từ `GET /dossiers/suggestions` (BE-63), ô tìm hồ sơ khác theo mã/tên (đợi 300 ms, bỏ kết quả về muộn); hồ sơ không còn nhận giấy tờ (không ở Đang chuẩn bị/Yêu cầu bổ sung) hiện mờ kèm lý do;
  - tạo hồ sơ mới trong hộp thoại, không rời luồng; chỉ liệt kê nhóm thuộc đơn vị của phân công (API từ chối nhóm của đầu mối khác với 403); lỗi hiện ngay trong hộp thoại vì hộp thoại modal làm vùng toast bị vô hiệu;
  - chọn chiều đến/đi/nội bộ; "Lưu" về hộp tiếp nhận; "Lưu và mở PDF tiếp theo" mở thẳng bước đối chiếu của PDF đã đọc xong kế tiếp, hết thì về hộp tiếp nhận;
  - cảnh báo khi giấy tờ chưa đối chiếu xong, liệt kê hồ sơ đã chứa giấy tờ.
- **Còn lại:** gán thành phần hồ sơ thủ tục (`procedureComponentId`) khi hồ sơ có thủ tục; dùng lại form tạo hồ sơ đầy đủ của FE-27 (hộp thoại hiện chỉ có tên, nhóm, ghi chú).
- **Kiểm tra:** E2E tạo hồ sơ mới trong hộp thoại rồi xếp giấy tờ vào. **Chưa kiểm** E2E xếp liên tiếp 3 PDF bằng "Lưu và mở PDF tiếp theo".

### FE-25 · Tách văn bản 🟡 · 2,5 ngày
- **Làm:**
  1. Dải ảnh thu nhỏ; bấm khoảng giữa hai trang để đặt điểm tách.
  2. Gán loại cho từng phần; đánh dấu phụ lục.
  3. Hoàn tác trước khi xác nhận; gọi BE-51.
- **Kiểm tra:** PDF 12 trang tách 4 phần đúng dải trang.

### FE-26 · Danh sách hồ sơ ✅ · 2 ngày
- **Đã có (17–18/11/2026, API thật):** `ho-so/page.tsx` đọc `GET /dossiers`; mọi bộ lọc là form GET trên URL (từ khóa, trạng thái, nhóm hồ sơ, năm, chỉ hồ sơ tôi chủ trì, chỉ hồ sơ quá hạn, sắp xếp theo cột), trang sau dùng con trỏ keyset của API; hạn nội bộ có chip đỏ/vàng (`DueChip`); bảng từ 1280px, dưới đó mỗi hồ sơ một thẻ.
  - **Sắp xếp theo cột** (BE-111): tiêu đề Mã, Tên, Cập nhật, Hạn nội bộ là liên kết đổi cột hoặc đảo chiều, có mũi tên và `aria-sort`; ô chọn "Sắp xếp theo" cho màn hẹp. Hồ sơ chưa có hạn luôn cuối.
  - **Lọc từ liên kết ở màn khác** (không có ô chọn vì cần danh sách người/vị trí): `?nguoi=<mã>` (người chủ trì, kèm chip bỏ lọc), `?vi-tri=<mã>` (gồm vị trí con), `?phong=<mã>`; `?trang-thai=` và `?nhom=` nhận nhiều giá trị cách nhau dấu phẩy.
  - **Xuất danh sách:** liên kết tải CSV theo đúng bộ lọc và thứ tự (`/api/v1/dossiers/export.csv?...`, một GET chỉ mang cookie, phân công theo BE-118); khóa kèm lý do nếu không có `export.create`. Tối đa 10.000 hồ sơ.
  - Logic nằm ở `features/dossier/dossier-filter.ts` (phân tích URL, đổi sang tham số API, có test).
- **Kiểm tra:** gửi đường dẫn có bộ lọc thì mở đúng bộ lọc; E2E `danh-sach-va-phan-cong.spec.ts` (lọc năm, quá hạn, bấm cột đảo chiều, tải CSV có BOM và đúng hồ sơ, chuyên viên không xuất được).

### FE-27 · Tạo, sửa hồ sơ 🟡 · 1,5 ngày
- **Đã có (17/11/2026, API thật):** `ho-so/tao-moi`, `ho-so/[id]/sua`, `features/dossier/dossier-form.tsx` (luật kiểm tra ở `dossier-form-rules.ts`, có test):
  - tên (5–300 ký tự), nhóm hồ sơ gom theo đầu mối (chỉ nhóm phân công đang dùng được tạo: `creatable-groups.ts`), mức tiếp cận, hạn nội bộ `dd/mm/yyyy` không trước hôm nay, năm, cơ quan hình thành, ghi chú; kiểm tra khi rời ô, lỗi của API hiện dưới đúng ô;
  - tạo xong mở tab Giấy tờ của hồ sơ mới; sửa gửi kèm `version`, 409 thì báo "hồ sơ vừa được người khác sửa" và nút Tải lại; hồ sơ không còn ở bước sửa được thì nói rõ thay vì hiện biểu mẫu.
- **Còn lại:** chọn thủ tục hành chính (ô tìm `GET /procedures`, chờ FE-35) và gợi ý thành phần ngay khi chọn nhóm hoặc thủ tục; đổi nhóm hồ sơ (API `PATCH /dossiers/{id}` không nhận nhóm, giấy tờ giữ nguyên) nên màn sửa hiện nhóm chỉ đọc.
- **Kiểm tra:** E2E tạo hồ sơ (qua hộp thoại ở bước xếp hồ sơ); biểu mẫu đầy đủ chưa có E2E riêng.

### FE-28 · Hồ sơ · Tổng quan ✅ · 2 ngày
- **Đã có (17/11/2026, API thật):** khung `ho-so/[id]/layout.tsx` (đầu trang, trạng thái, tab có số giấy tờ, thanh thao tác) và `page.tsx`:
  - danh sách kiểm tra từ `GET /dossiers/{id}/checklist`: hồ sơ theo thủ tục liệt kê từng thành phần (đủ, chưa đối chiếu xong, thiếu), hồ sơ thường liệt kê từng giấy tờ; nói rõ lý do chưa đủ điều kiện trình (`summary.reasons`);
  - thông tin: nhóm, mức tiếp cận, năm, người chủ trì, hạn, vị trí bản giấy (liên kết sang Kho bản giấy), thủ tục, cơ quan hình thành, ghi chú; hồ sơ ngoài phạm vi hoặc mã sai dạng hiện "Không tìm thấy".
- **Còn lại:** "thành phần thiếu có nút mở hộp tiếp nhận lọc sẵn loại giấy tờ" (hộp tiếp nhận chưa lọc theo loại giấy tờ); thời hạn bảo quản (API chi tiết hồ sơ chưa trả).

### FE-29 · Hồ sơ · Giấy tờ ✅ · 1,5 ngày
- **Đã có (17/11/2026, API thật):** `ho-so/[id]/giay-to/page.tsx`, `features/dossier/document-list.tsx`: danh sách theo thứ tự với tình trạng đối chiếu (có liên kết Đối chiếu); chỉ ở bước Đang chuẩn bị / Yêu cầu bổ sung và có `dossier.prepare` mới sửa được: đổi thứ tự bằng nút lên/xuống (đổi chỗ hai giấy tờ trong một lệnh vì API không cho trùng vị trí), đổi chiều đến/đi/nội bộ, gỡ (giấy tờ về hộp tiếp nhận), "Thêm từ hộp tiếp nhận" (hộp thoại liệt kê PDF đã đọc xong, giấy tờ nào lỗi thì báo riêng); "Trích xuất ngay cả hồ sơ" (FE-45); bấm tên mở Chi tiết giấy tờ.
- **Khác kế hoạch:** sắp xếp bằng nút lên/xuống thay cho kéo thả (dùng được bằng bàn phím, đọc được bằng trình đọc màn hình); kéo thả có thể thêm sau.
- **Còn lại:** gán thành phần thủ tục cho giấy tờ; thêm giấy tờ "có sẵn" ngoài hộp tiếp nhận.

### FE-30 · Hồ sơ · Thanh thao tác ✅ · 1,5 ngày
- **Đã có (17/11/2026, API thật):** `components/dossier/action-bar.tsx` lấy mọi nút từ `GET /dossiers/{id}/actions` (bỏ `mockAllowedActions`); nút API khóa vẫn hiện mờ kèm lý do ngay cạnh; nút cần ý kiến mở ô ý kiến cạnh nút, đếm đủ 10 ký tự; gửi qua Server Action `transitionDossier` kèm `version`; thành công thì toast và `router.refresh()`; 409 thì báo "hồ sơ vừa được người khác thay đổi" và tải lại; không có thao tác thì nói hồ sơ đang chờ ai.
- **Kiểm tra:** E2E `e2e/duyet-ho-so.spec.ts`: trình → trưởng phòng trả lại (ý kiến ngắn thì nút Gửi khóa) → trình lại → đạt → văn thư nộp lưu, nhật ký ghi đủ kể cả ý kiến trả lại.

### FE-31 · Hồ sơ · Phân công ✅ · 1 ngày
- **Đã có (18/11/2026, BE-110):** tab chỉ hiện với `dossier.assign`; `phan-cong/page.tsx` + `features/dossier/assign-panel.tsx` + `assign-rules.ts` (có test). Danh sách chuyên viên của phòng từ `GET /dossiers/{id}/assignees`, gõ tên không dấu để lọc, mỗi người kèm "Đang giữ N hồ sơ, M quá hạn" và liên kết "Xem hồ sơ" (`/ho-so?nguoi=…`); người đang chủ trì có nhãn. Hạn không trước hôm nay (giờ Việt Nam, `min` của ô ngày + kiểm lại trước khi gửi); **đổi sang người khác bắt buộc ghi lý do ≥ 10 ký tự**, chỉ đổi hạn cho cùng người thì không bắt buộc. Gửi bằng Server Action `assignDossier` (`PUT /dossiers/{id}/assignment`), lỗi theo ô hoặc kèm Mã lỗi. Hồ sơ đã lưu trữ khóa.
- **Lưu ý:** danh sách chỉ gồm người có phân công **riêng** còn hiệu lực ở đúng phòng (khớp `assign_dossier`); người chỉ có ủy quyền không có trong danh sách.
- **Kiểm tra:** E2E `danh-sach-va-phan-cong.spec.ts` (danh sách hiện, lọc tên, hạn quá khứ bị chặn ở giao diện, lưu hạn hợp lệ, đầu trang cập nhật, chuyên viên không có tab). **Chưa thử đổi sang người khác trong E2E** vì CSDL dev chỉ có một chuyên viên ở Hạ tầng (`dev_admin`); phần đó có test ở backend và test quy tắc ở `assign-rules.test.ts`.

### FE-32 · Hồ sơ · Nhật ký ✅ · 0,5 ngày
- **Đã có (17/11/2026, API thật):** `ho-so/[id]/nhat-ky/page.tsx` đọc `GET /dossiers/{id}/history`: việc gần nhất ở trên, mỗi dòng có người, vai trò, loại sự kiện, chuyển từ bước nào sang bước nào, thời điểm (giờ Việt Nam) và ý kiến; lọc theo loại sự kiện và "Hiện thêm" nằm trên URL.
- **Còn lại:** API trả toàn bộ nhật ký một lần (chưa phân trang phía API), nên "Hiện thêm" chỉ cắt phía máy chủ Next.

### FE-33 · Chi tiết giấy tờ 🟡 · 2 ngày
- **Đã có (17–18/11/2026, API thật):** `giay-to/[id]/page.tsx`: trình xem bản gốc mở đúng trang theo `?trang=` và đúng phiên bản theo `?tep=`; thông tin (loại, nhóm, tình trạng, tệp, SHA-256, **người** và thời điểm xác nhận đầu văn bản); các hồ sơ chứa giấy tờ trong phạm vi; kết quả kiểm tra kỹ thuật chữ ký số; liên kết văn bản (phụ lục, thay thế, sửa đổi, trả lời); tải tệp gốc (`DownloadButton`).
  - **Phiên bản tệp** (BE-113, `features/document/file-versions.tsx`): bản gốc, bản thay thế, bản dẫn xuất, bản ký số; nhãn Hiện hành và Đã hủy nội dung; người nạp, dung lượng, trang; "Xem" mở đúng bản đó.
  - **In** (BE-113): liên kết thường mở `?purpose=print` ở thẻ mới (phân công theo cookie, BE-118), chỉ hiện với `document.print`; mỗi lần mở ghi một dòng nhật ký `print`. Không dùng fetch + blob vì CSP của trang không cho trình xem PDF hiện bản blob.
  - **Trường dữ liệu cho mọi người có quyền xem** (BE-119, `GET /documents/{id}/fields`): giá trị đã đối chiếu, nhãn Đã đối chiếu / Chưa đối chiếu / Đã sửa / Nhập tay, người đối chiếu, liên kết "Trang N · chỉ vùng"; người có quyền sửa thấy thêm giá trị AI đã đọc. Trưởng phòng và lãnh đạo (chỉ có `document.view`) giờ thấy trường.
- **Còn lại:** thêm, gỡ liên kết văn bản (API đã có: `POST/DELETE /documents/{id}/relations`); thao tác tạo bản thay thế (BE-126 chưa làm, chờ quyết định).
- **Kiểm tra:** từ Tra cứu bấm kết quả mở đúng trang trúng; đã thử với trưởng phòng (thấy trường, không có nút In) và văn thư (có In, một dòng nhật ký, chuyên viên bị 403). **Chưa thử** in thật bằng trình duyệt có bộ xem PDF (chỉ kiểm phản hồi: 200 `application/pdf`, mở tại chỗ, không Range).

### FE-34 · Tra cứu ✅ · 2 ngày
- **Đã có (17–18/11/2026, API thật):** `tra-cuu/page.tsx`: từ khóa, phạm vi (giấy tờ/hồ sơ), nhóm hồ sơ, hình thức văn bản, ban hành từ ngày/đến ngày, **cơ quan ban hành** đều nằm trên URL (form GET); đoạn trích tô đậm bằng `<mark>` (`features/search/highlight.ts`) kèm số trang trúng; số giấy tờ và hồ sơ tìm thấy trong phạm vi.
  - **Phân trang** (BE-112): "Trang sau →" và "← Về trang đầu" dùng con trỏ `con-tro` trên URL; tổng số không đổi giữa các trang. Địa chỉ dựng ở `features/search/search-url.ts` (có test; không dùng khóa `trang` vì đã dùng để mở đúng trang của giấy tờ).
  - **Cơ quan ban hành:** gõ tên (không dấu cũng được) hoặc mã; chỉ lọc giấy tờ nên bỏ phần hồ sơ (có ghi chú dưới ô).
- **Kiểm tra:** gõ "to khai khai sinh" (không dấu) ra "Tổ khai đăng ký khai sinh" có tô đậm. **Chưa có E2E** cho phân trang.

### FE-35 · Thủ tục hành chính 🟡 · 2 ngày
- **API sẵn (18/11/2026):** BE-122 lọc `GET /procedures?level=` và `GET /procedures/levels` (đã gộp "Cấp xã"/"Cấp Xã").
- **Làm:** danh sách, lọc, chi tiết thành phần, tải mẫu (BE-33); thủ tục bãi bỏ có cảnh báo; nút “Tạo hồ sơ theo thủ tục này”.
- **Kiểm tra:** thay được trang `data/official-forms/index.html` của bản thí điểm.

### FE-36 · Kho bản giấy, mượn trả 🟡 · 3 ngày
- **Đã có (18/11/2026, BE-111):** `kho-ban-giay/page.tsx` (cây vị trí kho › phòng › tủ › kệ › hộp, mỗi dòng kèm số hồ sơ **cộng dồn cả vị trí con**; ô tìm nhận nội dung mã QR từ đầu đọc mã vạch: đúng mã thì mở thẳng vị trí, không thì lọc theo mã/tên/đường dẫn không dấu) và `kho-ban-giay/[locationId]/page.tsx` (đường dẫn đầy đủ, mã QR SVG nạp qua `<img>` nhờ BE-118, vị trí con, các hồ sơ đang ở đó kể cả vị trí con, "In nhãn QR"). Số hồ sơ bấm được ra `/ho-so?vi-tri=<mã>` cùng đúng con số. `features/storage/` có test (lọc, cộng dồn, chống vòng).
- **Còn lại:** thêm/sửa/ngừng dùng vị trí; chuyển vị trí hồ sơ (`PUT /dossiers/{id}/location`, chỉ đặt ở cấp hộp hoặc kệ); in nhãn hàng loạt; mượn trả theo tab (BE-83).
- **Kiểm tra:** quét QR mở đúng hộp (đã thử: trang trả `meta refresh` tới đúng vị trí vì `loading.tsx` làm trang stream); cây và trang vị trí và danh sách lọc cùng ra đúng 2 hồ sơ. **Chưa có E2E** cho màn kho. CSDL dev có cây thử `E2E-KHO` (xóa được bằng cách ngừng dùng).

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
- **API sẵn (18/11/2026):** BE-124 phân trang `GET /notifications?cursor=` → `nextCursor`.
- **Lưu ý:** API đẩy thông báo qua SSE `notification.created` (không có SignalR); nghe bằng `useServerEvent`.
- **Làm:** danh sách (BE-70), đánh dấu đã đọc, đánh dấu tất cả; chuông cập nhật qua SSE; bấm thông báo mở đúng hồ sơ.
- **Kiểm tra:** thông báo mới đến trong 1 giây.

### FE-41 · Lô quét và lỗi ảnh 🟡 · 2 ngày
- **API sẵn (18/11/2026):** BE-125 `POST /intake/batches/{id}/close`: không thân → 409 kèm số lỗi (hiện cảnh báo); gửi `{ acceptOpenIssuesNote }` (từ 10 ký tự) → chấp nhận bỏ qua mọi lỗi đang mở và đóng lô trong một lần.
- **Làm:** danh sách lô, tạo lô, chi tiết lô, bảng lỗi ảnh theo trang, đánh dấu đã quét lại (BE-40, BE-53).
- **Kiểm tra:** đóng lô còn lỗi thì hiện cảnh báo nhưng vẫn cho đóng.

### FE-42 · Tài khoản, người dùng, phân công 🟡 · 2,5 ngày
- **API sẵn (18/11/2026):** BE-121 `expiringAssignments`, `nextAssignmentEndsAt`, `endsSoon`, `GET /admin/users?expiring=true` (chip vàng); BE-123 `GET /me/logins` (mục "Lịch sử đăng nhập gần đây" của trang Tài khoản).
- **Làm:** trang tài khoản (BE-30); quản trị người dùng, phân công có thời hạn và căn cứ, ủy quyền, khóa tài khoản (BE-34).
- **Kiểm tra:** phân công sắp hết hạn (≤ 7 ngày) có chip vàng.

### FE-43 · Quản trị danh mục 🟡 · 2,5 ngày
- **Làm:** cây danh mục; sửa nhóm, loại, trường; xác nhận; ngừng dùng; thời hạn bảo quản (BE-32, BE-35).
- **Kiểm tra:** ngừng dùng loại đã có giấy tờ, không có nút xóa.

### FE-44 · Quản trị vận hành 🟡 · 2 ngày
- **API sẵn (18/11/2026):** BE-120 `GET /admin/ai/jobs`, `POST /admin/ai/jobs/{id}/cancel|retry` cho `processing.manage` (không cần phạm vi giấy tờ; `/jobs/{id}` của người dùng luôn 404 với quản trị). Mỗi dòng có `canCancel`, `canRetry`, `retryBlockedReason` để khóa nút kèm lý do.
- **Làm:** hàng đợi AI, đọc lại hoặc hủy job, mô hình, sao lưu, cài đặt (BE-88, BE-89); liên kết công cụ thử nghiệm SAM 3.
- **Kiểm tra:** chỉ `technical_admin` thấy.

### FE-45 · Khay chờ AI và "Trích xuất ngay" ✅ · 1,5 ngày (đã nối API thật cùng FE-21, 17/11/2026)
- **Phụ thuộc:** BE-97, BE-98, BE-99. Thiết kế mức ưu tiên ở `docs/tasks/ai.md`.
- **Trạng thái 17/11/2026:** `tsc`, `eslint`, `next build` sạch; đã bấm thử bằng Chromium (Playwright) với `HOSO_MOCK=1`: nút "Trích xuất ngay", "Trích xuất lại" và "cả hồ sơ" chạy Server Action, kết quả hiện cạnh nút, không có lỗi trình duyệt. **Chưa thử với API thật** (hộp tiếp nhận còn dữ liệu mẫu cho tới FE-21):
  - `lib/ai-queue.ts` (nhãn khay, thời gian chờ, tóm tắt kết quả);
  - Server Action `app/actions/ai-extract.ts` (gọi BE-98; ở chế độ giả lập trả kết quả mẫu; lỗi 403/404/409/422/429 thành thông báo cạnh nút);
  - `features/intake/extract-now-button.tsx`, `ai-status.tsx`;
  - gắn vào hộp tiếp nhận, màn đối chiếu, tab Giấy tờ của hồ sơ, trang vận hành (`features/ops/ai-queue-panel.tsx`).
  Hộp tiếp nhận đã đọc dữ liệu thật từ 17/11/2026 (FE-21): cột tình trạng, bộ lọc theo tình trạng đọc, nút "Trích xuất ngay"/"Trích xuất lại"/"Đọc lại" theo trạng thái dòng, tiến độ qua SSE.
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

## Bổ sung sau rà soát 17/11/2026

Tìm ra khi đối chiếu frontend với `nghiep-vu-vai-tro.html`, docs/05, docs/06, docs/07 và toàn bộ endpoint API.

### FE-46 · Thông báo phiên ✅ · 0,5 ngày
- **Lỗi đã sửa:** cookie `hoso_assignment` trỏ tới phân công không còn dùng được (hết hạn, bị thu hồi, hoặc của người đăng nhập trước trên cùng máy) làm `/me` trả 403. Trước đây giao diện coi như chưa đăng nhập và đẩy về `/dang-nhap`; đăng nhập lại không xóa cookie nên kẹt vòng.
- **Đã có:**
  - `getSessionState()` (`lib/auth/session.ts`): gặp `assignment_not_allowed` thì bỏ header phân công cho cả request (`lib/api/request-state.ts`) và dùng phân công mặc định; `SessionNotices` xóa cookie và báo "Phân công bạn chọn trước đó không còn hiệu lực";
  - `/me` trả `mfaRequired` (BE-95): thanh báo kèm liên kết `/api/v1/auth/login?mfa=true`;
  - tài khoản chưa có phân công (`no_assignment`): trang đăng nhập hiện lời giải thích và nút đăng xuất thay vì nút đăng nhập;
  - `LogoutButton`: xóa cookie phân công trước khi gửi form đăng xuất.
- **Kiểm tra:** đã thử bằng trình duyệt với API thật (cookie phân công giả, đăng nhập dev `mfa=false` rồi chọn phân công văn thư, đăng xuất).

### FE-47 · Bảng tổng hợp cho lãnh đạo ✅ · 1,5 ngày
- **Đã có (18/11/2026, BE-115):** `features/workspace/leadership-overview.tsx` hiện đầu màn Việc của tôi cho Chủ tịch UBND (bảng theo phòng, kể cả phòng chưa có hồ sơ) và lãnh đạo HĐND (ba lối vào: kỳ họp và nghị quyết, thẩm tra của các Ban, giám sát và kiến nghị, thêm dòng hoạt động khác khi có). Cột: Đang chuẩn bị, Chờ kiểm tra, Chờ ý kiến, Chờ nộp lưu, Quá hạn (đỏ khi > 0, nằm trong Đang xử lý), Đang xử lý; dòng Tổng cộng. Danh sách việc được trình vẫn là hàng "Chờ bạn cho ý kiến" bên dưới.
  - Bấm một số mở danh sách hồ sơ đúng con số đó (`leadership-links.ts`, có test; đã đối chiếu: ô "Hạ tầng · Đang chuẩn bị" = 9 và danh sách ra 9); số 0 không có liên kết.
- **Cần xác nhận nghiệp vụ:** cách gom nhóm hồ sơ HĐND vào ba lối vào (H01–H02, H03–H04, H05–H08, còn lại là "khác") do tôi đề xuất, nằm ở `HdndActivities` (backend). CSDL dev hiện không có hồ sơ HĐND nên bảng HĐND mới thấy toàn số 0.
- **Nguồn:** `nghiep-vu-vai-tro.html` mục 05.

### FE-48 · Đi trong danh sách bằng bàn phím 🟡 · 0,5 ngày
- **Đã có (18/11/2026):** `components/ui/row-navigation.tsx` (có test): ↑ ↓ chuyển giữa các dòng, Home/End về đầu/cuối, Enter mở (dòng là liên kết nên Enter có sẵn). Gắn trình nghe phím cho cả trang, chỉ chiếm phím khi trang có liên kết `a[data-row]` đang hiện; nhường phím cho ô nhập, danh sách chọn, hộp thoại và mọi tổ hợp có Ctrl/Alt/⌘/Shift. Dòng đánh dấu bằng `data-row` ở danh sách hồ sơ (bảng và thẻ), tra cứu, hàng việc ở Việc của tôi và hồ sơ trong vị trí kho.
- **Còn lại:** hộp tiếp nhận (dòng dùng `ButtonLink`, chưa nhận thuộc tính `data-row`) và danh sách thông báo (FE-40 chưa có danh sách). **Chưa thử bằng trình duyệt thật**, mới có test jsdom.

## Sau khi xong các màn

| ID | Task | Ngày |
|---|---|---|
| MG-04 | Chuyển `index.html`, `nghiep-vu-vai-tro.html` vào `public/nghien-cuu/` dạng tĩnh, liên kết từ trang đăng nhập | 0,5 |
| SEC-04 | Quy tắc lint an toàn: cấm `dangerouslySetInnerHTML`, `eval`, import `server-only` vào client; Server Action phải qua `runAction`/`requireSession` (docs/05) | 0,5 |
| LOG-04 | Gửi lỗi máy chủ Next sang GlitchTip (gộp với FE-11) | 1 |
| LOG-08 ✅ | Màn Nhật ký hệ thống `/quan-tri/nhat-ky` (18/11/2026, BE-88, BE-117): ba cách xem (Mã lỗi, Truy cập, Thay đổi dữ liệu), bộ lọc trên URL (mã lỗi, mã tương quan, đối tượng, khoảng ngày giờ Việt Nam), phân trang theo id. Tra Mã lỗi (không phân biệt hoa thường) ra request, người, mã tương quan và các lần truy cập cùng request; mã sai định dạng hoặc không có đều có thông báo riêng. Nhật ký thay đổi chỉ hiện tên cột, không giá trị. Đã thử với một lỗi thật. Chưa làm: xuất CSV, lọc theo người (cần ô chọn người) | 1,5 |
| QA-02 | E2E đủ kịch bản theo vai trò trong `nghiep-vu-vai-tro.html` | 3 |
| QA-05 | Kiểm tra tiếp cận (axe + bàn phím) 10 màn chính | 1 |
| OPS-01 | Docker image `node .next/standalone/server.js` (không dùng `next start` với `output: standalone`), chạy không phải root | 0,5 |


## Hợp đồng backend cập nhật 17/11/2026 (BE-103, BE-107)

Các trang `tiep-nhan` và đối chiếu đang dùng dữ liệu mẫu, chưa có nơi gọi inbox thật cần đổi trong đợt backend này. Khi nối API:

- Inbox nhận `{ items, nextCursor }` từ `GET /intake/inbox`, mặc định 50, tối đa 200; nút tải thêm dùng `cursor=nextCursor`, reset cursor khi đổi bộ lọc. Không coi phản hồi là mảng.
- Màn đối chiếu cần cho người dùng kiểm tra và xác nhận tiêu đề, hình thức, số văn bản, ngày ban hành qua `PUT /documents/{id}/metadata` kèm `version` mới nhất. Hiển thị người/thời điểm/ghi chú xác nhận; khi 409 tải lại dữ liệu để người dùng kiểm tra.
- `needs_review` ở metadata làm checklist/actions chưa sẵn sàng dù các trường OCR đã xác nhận. Nếu sửa giá trị metadata, backend đặt review về `pending`; cần xác nhận giấy tờ lại. Không tự động gọi xác nhận thay người dùng.
- Màn hủy chỉ báo hoàn tất khi trạng thái `executed`. `executing` nghĩa là đã nhận yêu cầu và đang xử lý/thử lại; đọc lại trạng thái, không tự gửi execute lần nữa.

OpenAPI đã xuất lại ở `frontend/src/api/openapi.json`.

**Trạng thái nối (17/11/2026):**
- inbox `{ items, nextCursor }`, nút "Tải thêm", đổi thẻ thì bắt đầu lại: ✅ (FE-21);
- đối chiếu xác nhận đầu văn bản kèm `version`, hiện người/thời điểm/ghi chú, 409 thì tải lại, không tự xác nhận thay người dùng: ✅ (FE-23). API trả `metadataReviewedBy` là mã người dùng, chưa có tên nên màn mới hiện thời điểm và ghi chú;
- màn hủy chỉ báo hoàn tất khi `executed`: ⬜ (FE-39).
