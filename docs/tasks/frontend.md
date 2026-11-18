# Task chi tiết · Frontend Next.js

Next.js 16 (App Router, React 19, render phía máy chủ), Tailwind 4. Đường dẫn tệp tính từ `frontend/`. Quy ước giao diện và bản đồ đường dẫn: `docs/07-khung-giao-dien.md`.

**Trạng thái:** ✅ xong · 🟡 đã có khung, cần làm tiếp · ⬜ chưa làm

Khung frontend đã kiểm tra trên máy:
- `tsc` sạch, `eslint` sạch, `next build` không cảnh báo;
- chạy `next start` với `HOSO_MOCK=1` và gọi thử 30 đường dẫn bằng 4 vai trò.

## Quy ước chung

**Trạng thái task:** ✅ xong (còn lại chỉ là mục ghi "Còn lại", không chặn dùng); 🟡 làm dở (đã chạy với API thật một phần); ⬜ chưa làm (mới có khung trang `ScaffoldPage`, không gọi API).

**Lấy dữ liệu:** trong Server Component bằng `serverApi()` có kiểu theo `schema.d.ts` (`src/lib/api/server.ts`, FE-06). Hàm này tự chuyển tiếp cookie phiên, `X-Assignment-Id`, `X-Correlation-Id`. `apiFetch<T>` viết tay chỉ còn ở chỗ cũ, không dùng cho mã mới. Không gọi API từ `useEffect` chỉ để hiện dữ liệu lúc mở trang.

**Ghi dữ liệu:** dùng Server Action bọc bằng `runAction(tên, handler)` (`src/lib/actions.ts`, FE-07): kiểm phiên, bắt `ApiError`, trả `{ ok, data }` hoặc lỗi theo ô; phía client gọi qua `useServerAction` (hết phiên thì về `/dang-nhap?tiep=`, lỗi hiện toast kèm Mã lỗi). Sau khi ghi gọi `router.refresh()`, `revalidatePath` hoặc `redirect`. Form một lần gửi vẫn có thể dùng `useActionState`.

**Tệp lớn và tiến độ:** trình duyệt gọi thẳng `/api/v1/...` cùng origin, kèm header `X-CSRF: 1`. Gồm tải PDF lên và luồng SSE.

**Kiểm tra quyền:** dùng `pageSession(quyền)` ở đầu trang. Đây chỉ để giao diện gọn; quyền thật do API kiểm tra.

**Đặt tên:**
- đường dẫn tiếng Việt không dấu, tạo bằng `routes.*`;
- tên component tiếng Anh;
- chữ trên giao diện tiếng Việt, viết từ góc nhìn người dùng.

**Mỗi màn hình phải có:** trạng thái đang tải, rỗng, lỗi; dùng được bằng bàn phím; không cuộn ngang ở 768px.

**Khi làm thật một màn:** xóa `PlannedScreen`/`ScaffoldPage` và dữ liệu `lib/mock` của màn đó. Dữ liệu mẫu chỉ được hiện khi `serverEnv().mock`; ở chế độ thật mà chưa nối API thì hiện `NeedsRealApi`, **không bao giờ hiện dữ liệu giả cho người dùng thật** (rà soát 18/11/2026 bắt được trang Thông báo vi phạm).

---

## Cập nhật tối 18/11/2026

**Số liệu hiện tại (cuối ngày 18/11/2026):** 38 ✅ · 3 🟡 (FE-01 CI chưa chạy trên GitHub, FE-05 Keycloak thật, FE-11 GlitchTip) · 0 ⬜ trên 41 task (sáng cùng ngày còn 33 ✅ · 8 🟡); không trang nào còn khung `ScaffoldPage` (`components/ui/scaffold-page.tsx` không còn nơi dùng). Mục "Rà soát tổng thể" ngay dưới là bản sáng cùng ngày: số liệu (20/13/8) và "thứ tự đề xuất" trong đó **đã lỗi thời**, chỉ giữ làm lịch sử các lỗi đã bắt được.

**Luồng AI (tối 18/11):** AI thật chạy qua Ollama ở máy Windows (docs/tasks/ai.md, AI-22) và ghi vùng nguồn cho trường (AI-21); màn đối chiếu và chi tiết giấy tờ làm nổi vùng đó. Màn đối chiếu nay xử lý `sourceFileId` (`regionTarget` ở `features/review/source-region.ts`, có test): vùng của lần đọc cũ nằm trên bản quét đã thay thì không vẽ khung lên bản hiện hành, nói rõ và dẫn tới `giay-to/{id}?tep=`.

## Rà soát tổng thể 18/11/2026 (buổi sáng, lịch sử)

**Kiểm chứng:** `tsc`, `eslint`, `next build` sạch; Vitest 119/119; E2E tích hợp **9/9 đạt trong một lượt** (stack thật, AI giả). Trạng thái: **20 ✅ · 13 🟡 · 8 ⬜** trên 41 task (đối chiếu từng trang với mã, không theo ghi chú cũ).

**Đổi trạng thái:** FE-25, 35, 37, 38, 39, 40, 41, 43 từ 🟡 xuống ⬜: các trang này chỉ có khung (`ScaffoldPage`), chưa gọi API nào. FE-42 giữ 🟡 (trang Tài khoản đã hiện phân công thật), FE-44 giữ 🟡 (khối số việc theo khay AI).

**Lỗi tìm thấy và đã sửa:**
- `/thong-bao` hiện thông báo GIẢ (`MOCK_NOTIFICATIONS`) cả khi chạy API thật; nay chỉ ở chế độ giả lập (FE-40).
- Liên kết "Trang N · chỉ vùng" ở Chi tiết giấy tờ không biết vùng nằm trên bản quét nào; nay mở đúng bản (`?tep=`) khi `sourceFileId` khác bản hiện hành, kèm "(bản quét N)" (FE-33, sau BE-126).

**Task thay đổi do backend 18/11 (BE-120…126):** FE-22/23 (khung vùng nguồn theo `sourceFileId`), FE-33 (nút Thay bản quét, lý do thay), FE-35 (lọc cấp thực hiện), FE-40 (phân trang), FE-41 (đóng lô kèm chấp nhận lỗi, thay bản quét đóng lỗi), FE-42 (chip sắp hết hạn, lịch sử đăng nhập), FE-44 (hủy/chạy lại việc AI). Mọi màn ⬜/🟡 đều **đã có đủ API**; không màn nào còn bị backend chặn.

**API còn thiếu (đã xử lý tối 18/11/2026):** lọc hộp tiếp nhận theo lô, tình trạng đọc, nhóm, loại giấy tờ → BE-129 ✅ (giao diện nối ở FE-21; lọc theo loại giấy tờ mới có API, chưa có ô chọn); thời hạn bảo quản trong chi tiết hồ sơ → BE-130 ✅ (hiện ở FE-28); phân trang nhật ký hồ sơ → **quyết định không làm** (xem FE-32).

**Thứ tự đề xuất cho phần còn lại** (~14 ngày cho các màn ⬜, chưa tính phần dở của 🟡): FE-40 Thông báo (1) → FE-41 Lô quét (2) → FE-35 Thủ tục (2, mở khóa chọn thủ tục ở FE-27) → FE-44 Vận hành → FE-42 Người dùng → FE-37/38/39 Nộp lưu, Xuất dữ liệu, Đề nghị hủy (4) → FE-43 Danh mục (2,5) → FE-25 Tách văn bản (2,5). Hạ tầng (FE-01 CI, FE-05 Keycloak thật, FE-10 E2E đủ 6 vai trò, FE-11 GlitchTip) làm song song khi có môi trường.

## P5 · Nền tảng

### FE-01 · Khởi tạo dự án 🟡 · 0,5 ngày
- **Đã có:**
  - Next 16.4.6, React 19.3, TypeScript strict, ESLint, Tailwind 4;
  - `typedRoutes`, `output: standalone`;
  - tắt `cacheComponents`;
  - `.env.example`;
  - (17/11/2026) Vitest 3 + Testing Library + jsdom (`vitest.config.ts`), Playwright 1.64 + `@axe-core/playwright` (`playwright.config.ts`, thư mục `e2e/`), Prettier (`.prettierrc.json`);
  - script `typecheck`, `test`, `test:watch`, `test:e2e`, `gen:api`, `format`; `engines.node >= 22`.
- **Đã có (18/11/2026 tối):** `.github/workflows/ci.yml` chạy frontend (`typecheck`, `lint`, `test`, `build` với `HOSO_MOCK=1`, `npm audit --omit=dev --audit-level=high`, E2E giả lập), backend (build không cảnh báo, test với PostgreSQL 16 dịch vụ) và worker AI (test với AI giả). Đã tập dượt cục bộ: `npm audit` 0 lỗ hổng, `next build` qua, job worker chạy trong venv sạch (143 qua), YAML hợp lệ. **Chưa chạy trên GitHub Actions**, nên chưa biết có bước nào cần chỉnh theo môi trường runner.
- **Còn lại:** xem CI chạy xanh lần đầu sau khi đẩy mã; chạy `npm run format` một lần cho cả cây mã trong **commit riêng** (chưa chạy để diff không lẫn việc khác).
- **Kiểm tra:** `npm run typecheck && npm run lint && npm test && npm run build` chạy được cục bộ (đã chạy 17/11/2026).

### FE-02 · Token giao diện ✅ · 1 ngày
- **Đã có:** `src/app/globals.css` (`@theme`: màu theo `government-theme.css`, màu trạng thái riêng, font hệ thống để build được khi không có internet).
- **Còn lại:** nếu cần chế độ tối, thêm token tối theo đúng cấu trúc biến (không bắt buộc cho bản đầu).

### FE-03 · Bộ thành phần ✅ · 3 ngày
- **Đã có:** `Button`, `ButtonLink`, `Chip`, `WorkflowChip`, `PageHeader`, `Section`, `EmptyState`, `TabsNav`, `Stepper`, `ErrorPanel`, `NoAccess`, `NeedsRealApi`; (17/11/2026) `Dialog` (phần tử `<dialog>` gốc: bẫy tiêu điểm, Esc, nền bị vô hiệu), `Toast` (có nút hành động như "Hoàn tác", lỗi kèm Mã lỗi, `role=alert`), `ConnectionBanner`.
- **Đã làm (18/11/2026 tối):** `components/ui/field.tsx` (`Field`, `FieldError`: nhãn, gợi ý, lỗi nối ô bằng `aria-describedby`, `aria-invalid`), `input.tsx` (`Input`, `Textarea` có bộ đếm ký tự, `Select`, `DateInput` nhập `dd/mm/yyyy` và đổi `-`, `.` thành `/`), `combobox.tsx` (`Combobox` theo mẫu WAI-ARIA: ↓ ↑ Enter Esc, báo số kết quả cho trình đọc màn hình, Esc không đóng hộp thoại chứa nó), `confirm-inline.tsx` (`ConfirmInline`: hỏi hai bước tại chỗ, tiêu điểm vào "Hủy"). Ngày dùng chung `lib/vi-date.ts`. Dùng thật ở form tạo hồ sơ, hộp thoại tạo hồ sơ ở bước xếp hồ sơ và bộ chọn thủ tục.
- **Không làm, có chủ ý:** `DataTable` và `Pagination` dùng chung: mỗi bảng hiện có (hồ sơ, hộp tiếp nhận, giấy tờ, nhật ký…) khác nhau về cột, con trỏ phân trang và hành vi dòng, gom lại lúc này chỉ thêm rủi ro hồi quy mà không gỡ được việc nào đang chờ. Làm khi có màn mới thứ ba cần cùng một khuôn. Không dùng Radix UI: `Combobox` tự viết theo mẫu ARIA và có test bàn phím; `Dialog` vẫn là `<dialog>` gốc.
- **Kiểm tra:** `controls.test.tsx` (22 ca: nhãn và lỗi đọc đúng, bàn phím, tiêu điểm), `procedure-picker.test.tsx`; axe quét mọi màn trong menu ở `vai-tro.spec.ts` và `mock-vai-tro.spec.ts`.

### FE-04 · Khung trang và menu ✅ · 1,5 ngày
- **Đã có:**
  - `AppShell`: sidebar theo quyền, ngăn kéo cho màn hẹp, thanh trên;
  - `CommandPalette` (Ctrl+K, `/`, gõ không dấu);
  - `AssignmentSwitcher`, liên kết bỏ qua menu;
  - `config/navigation.ts`, `config/routes.ts`;
  - `loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`.
- **Đã làm thêm 17/11/2026:** số đếm trên menu và chuông lấy từ `GET /workspace/summary` khi chạy thật (`(app)/layout.tsx`); thanh trên gọn ở 768–1279px (nút Đi nhanh chỉ hiện từ 1024px, tên người dùng từ 1280px).
- **Đã làm (FE-40):** chuông tăng theo SSE `notification.created` (E2E `thong-bao.spec.ts`).

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
- **Đã làm (18/11/2026 tối):** `app/actions/ai-extract.ts` gọi qua `serverApi()` có kiểu, phản hồi đi qua `toExtractResult` (giá trị lạ về `skipped`, có test); `quan-tri/van-hanh/page.tsx` đã bỏ `apiFetch` từ trước. **Giữ có chủ ý** ở `getSession`: `Session.permissions` là union `Permission` hẹp hơn chuỗi tự do của schema nên vẫn phải ép kiểu, đã ghi lý do ở mã.
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
- **Đã làm:** `notification.created` tăng số trên chuông (FE-40); `dossier.changed` gọi `router.refresh()` khi đang xem đúng hồ sơ đó (`RefreshOnEvents dossierId`, ở layout `ho-so/[id]`).
- **Kiểm tra:** E2E thấy bảng hộp tiếp nhận đổi sang "Đã đọc xong" không cần tải lại. **Chưa kiểm** kịch bản tắt mạng 30 giây rồi bật lại.

### FE-09 · Trạng thái trên URL ✅ · 0,5 ngày
- **Đã có:** bộ lọc là form GET (`/ho-so?q=&trang-thai=`, `/tiep-nhan?trang-thai=`, `/tra-cuu?q=`), tab là đường dẫn.
- **Còn lại:** áp dụng cho các màn mới.

### FE-10 · Hạ tầng kiểm thử ✅ · 1 ngày
- **Đã có (17/11/2026):**
  - Vitest: `npm test` (18/11/2026: 119 test trong 21 tệp: logic đối chiếu, hàng đợi tải lên, tiến độ hộp tiếp nhận, bộ đọc SSE, ProblemDetails, nhãn khay AI, Toast, bộ lọc danh sách hồ sơ, phân công, tra cứu, vùng nguồn, nhật ký, kho, bảng lãnh đạo, đi bằng bàn phím);
  - E2E tích hợp: 9 kịch bản trong 5 tệp (`tiep-nhan`, `duyet-ho-so`, `danh-sach-va-phan-cong`, `vung-nguon`, `phien`);
  - Playwright 1.64 + axe: `e2e/fixtures.ts` (`signIn` theo vai trò qua dev-login, `samplePdf`, `watchConsole` bắt lỗi CSP, `expectAccessible`), `playwright.config.ts` có hai chế độ qua `E2E_MODE`.
- **Đã làm (18/11/2026 tối):** (1) **chế độ giả lập tự chạy:** `playwright.config.ts` có `webServer` (`next dev` cổng 3100, `HOSO_MOCK=1`, thư mục build riêng `.next-mock` vì Next 16 không cho hai `next dev` cùng `.next`), không cần API; `E2E_MODE=mock` là mặc định. (2) **fixture đủ 6 vai trò** (`ROLES`: employee, manager, clerk, chair, council, technical_admin). (3) **ma trận vai trò:** `vai-tro.spec.ts` (API thật) và `mock-vai-tro.spec.ts` (giả lập, 7 ca, ~13 giây): mỗi vai trò thấy đúng các mục menu theo quyền (một nguồn `config/navigation`), mở từng màn trong menu không lỗi 5xx, không lỗi console/CSP, **axe WCAG 2 A/AA không lỗi nghiêm trọng** (mỗi màn quét một lần). (4) CI: `.github/workflows/ci.yml` chạy E2E giả lập (chưa chạy trên GitHub, xem FE-01).
- **Giới hạn:** axe quét các màn trong menu, chưa quét mọi màn con (chi tiết giấy tờ, đối chiếu có quét riêng ở `tiep-nhan.spec.ts`).
- **Chạy E2E tích hợp:** xem `frontend/README.md`.

### FE-11 · Log và báo lỗi phía web 🟡 · 1 ngày
- **Đã có:**
  - `lib/log.ts` (JSON, lọc khóa nhạy cảm);
  - `instrumentation.ts` (`onRequestError` kèm digest);
  - `instrumentation-client.ts` (lỗi trình duyệt), `/client-log` (giới hạn kích thước, tần suất, kiểm tra Origin);
  - `ErrorPanel` hiện Mã lỗi.
- **Đã làm (18/11/2026 tối):** `ErrorPanel` hiện **mã lỗi của API**: `ApiError.digest = errorId` và Next giữ nguyên `digest` đặt sẵn (đã đối chiếu mã nguồn Next), nên mã người dùng thấy chính là mã quản trị nhập ở Quản trị › Nhật ký hệ thống › Mã lỗi (BE-117); có nút "Sao chép mã" (`error-panel.test.tsx`, `problem.test.ts`).
- **Còn lại:**
  1. Gửi lỗi sang GlitchTip khi có DSN (LOG-04): cần dựng GlitchTip (LOG-02) và chọn SDK; chưa làm.
- **Kiểm tra:** ném lỗi thử trong một trang thì có dòng `request_failed` với digest trùng mã trên màn hình.

### FE-12 · CSP và header ✅ · 0,5 ngày
- **Đã có:** CSP nonce với `strict-dynamic` trong `proxy.ts`; header tĩnh trong `next.config.ts`; đã kiểm tra bằng `curl`; E2E tiếp nhận (`e2e/tiep-nhan.spec.ts`) kiểm console không có cảnh báo CSP trên các màn nạp, hộp tiếp nhận, đối chiếu, xếp hồ sơ (ảnh trang dùng blob URL, `img-src` đã có `blob:`).
- **Đã làm (18/11/2026 tối):** kiểm CSP trên mọi màn trong menu của cả 6 vai trò (`vai-tro.spec.ts`, `mock-vai-tro.spec.ts` bắt lỗi console và vi phạm CSP).
- **Không áp dụng:** phần pdf.js (cho phép `worker-src 'self' blob:`, đặt `pdf.worker` ở `public/`) vì không dùng pdf.js, xem FE-22. Làm nếu mở lại FE-22.
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
- **Đã làm thêm (18/11/2026):** hàng "Cần bạn làm" có thêm lối **"Chỉ hồ sơ bị trả lại"** (`/ho-so?cua-toi=1&trang-thai=returned`).
- **Kiểm tra:** E2E đăng nhập từng vai trò thấy đúng hàng việc (đã thử văn thư và chuyên viên bằng API thật).

### FE-21 · Hộp tiếp nhận và nạp PDF ✅ · 2 ngày
- **Đã có (17/11/2026, chạy với API thật):**
  - `tiep-nhan/tai-len`: `features/intake/uploader.tsx` kéo thả nhiều tệp, tải 3 tệp song song bằng XHR có tiến độ, hủy từng tệp, thử lại khi lỗi tạm thời, chọn lô quét đang mở (nhớ lô vừa dùng). Tệp sai đuôi, rỗng, quá 200 MB báo ngay tại tệp (`upload-queue.ts`), tệp trùng (409 `duplicate_file`) hiện liên kết tới giấy tờ cũ. Sau khi tải xong, mỗi tệp hiện vị trí trong khay rồi "Đang đọc trang a/b", "Đã đọc xong" qua SSE;
  - `tiep-nhan`: `features/intake/inbox-table.tsx` đọc `GET /intake/inbox` (`{ items, nextCursor }`, không coi là mảng), nút "Tải thêm" dùng `cursor`, đổi thẻ là bắt đầu lại; ba thẻ Chờ xếp / Đã xếp / Đã bỏ; lọc theo tình trạng đọc; "Bỏ" có "Hoàn tác" (toast và thẻ Đã bỏ); tiến độ và thứ tự cập nhật qua SSE.
  - dưới 1280px mỗi PDF hiện thành một thẻ (bảng cần 820px nên ở 1024px có menu trái sẽ đẩy nút ra ngoài); nút "Hủy đọc" cho PDF đang chờ hoặc đang đọc (`POST /jobs/{id}/cancel`, chỉ người tải lên hoặc quản trị hàng đợi).
- **Đã có (18/11/2026 tối, BE-129):** lọc ở máy chủ trên TOÀN hộp, không còn chỉ phần đã tải: nút tình trạng đọc (Chờ trong khay, Đang đọc, Đã đọc xong, Lỗi) kèm số lấy từ `GET /intake/inbox/summary`, ô chọn **lô quét** và **nhóm hồ sơ** do AI gợi ý; bộ lọc nằm trên địa chỉ (`?doc=`, `?lo=`, `?nhom=`; `features/intake/inbox-filter.ts` có test, giá trị lạ bị bỏ). Đang lọc mà không có dòng nào thì vẫn giữ các nút và có "Bỏ bộ lọc". Các chỗ cần "PDF đã đọc xong" (PDF kế tiếp sau khi xếp, đếm ở màn đối chiếu, danh sách ở tab Giấy tờ) nay lọc ở máy chủ thay vì tải 100–200 PDF đầu rồi tự lọc, nên đúng cả khi hộp có nhiều PDF.
- **Đã làm thêm (18/11/2026 tối):** ô lọc **Loại giấy tờ** (hiện khi đã chọn nhóm, `?loai=`; đổi nhóm thì bỏ loại; nhóm không có trong danh sách thì không gọi API lấy loại).
- **Đã làm (19/11/2026): chọn nhiều.** Mỗi PDF (thẻ và dòng bảng) có ô chọn; tiêu đề cột có "Chọn tất cả PDF đang hiện" (trạng thái lưng chừng khi chọn một phần). Khi có PDF được chọn, thanh thao tác dính dưới cùng (vùng "Thao tác với PDF đã chọn") cho: **Xếp N PDF vào một hồ sơ** (`features/intake/bulk-file-dialog.tsx`: tìm hồ sơ, chỉ liệt kê hồ sơ còn sửa được là Đang chuẩn bị hoặc Yêu cầu bổ sung, gửi `addDocuments`), **Bỏ khỏi hộp** (hỏi lại "Bỏ N PDF khỏi hộp tiếp nhận?", rồi toast **Hoàn tác** gọi `restoreMany`) và Bỏ chọn. Tối đa 100 PDF một lần (`discardMany`, `restoreMany` ở `app/actions/intake.ts`, mỗi PDF một lần gọi, PDF lỗi báo riêng). Lô chọn tự bỏ phần không còn hiện khi đổi thẻ, đổi bộ lọc hay sau khi xử lý (`inbox-selection.ts`, có test).
- **Còn lại:** lọc theo người nạp (hộp chỉ của chính mình nên chưa cần).
- **Kiểm tra:** E2E `tiep-nhan-chon-nhieu.spec.ts` (chọn từng cái và chọn tất cả, xếp hai PDF vào một hồ sơ, bỏ rồi hoàn tác); `inbox-selection.test.ts`.
- **Kiểm tra:** E2E `tiep-nhan-loc.spec.ts` (số trên nút khớp tổng hợp, lọc đổi địa chỉ, rỗng vẫn giữ nút, giá trị lạ bị bỏ, ô chọn nhóm và lô).
- **Kiểm tra:** E2E `e2e/tiep-nhan.spec.ts` tải 3 PDF mẫu, thấy "Chờ trong khay"/"Đang đọc" rồi "Đã đọc xong".

### FE-22 · Trình xem PDF ✅ (bản ảnh trang; pdf.js hoãn có điều kiện) · 3 ngày
- **Đã có (18/11/2026, BE-114):** làm nổi vùng nguồn của trường trên ảnh trang. `features/review/page-viewer.tsx` nhận `highlight` (khung đặt theo PHẦN TRĂM của ảnh nên đúng ở cả hai mức phóng; tự cuộn vào giữa khung nhìn; nét liền khi vùng lấy từ khối bố cục, nét đứt kèm lời nhắc khi chỉ ước theo dòng); `features/review/source-region.ts` (kiểm vùng, đổi sang CSS, đọc/ghi `?vung=`, có test). Dùng ở màn đối chiếu (bấm trường: nhảy trang và làm nổi vùng) và chi tiết giấy tờ (`?trang=2&vung=x,y,w,h&truong=…`, liên kết "Trang N · chỉ vùng" ở từng trường).
- **Đã nối (18/11/2026 tối):** vùng nguồn nằm trên **bản cũ** (BE-126, `sourceFileId` khác tệp đang xem): chi tiết giấy tờ mở đúng bản; màn đối chiếu không dựng khung lên bản hiện hành mà hiện "Xem bản quét cũ" (`regionTarget`, có test).
- **Quyết định (18/11/2026): không dùng pdf.js lúc này.** Bản ảnh trang (WebP do API dựng, đổi trang, phóng to, làm nổi vùng nguồn) đủ cho đối chiếu và đã có E2E; pdf.js thêm một thư viện lớn, một worker và phải sửa CSP (FE-12) mà chưa có nhu cầu đo được. **Mở lại khi** có một trong: cần xoay trang bị quét ngang, tài liệu quá dài khiến tải ảnh từng trang chậm (chưa đo PDF 300 trang), hoặc cần chọn chữ/tìm trong trang.
- **Còn lại (nếu mở lại):** Trình xem PDF đầy đủ bằng pdf.js (đọc theo Range từ `/files/{id}/content`, tắt `isEvalSupported`, xoay, ảnh thu nhỏ). Ảnh trang WebP hiện đủ cho đối chiếu; chỉ làm khi cần xoay hoặc tài liệu rất dài. Lưu ý CSP của trang (`object-src 'none'`, khung `blob:` không được phép) khi chọn cách nhúng PDF.
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
- **Còn lại (FE-22):** trình xem PDF đầy đủ bằng pdf.js. **Mới sau BE-126:** trường có `sourceFileId` khác tệp đang xem (vùng nằm trên bản quét cũ) thì không dựng khung trên bản hiện hành; hiện "Vùng này ở bản quét N" kèm liên kết mở Chi tiết giấy tờ `?tep=`. Từ 18/11/2026 tối AI thật cũng ghi vùng nguồn (AI-21): khung chính xác khi trích dẫn trọn một khối OCR hoặc nằm trong lớp chữ PDF, còn lại nét đứt (ước tính, kèm lời nhắc kiểm tra lại); trường không tìm được vùng thì không có khung. Không có nút "Lưu tạm" lên máy chủ: nháp chỉ ở trình duyệt, ghi lên máy chủ khi xác nhận.
- **Kiểm tra:** E2E nhập ngày sai (31/02/2026) hiện lỗi tại ô, sửa rồi `Ctrl+Enter` sang bước xếp hồ sơ; test đơn vị `review-state.test.ts`.

### FE-24 · Xếp vào hồ sơ ✅ · 2 ngày
- **Đã có (17/11/2026, chạy với API thật):** `tiep-nhan/[documentId]/xep-ho-so/page.tsx`, `features/dossier/file-screen.tsx`, `app/actions/file-dossier.ts`.
  - hồ sơ gợi ý từ `GET /dossiers/suggestions` (BE-63), ô tìm hồ sơ khác theo mã/tên (đợi 300 ms, bỏ kết quả về muộn); hồ sơ không còn nhận giấy tờ (không ở Đang chuẩn bị/Yêu cầu bổ sung) hiện mờ kèm lý do;
  - tạo hồ sơ mới trong hộp thoại, không rời luồng; chỉ liệt kê nhóm thuộc đơn vị của phân công (API từ chối nhóm của đầu mối khác với 403); lỗi hiện ngay trong hộp thoại vì hộp thoại modal làm vùng toast bị vô hiệu;
  - chọn chiều đến/đi/nội bộ; "Lưu" về hộp tiếp nhận; "Lưu và mở PDF tiếp theo" mở thẳng bước đối chiếu của PDF đã đọc xong kế tiếp, hết thì về hộp tiếp nhận;
  - cảnh báo khi giấy tờ chưa đối chiếu xong, liệt kê hồ sơ đã chứa giấy tờ.
- **Đã làm (18/11/2026 tối):** hồ sơ làm theo thủ tục thì có ô **Thành phần của thủ tục** (tên, bắt buộc, đã có bao nhiêu giấy tờ) để gán giấy tờ vào thành phần ngay lúc xếp (`procedureComponentId`, API checklist BE-64); hộp thoại tạo hồ sơ dùng bộ thành phần chung (FE-03) và có **chọn thủ tục** (`ProcedurePicker`). E2E `ho-so-thanh-phan.spec.ts`.
- **Kiểm tra:** E2E tạo hồ sơ mới trong hộp thoại rồi xếp giấy tờ vào. **Chưa kiểm** E2E xếp liên tiếp 3 PDF bằng "Lưu và mở PDF tiếp theo".

### FE-25 · Tách văn bản ✅ · 2,5 ngày
- **Đã có (18/11/2026, API thật, BE-51):** `tiep-nhan/[documentId]/tach-van-ban`, `features/split/` (`split-rules.ts` có test, `split-editor.tsx`, `split-data.ts`), `app/actions/split.ts`.
  - dải ảnh thu nhỏ từng trang (ảnh WebP qua cookie phân công, BE-118); bấm "Tách ở đây" giữa hai trang để đặt điểm tách, "Gộp lại" để gỡ, "Bỏ hết điểm tách" để hoàn tác trước khi xác nhận;
  - giao diện chỉ giữ **điểm tách**; các phần dẫn xuất từ đó nên luôn phủ kín 1..N trang, không chồng, không hở (đúng luật của API; API vẫn kiểm lại);
  - điểm tách AI hoặc lần soạn trước đã đề xuất được nạp sẵn (đề xuất sai luật thì bỏ, bắt đầu lại);
  - mỗi phần đặt tên được (bỏ trống: hệ thống đặt); hộp thoại tóm tắt các phần rồi xác nhận: đề xuất + xác nhận trong một thao tác, sinh các văn bản con vào hộp tiếp nhận, văn bản nguồn chuyển "đã tách" (tệp gốc không bị sửa);
  - mở lại văn bản đã tách thì nói rõ "đã được tách" (không phải "Không tìm thấy").
- **Khác kế hoạch:** API không có "gán loại cho từng phần" hay "đánh dấu phụ lục" ở bước tách (mỗi phần được AI phân loại riêng sau khi vào hộp tiếp nhận; liên kết phụ lục đặt ở Chi tiết giấy tờ, FE-33); không có kéo thả (bấm nút dùng được bằng bàn phím).
- **Kiểm tra:** E2E `tach-van-ban.spec.ts` (PDF 4 trang tự dựng: đặt, thêm, gỡ, bỏ hết điểm tách; đặt tên; xác nhận; nguồn thành `split`, hai văn bản con).

### FE-26 · Danh sách hồ sơ ✅ · 2 ngày
- **Đã có (17–18/11/2026, API thật):** `ho-so/page.tsx` đọc `GET /dossiers`; mọi bộ lọc là form GET trên URL (từ khóa, trạng thái, nhóm hồ sơ, năm, chỉ hồ sơ tôi chủ trì, chỉ hồ sơ quá hạn, sắp xếp theo cột), trang sau dùng con trỏ keyset của API; hạn nội bộ có chip đỏ/vàng (`DueChip`); bảng từ 1280px, dưới đó mỗi hồ sơ một thẻ.
  - **Sắp xếp theo cột** (BE-111): tiêu đề Mã, Tên, Cập nhật, Hạn nội bộ là liên kết đổi cột hoặc đảo chiều, có mũi tên và `aria-sort`; ô chọn "Sắp xếp theo" cho màn hẹp. Hồ sơ chưa có hạn luôn cuối.
  - **Lọc từ liên kết ở màn khác** (không có ô chọn vì cần danh sách người/vị trí): `?nguoi=<mã>` (người chủ trì, kèm chip bỏ lọc), `?vi-tri=<mã>` (gồm vị trí con), `?phong=<mã>`; `?trang-thai=` và `?nhom=` nhận nhiều giá trị cách nhau dấu phẩy.
  - **Xuất danh sách:** liên kết tải CSV theo đúng bộ lọc và thứ tự (`/api/v1/dossiers/export.csv?...`, một GET chỉ mang cookie, phân công theo BE-118); khóa kèm lý do nếu không có `export.create`. Tối đa 10.000 hồ sơ.
  - Logic nằm ở `features/dossier/dossier-filter.ts` (phân tích URL, đổi sang tham số API, có test).
- **Kiểm tra:** gửi đường dẫn có bộ lọc thì mở đúng bộ lọc; E2E `danh-sach-va-phan-cong.spec.ts` (lọc năm, quá hạn, bấm cột đảo chiều, tải CSV có BOM và đúng hồ sơ, chuyên viên không xuất được).

### FE-27 · Tạo, sửa hồ sơ ✅ · 1,5 ngày
- **Đã có (17/11/2026, API thật):** `ho-so/tao-moi`, `ho-so/[id]/sua`, `features/dossier/dossier-form.tsx` (luật kiểm tra ở `dossier-form-rules.ts`, có test):
  - tên (5–300 ký tự), nhóm hồ sơ gom theo đầu mối (chỉ nhóm phân công đang dùng được tạo: `creatable-groups.ts`), mức tiếp cận, hạn nội bộ `dd/mm/yyyy` không trước hôm nay, năm, cơ quan hình thành, ghi chú; kiểm tra khi rời ô, lỗi của API hiện dưới đúng ô;
  - tạo xong mở tab Giấy tờ của hồ sơ mới; sửa gửi kèm `version`, 409 thì báo "hồ sơ vừa được người khác sửa" và nút Tải lại; hồ sơ không còn ở bước sửa được thì nói rõ thay vì hiện biểu mẫu.
- **Đã làm (18/11/2026 tối):** **chọn thủ tục ngay trong form tạo hồ sơ** (`features/dossier/procedure-picker.tsx`, Server Action `app/actions/procedure.ts`): gõ tên không dấu hoặc mã (đợi 300 ms, bỏ kết quả về muộn, không gọi API khi dưới 2 ký tự), thủ tục đã bãi bỏ/thay thế không hiện, chọn xong thấy ngay các thành phần và số bắt buộc, "Bỏ thủ tục" để tạo hồ sơ thường. Form dùng bộ thành phần chung (FE-03); lỗi đưa tiêu điểm tới ô lỗi đầu tiên bằng `aria-invalid`.
- **Giới hạn của API, không phải của giao diện:** `PATCH /dossiers/{id}` không nhận nhóm hồ sơ (giấy tờ đã đối chiếu giữ nguyên) nên màn sửa hiện nhóm chỉ đọc; thủ tục cũng chỉ chọn lúc tạo.
- **Kiểm tra:** `procedure-picker.test.tsx` (6 ca), E2E `ho-so-thanh-phan.spec.ts` (tạo hồ sơ chọn thủ tục, đối chiếu `procedureId` với API) và `thu-tuc.spec.ts` (tạo hồ sơ theo thủ tục từ trang thủ tục).

### FE-28 · Hồ sơ · Tổng quan ✅ · 2 ngày
- **Đã có (17/11/2026, API thật):** khung `ho-so/[id]/layout.tsx` (đầu trang, trạng thái, tab có số giấy tờ, thanh thao tác) và `page.tsx`:
  - danh sách kiểm tra từ `GET /dossiers/{id}/checklist`: hồ sơ theo thủ tục liệt kê từng thành phần (đủ, chưa đối chiếu xong, thiếu), hồ sơ thường liệt kê từng giấy tờ; nói rõ lý do chưa đủ điều kiện trình (`summary.reasons`);
  - thông tin: nhóm, mức tiếp cận, năm, người chủ trì, hạn, vị trí bản giấy (liên kết sang Kho bản giấy), thủ tục, cơ quan hình thành, ghi chú; hồ sơ ngoài phạm vi hoặc mã sai dạng hiện "Không tìm thấy".
- **Đã có (18/11/2026 tối, BE-130):** dòng **Thời hạn bảo quản** ở tab Tổng quan (`features/dossier/retention.ts` có test): số năm và căn cứ pháp lý khi đã xác nhận, ngày đủ hạn khi hồ sơ đã lưu trữ (và nhắc có thể đề nghị hủy khi đã đủ), nói rõ "Chưa xác nhận" khi nhóm mới có đề xuất, "Chưa xác định" khi nhiều quy tắc chưa gán. E2E `ho-so-bao-quan.spec.ts`.
- **Còn lại (chặn, chưa làm có chủ ý):** "thành phần thiếu có nút mở hộp tiếp nhận lọc sẵn loại giấy tờ". Đã dò dữ liệu (19/11/2026): thành phần thủ tục là `paper_types` (loại giấy tờ theo thủ tục hành chính) còn bộ lọc dùng `document_types` (danh mục loại giấy tờ lưu trữ), hai bảng không có khóa nối. Đoán theo tên sẽ chỉ sai âm thầm nên không làm; cần một task CSDL lập bảng ánh xạ do cán bộ lưu trữ duyệt (đề xuất mã **DB-20**: `procedure_component_document_types`), rồi API checklist trả thêm `documentTypeCodes` cho từng thành phần. Hộp tiếp nhận đã lọc được theo loại (`?nhom=&loai=`); còn thiếu **ánh xạ từ thành phần thủ tục sang loại giấy tờ** (API checklist chưa trả loại giấy tờ tương ứng của thành phần), nên chưa có nút này.

### FE-29 · Hồ sơ · Giấy tờ ✅ · 1,5 ngày
- **Đã có (17/11/2026, API thật):** `ho-so/[id]/giay-to/page.tsx`, `features/dossier/document-list.tsx`: danh sách theo thứ tự với tình trạng đối chiếu (có liên kết Đối chiếu); chỉ ở bước Đang chuẩn bị / Yêu cầu bổ sung và có `dossier.prepare` mới sửa được: đổi thứ tự bằng nút lên/xuống (đổi chỗ hai giấy tờ trong một lệnh vì API không cho trùng vị trí), đổi chiều đến/đi/nội bộ, gỡ (giấy tờ về hộp tiếp nhận), "Thêm từ hộp tiếp nhận" (hộp thoại liệt kê PDF đã đọc xong, giấy tờ nào lỗi thì báo riêng); "Trích xuất ngay cả hồ sơ" (FE-45); bấm tên mở Chi tiết giấy tờ.
- **Khác kế hoạch:** sắp xếp bằng nút lên/xuống thay cho kéo thả (dùng được bằng bàn phím, đọc được bằng trình đọc màn hình); kéo thả có thể thêm sau.
- **Đã làm (18/11/2026 tối):** hồ sơ làm theo thủ tục thì tab Giấy tờ có cột **Thành phần**: chọn thành phần mà giấy tờ đáp ứng hoặc "Chưa gán" (`PATCH /dossiers/{id}/documents` với `procedureComponentId` hoặc `clearProcedureComponent`), chỉ sửa được ở bước còn sửa được. E2E đối chiếu `documentIds` của thành phần ở checklist.
- **Đã làm (19/11/2026): thêm giấy tờ "có sẵn".** Nút nay là "Thêm giấy tờ"; hộp thoại "Thêm giấy tờ vào hồ sơ" có thêm ô "Hoặc tìm giấy tờ đã có" (gõ chờ 300 ms rồi gọi tìm kiếm chỉ trong giấy tờ, `findDocuments` ở `app/actions/dossier.ts`, tối đa 10 kết quả). E2E `ho-so-giay-to-co-san.spec.ts`.
- **Lỗi đã sửa cùng lúc (19/11/2026):** hộp thoại này nạp danh sách PDF bằng cách gọi Server Action **ngay trong lúc render**, nên mỗi lần vẽ lại lại gửi một yêu cầu (đo được khoảng 3.000 yêu cầu/phút, đủ làm cả phiên dính giới hạn 429). Nay nạp trong `useEffect` có cờ hủy và hộp thoại chỉ gắn khi mở; một lần mở còn 2 yêu cầu. **Quy ước:** không gọi Server Action trong thân hàm render.

### FE-30 · Hồ sơ · Thanh thao tác ✅ · 1,5 ngày
- **Đã có (17/11/2026, API thật):** `components/dossier/action-bar.tsx` lấy mọi nút từ `GET /dossiers/{id}/actions` (bỏ `mockAllowedActions`); nút API khóa vẫn hiện mờ kèm lý do ngay cạnh; nút cần ý kiến mở ô ý kiến cạnh nút, đếm đủ 10 ký tự; gửi qua Server Action `transitionDossier` kèm `version`; thành công thì toast và `router.refresh()`; 409 thì báo "hồ sơ vừa được người khác thay đổi" và tải lại; không có thao tác thì nói hồ sơ đang chờ ai.
- **Dọn dẹp:** `mockAllowedActions` trong `lib/workflow.ts` không còn nơi nào gọi; xóa khi đụng tới tệp này.
- **Kiểm tra:** E2E `e2e/duyet-ho-so.spec.ts`: trình → trưởng phòng trả lại (ý kiến ngắn thì nút Gửi khóa) → trình lại → đạt → văn thư nộp lưu, nhật ký ghi đủ kể cả ý kiến trả lại.

### FE-31 · Hồ sơ · Phân công ✅ · 1 ngày
- **Đã có (18/11/2026, BE-110):** tab chỉ hiện với `dossier.assign`; `phan-cong/page.tsx` + `features/dossier/assign-panel.tsx` + `assign-rules.ts` (có test). Danh sách chuyên viên của phòng từ `GET /dossiers/{id}/assignees`, gõ tên không dấu để lọc, mỗi người kèm "Đang giữ N hồ sơ, M quá hạn" và liên kết "Xem hồ sơ" (`/ho-so?nguoi=…`); người đang chủ trì có nhãn. Hạn không trước hôm nay (giờ Việt Nam, `min` của ô ngày + kiểm lại trước khi gửi); **đổi sang người khác bắt buộc ghi lý do ≥ 10 ký tự**, chỉ đổi hạn cho cùng người thì không bắt buộc. Gửi bằng Server Action `assignDossier` (`PUT /dossiers/{id}/assignment`), lỗi theo ô hoặc kèm Mã lỗi. Hồ sơ đã lưu trữ khóa.
- **Lưu ý:** danh sách chỉ gồm người có phân công **riêng** còn hiệu lực ở đúng phòng (khớp `assign_dossier`); người chỉ có ủy quyền không có trong danh sách.
- **Kiểm tra:** E2E `danh-sach-va-phan-cong.spec.ts` (danh sách hiện, lọc tên, hạn quá khứ bị chặn ở giao diện, lưu hạn hợp lệ, đầu trang cập nhật, chuyên viên không có tab). **Chưa thử đổi sang người khác trong E2E** vì CSDL dev chỉ có một chuyên viên ở Hạ tầng (`dev_admin`); phần đó có test ở backend và test quy tắc ở `assign-rules.test.ts`.

### FE-32 · Hồ sơ · Nhật ký ✅ · 0,5 ngày
- **Đã có (17/11/2026, API thật):** `ho-so/[id]/nhat-ky/page.tsx` đọc `GET /dossiers/{id}/history`: việc gần nhất ở trên, mỗi dòng có người, vai trò, loại sự kiện, chuyển từ bước nào sang bước nào, thời điểm (giờ Việt Nam) và ý kiến; lọc theo loại sự kiện và "Hiện thêm" nằm trên URL.
- **Quyết định (18/11/2026): không phân trang phía API.** API trả toàn bộ nhật ký một lần và "Hiện thêm" chỉ cắt phía máy chủ Next. Đã đo trên `hoso_dev`: nhiều nhất 5 sự kiện quy trình và 3 lần chuyển vị trí mỗi hồ sơ (trung bình 3,1 và 2,3); quy trình có số bước hữu hạn nên nhật ký không tăng theo thời gian. Làm lại nếu số đo thật cho thấy hồ sơ vượt vài trăm dòng.

### FE-33 · Chi tiết giấy tờ ✅ · 2 ngày
- **Đã có (17–18/11/2026, API thật):** `giay-to/[id]/page.tsx`: trình xem bản gốc mở đúng trang theo `?trang=` và đúng phiên bản theo `?tep=`; thông tin (loại, nhóm, tình trạng, tệp, SHA-256, **người** và thời điểm xác nhận đầu văn bản); các hồ sơ chứa giấy tờ trong phạm vi; kết quả kiểm tra kỹ thuật chữ ký số; liên kết văn bản (phụ lục, thay thế, sửa đổi, trả lời); tải tệp gốc (`DownloadButton`).
  - **Phiên bản tệp** (BE-113, `features/document/file-versions.tsx`): bản gốc, bản thay thế, bản dẫn xuất, bản ký số; nhãn Hiện hành và Đã hủy nội dung; người nạp, dung lượng, trang; "Xem" mở đúng bản đó.
  - **In** (BE-113): liên kết thường mở `?purpose=print` ở thẻ mới (phân công theo cookie, BE-118), chỉ hiện với `document.print`; mỗi lần mở ghi một dòng nhật ký `print`. Không dùng fetch + blob vì CSP của trang không cho trình xem PDF hiện bản blob.
  - **Vùng nguồn trên bản quét cũ** (18/11/2026, BE-126): liên kết "Trang N · chỉ vùng" thêm `?tep=<sourceFileId>` và "(bản quét N)" khi vùng không nằm trên bản hiện hành.
  - **Trường dữ liệu cho mọi người có quyền xem** (BE-119, `GET /documents/{id}/fields`): giá trị đã đối chiếu, nhãn Đã đối chiếu / Chưa đối chiếu / Đã sửa / Nhập tay, người đối chiếu, liên kết "Trang N · chỉ vùng"; người có quyền sửa thấy thêm giá trị AI đã đọc. Trưởng phòng và lãnh đạo (chỉ có `document.view`) giờ thấy trường.
- **Đã có thêm (18/11/2026):**
  - **Liên kết văn bản** (BE-50, `features/document/relations-editor.tsx`): thêm liên kết (phụ lục, thay thế, sửa đổi, trả lời, liên quan) bằng cách tìm văn bản trong phạm vi, ghi chú; gỡ liên kết do văn bản này khai; API từ chối liên kết tạo vòng và trùng. **Lỗi cũ đã sửa:** API trả `direction` là `outgoing`/`incoming` nhưng giao diện so với `out` nên mọi liên kết hiện nhãn chiều ngược;
  - **Thay bản quét** (BE-126): nút ở mục Phiên bản tệp (khóa kèm lý do khi giấy tờ nằm trong hồ sơ chờ xử lý), lý do thay và bản được thay hiện ở danh sách phiên bản.
- **Kiểm tra:** từ Tra cứu bấm kết quả mở đúng trang trúng; đã thử với trưởng phòng (thấy trường, không có nút In) và văn thư (có In, một dòng nhật ký, chuyên viên bị 403). **Chưa thử** in thật bằng trình duyệt có bộ xem PDF (chỉ kiểm phản hồi: 200 `application/pdf`, mở tại chỗ, không Range).

### FE-34 · Tra cứu ✅ · 2 ngày
- **Đã có (17–18/11/2026, API thật):** `tra-cuu/page.tsx`: từ khóa, phạm vi (giấy tờ/hồ sơ), nhóm hồ sơ, hình thức văn bản, ban hành từ ngày/đến ngày, **cơ quan ban hành** đều nằm trên URL (form GET); đoạn trích tô đậm bằng `<mark>` (`features/search/highlight.ts`) kèm số trang trúng; số giấy tờ và hồ sơ tìm thấy trong phạm vi.
  - **Phân trang** (BE-112): "Trang sau →" và "← Về trang đầu" dùng con trỏ `con-tro` trên URL; tổng số không đổi giữa các trang. Địa chỉ dựng ở `features/search/search-url.ts` (có test; không dùng khóa `trang` vì đã dùng để mở đúng trang của giấy tờ).
  - **Cơ quan ban hành:** gõ tên (không dấu cũng được) hoặc mã; chỉ lọc giấy tờ nên bỏ phần hồ sơ (có ghi chú dưới ô).
- **Kiểm tra:** gõ "to khai khai sinh" (không dấu) ra "Tổ khai đăng ký khai sinh" có tô đậm. **Chưa có E2E** cho phân trang.

### FE-35 · Thủ tục hành chính ✅ · 2 ngày
- **Đã có (18/11/2026, API thật, BE-33, BE-122):** `thu-tuc/page.tsx`, `thu-tuc/[id]/page.tsx`, `features/procedure/` (`procedure-filter.ts` có test).
  - danh sách: tìm không dấu theo tên hoặc mã, lọc lĩnh vực, **cấp thực hiện** (danh sách cấp từ API đã gộp "Cấp xã"/"Cấp Xã"), hiệu lực; mọi bộ lọc và trang nằm trên URL; thủ tục đã bãi bỏ/thay thế có chip đỏ;
  - chi tiết: thông tin, thành phần hồ sơ gom theo mục kèm số bản chính/sao và đánh dấu bắt buộc, **tải mẫu biểu** (liên kết thường tới API, đúng tên gốc), tệp của thủ tục, lịch sử hiệu lực kèm căn cứ; thủ tục đã bãi bỏ có cảnh báo nổi bật "không dùng mẫu cũ";
  - **"Tạo hồ sơ theo thủ tục này"** mở `ho-so/tao-moi?thu-tuc=<mã>`: biểu mẫu mang theo thủ tục (hồ sơ ghi `procedureId`, kiểm thành phần bắt buộc khi trình); thủ tục đã bãi bỏ không cho tạo và nói rõ.
- **Kiểm tra:** E2E `thu-tuc.spec.ts` (tìm không dấu, lọc cấp, chi tiết, tải mẫu 200, tạo hồ sơ theo thủ tục ghi tên thủ tục, thủ tục bãi bỏ bị chặn).

### FE-36 · Kho bản giấy, mượn trả ✅ · 3 ngày
- **Kho (18/11/2026, BE-81, BE-82, BE-111):** `kho-ban-giay/page.tsx`, `kho-ban-giay/[locationId]/page.tsx`, `features/storage/`.
  - cây vị trí kho › phòng › tủ › kệ › hộp kèm số hồ sơ cộng dồn cả vị trí con; ô tìm nhận nội dung mã QR từ đầu đọc mã vạch (đúng mã thì mở thẳng vị trí); trang vị trí có đường dẫn đầy đủ, mã QR, vị trí con, hồ sơ đang ở đó;
  - **quản lý vị trí** (`location-rules.ts` có test): thêm kho/vị trí con (chỉ chọn được cấp **sâu hơn** cấp cha), sửa tên và ghi chú, **ngừng dùng** (API chặn 409 khi còn hồ sơ hoặc vị trí con đang dùng), **in nhãn QR cả nhánh** (tối đa 240 nhãn, PDF 24 nhãn mỗi trang);
  - **đặt/chuyển/gỡ vị trí bản giấy của hồ sơ** ở tab Tổng quan (chỉ hộp hoặc kệ còn dùng, kèm ghi chú vào lịch sử chuyển).
- **Mượn trả (18/11/2026, BE-83):** `muon-tra/page.tsx`, `features/loan/` (`loan-rules.ts` có test): đề nghị mượn (tìm hồ sơ, mục đích ≥ 5 ký tự, hạn trả đề nghị), **duyệt** (hạn trả tới tối đa 90 ngày, mặc định 14), từ chối kèm lý do, **giao**, **nhận trả kèm tình trạng**; người mượn thấy khoản của mình, văn thư thấy của cả cơ quan; quá hạn có chip đỏ và số ngày; một hồ sơ một khoản mượn hiệu lực (API báo rõ khi trùng).
- **Kiểm tra:** E2E `kho-ban-giay.spec.ts` (cây thử `E2E-UI-*` tạo một lần rồi dùng lại; nhãn cả nhánh trả PDF; ngừng dùng bị chặn khi còn hồ sơ) và `muon-tra.spec.ts` (đề nghị → duyệt → giao → nhận trả; hạn quá 90 ngày bị chặn; đề nghị trùng bị từ chối; chuyên viên không có nút duyệt; từ chối cần lý do). Cây thử `E2E-KHO` có từ trước.

### FE-37 · Nộp lưu ✅ · 2 ngày
- **Đã có (18/11/2026, API thật, BE-84, BE-85):** `nop-luu/page.tsx`, `nop-luu/[submissionId]/page.tsx`, `features/archive/`.
  - hàng chờ nộp lưu: chọn nhiều hồ sơ (tối đa 200) và ghi chú để tạo đợt; hồ sơ không hợp lệ (đã có đợt khác chưa xong, vừa đổi bước) được API báo **từng hồ sơ** ngay dưới hồ sơ đó;
  - chi tiết đợt: tiến trình (ai, khi nào), danh mục hồ sơ kèm số trang, vị trí, kết quả kiểm; thao tác theo bước: soạn → nộp hoặc xóa; đã nộp → **tiếp nhận cả đợt** (xác nhận hai bước) hoặc **trả lại** kèm lý do ≥ 10 ký tự và lỗi từng hồ sơ; đã tiếp nhận → tải biên bản PDF;
  - tiếp nhận lỗi: hiện danh sách hồ sơ có vấn đề, **không hồ sơ nào đổi trạng thái** (cả đợt hoàn tác).
- **Kiểm tra:** E2E `nop-luu.spec.ts` (một hồ sơ trống làm cả đợt không tiếp nhận được và hồ sơ tốt vẫn `ready_archive`; trả lại; đợt mới tiếp nhận thành công có biên bản `application/pdf`; xóa đợt đang soạn).

### FE-38 · Xuất dữ liệu ✅ · 1 ngày
- **Đã có (18/11/2026, API thật, BE-86):** `xuat-du-lieu/page.tsx`, `features/export/` (`export-rules.ts` có test, `export-form.tsx`, `export-list.tsx`).
  - tạo gói theo điều kiện (trạng thái, nhóm hồ sơ, khoảng thời gian lưu trữ) và định dạng; cần ít nhất một điều kiện; API báo khi không hồ sơ nào khớp hoặc quá 2.000 hồ sơ;
  - danh sách gói của tôi: **tiến độ cập nhật trực tiếp qua SSE** (`export.progress|ready|failed|expired`), khi xong có nút tải, dung lượng, **mã băm danh mục**, hạn tải ("còn N ngày"); gói hết hạn hoặc bị thu hồi có trạng thái và giải thích riêng;
  - tải bằng liên kết thường tới API (phân công theo cookie); API kiểm lại quyền và phạm vi MỖI LẦN tải.
- **Kiểm tra:** E2E `xuat-du-lieu.spec.ts` (thiếu điều kiện bị chặn, không khớp báo rõ, tạo gói, đang đóng → sẵn sàng, tải được ZIP "PK").

### FE-39 · Đề nghị hủy ✅ · 1 ngày
- **Đã có (18/11/2026, API thật, BE-87, BE-101):** `de-nghi-huy/page.tsx`, `features/disposal/`.
  - văn thư: danh sách hồ sơ đủ điều kiện (đã lưu trữ, quy tắc bảo quản **đã xác nhận**, đủ năm) → đề nghị hủy kèm lý do ≥ 10 ký tự;
  - người có thẩm quyền: **phê duyệt kèm văn bản quyết định** (tìm văn bản trong phạm vi, nằm ngoài hồ sơ bị hủy) hoặc từ chối kèm lý do; **người đề nghị không tự phê duyệt** (nút ẩn, có giải thích);
  - thực hiện hủy: **xác nhận hai bước trong trang** kèm cảnh báo xóa vĩnh viễn; kết quả nêu số tệp đã hủy và số giấy tờ giữ lại; trạng thái "đang thực hiện" chỉ báo, **không gửi lại** (BE-101); chỉ coi là xong khi `executed`;
  - bộ lọc theo bước nằm trên URL (chờ phê duyệt, chờ thực hiện, đã hủy, bị từ chối).
- **Cần dữ liệu:** hồ sơ chỉ đủ điều kiện khi có quy tắc bảo quản đã xác nhận (làm ở FE-43).
- **Kiểm tra:** E2E `de-nghi-huy.spec.ts` (tài khoản thứ hai `e2e.chair` phê duyệt/từ chối; sau khi thực hiện tệp có `disposed_at`, thông tin giấy tờ còn).

### FE-40 · Thông báo ✅ · 1 ngày
- **Đã có (18/11/2026, API thật, BE-70, BE-124):** `thong-bao/page.tsx`, `features/notifications/`, `components/layout/notification-bell.tsx`, `app/actions/notifications.ts`.
  - danh sách mới nhất trước, phân trang con trỏ ("Tải thêm"), lọc "Chưa đọc" trên URL; chấm xanh và chữ "(chưa đọc)" cho trình đọc màn hình; nhóm theo loại (Hạn hồ sơ, Nộp lưu, Đề nghị hủy, Mượn trả…);
  - bấm thông báo: đánh dấu đã đọc rồi mở đúng nơi (đường dẫn trong ứng dụng, **không bao giờ trỏ ra ngoài**: `notificationHref` có test); "Đánh dấu tất cả đã đọc";
  - **chuông cập nhật trực tiếp qua SSE** `notification.created` (cộng ngay, không chờ tải lại) và trang tự làm mới; số về 0 sau khi đọc hết.
- **Lỗi đã sửa:** trang từng hiện thông báo GIẢ khi chạy API thật; từ 18/11/2026 dữ liệu mẫu chỉ ở chế độ giả lập.
- **Kiểm tra:** E2E `thong-bao.spec.ts` (32 thông báo qua hai trang, chuông tăng ngay khi chèn thông báo mới, bấm mở đúng nơi, lọc chưa đọc, đánh dấu tất cả). **Lỗi môi trường đã sửa kèm theo:** `next dev` nén gzip luồng SSE đi qua phép chuyển tiếp nên sự kiện không tới (`compress` chỉ bật ở sản xuất; triển khai thật Caddy đi thẳng tới API).

### FE-41 · Lô quét và lỗi ảnh ✅ · 2 ngày
- **Đã có (18/11/2026, API thật, BE-40, BE-53, BE-125, BE-126):** `tiep-nhan/lo-quet/page.tsx`, `tiep-nhan/lo-quet/[batchId]/page.tsx`, `features/intake/` (`batch-rules.ts` có test, `create-batch-button.tsx`, `close-batch-button.tsx`, `quality-panel.tsx`, `replace-scan-dialog.tsx`).
  - danh sách lô (lọc đang mở/đã đóng trên URL): mã, đơn vị giao, hộp, số tệp, **số tờ dự kiến so với trang đã quét** (cảnh báo khi trang ít hơn số tờ), lỗi ảnh mở; tạo lô (mọi ô không bắt buộc, giới hạn chữ khớp API);
  - chi tiết lô: tệp trong lô kèm tình trạng đọc, **"Nạp PDF vào lô"** (`tai-len?lo=` chọn sẵn lô), trang AI nghi ngờ (xác nhận **đạt** hoặc **cần quét lại**), bảng lỗi ảnh theo trang (đã sửa, chấp nhận bỏ qua kèm lý do), ghi lỗi tay;
  - **đóng lô còn lỗi: cảnh báo nhưng vẫn cho đóng** khi ghi lý do chấp nhận bỏ qua (≥ 10 ký tự); lý do được ghi vào từng lỗi (BE-125);
  - **Thay bản quét** (hộp thoại dùng chung với Chi tiết giấy tờ, tải bằng XHR có tiến độ): lý do bắt buộc 10–500 ký tự; tự đóng lỗi ảnh của bản cũ; lô đã đóng cập nhật số trang.
- **Kiểm tra:** E2E `lo-quet.spec.ts` (đóng lô còn lỗi phải ghi lý do; thay bản quét đóng lỗi rồi đóng lô thẳng).

### FE-42 · Tài khoản, người dùng, phân công ✅ · 2,5 ngày
- **Đã có (18/11/2026, API thật, BE-30, BE-34, BE-121, BE-123, BE-127):** `tai-khoan/page.tsx`, `quan-tri/nguoi-dung/page.tsx`, `quan-tri/nguoi-dung/[id]/page.tsx`, `features/admin/` (`user-rules.ts` có test), `app/actions/admin.ts`.
  - **Tài khoản:** thông tin, các phân công đang hiệu lực (kể cả ủy quyền, kèm hạn), **lịch sử đăng nhập gần đây** (để tự phát hiện đăng nhập lạ);
  - **Người dùng:** tìm theo tên, lọc đang dùng/đã khóa, **chỉ phân công sắp hết hạn (≤ 7 ngày) với chip vàng**, thêm người dùng;
  - **Chi tiết:** sửa thông tin, **khóa/mở khóa** (khóa thu hồi mọi phiên; API chặn khóa chính mình và quản trị cuối cùng), buộc đăng xuất; **phân công** có thời hạn và căn cứ (≥ 10 ký tự), cơ quan/đơn vị theo luật từng vai trò, kết thúc ngay; **ủy quyền** có thời hạn tối đa 90 ngày, chỉ chọn được phần quyền người ủy quyền thật sự có (từ `GET /admin/roles`, BE-127), thu hồi; ủy quyền đã nhận.
- **Kiểm tra:** E2E `nguoi-dung.spec.ts` (thêm hai người, phân công có hạn → chip vàng và bộ lọc, ủy quyền → người nhận thấy → thu hồi, kết thúc phân công, khóa và mở khóa, trang Tài khoản).

### FE-43 · Quản trị danh mục ✅ · 2,5 ngày
- **Đã có (18/11/2026, API thật, BE-32, BE-35):** `quan-tri/danh-muc/page.tsx`, `features/catalog/` (`catalog-rules.ts` có test, `catalog-panels.tsx`), `components/ui/form-dialog.tsx` (hộp thoại biểu mẫu dùng chung), `app/actions/catalog.ts`.
  - cột trái: 38 nhóm hồ sơ gom theo đơn vị phụ trách, tìm không dấu, chip "Ngừng dùng"/"Chưa xác nhận"; nhóm đang xem nằm trên URL (`?nhom=`);
  - nhóm: thêm (mã 2–10 ký tự), sửa, **xác nhận thông tin**, ngừng dùng/dùng lại, xóa (chỉ nhóm chưa có dữ liệu; đã dùng thì API trả 409 và giao diện gợi ý ngừng dùng);
  - loại giấy tờ: thêm (mã tự cấp), sửa, bắt buộc có trong hồ sơ và số lượng tối thiểu, ngừng dùng, xóa **chỉ khi đã ngừng dùng và hết trường**; **không có nút xóa** cho loại đang dùng;
  - trường dữ liệu: thêm, sửa, kiểu giá trị, bắt buộc đối chiếu, trường quan trọng, nhóm trường, biểu thức kiểm tra (sai cú pháp bị chặn ngay), xóa;
  - **thời hạn bảo quản:** đề xuất (chưa có hiệu lực), **xác nhận kèm căn cứ pháp lý ≥ 5 ký tự** (từ lúc này hồ sơ đủ năm được đề nghị hủy), xóa đề xuất chưa xác nhận.
- **Kiểm tra:** E2E `danh-muc.spec.ts` (nhóm thử `E2EKT`: thêm nhóm, loại, trường; sửa; đề xuất và xác nhận thời hạn; ngừng dùng và xóa loại; ngừng dùng nhóm).

### FE-44 · Quản trị vận hành ✅ · 2 ngày
- **Đã có (18/11/2026, API thật, BE-88, BE-89, BE-99, BE-100, BE-120):** `quan-tri/van-hanh/page.tsx` (bốn mục theo `?muc=`, chỉ hiện mục mà phân công có quyền), `features/ops/` (`ops-rules.ts` có test), `app/actions/ops.ts`; trang không còn dùng `apiFetch` viết tay.
  - **Máy AI:** số việc chờ/chạy/xong/lỗi/hủy 24 giờ, khay (làm ngay/có người chờ/nền), worker kèm nhịp tim (vàng > 2 phút, đỏ > 5 phút), tốc độ đọc, **mô hình** đang bật và thật sự đã dùng, **cảnh báo khi mô hình chạy lệch bảng ghi nhận**, việc lỗi gần đây;
  - **Việc AI** (lọc đang chờ/lỗi/hủy/xong, phân trang): chỉ có tên tệp; **hủy** việc đang chờ/chạy (xác nhận hai bước), **chạy lại** việc lỗi/đã hủy bằng việc mới; nút khóa kèm lý do do API tính (tệp đã hủy, đang có việc khác, đã có lần đọc mới hơn);
  - **Sao lưu:** tình trạng tổng (đủ hạn, đã diễn tập khôi phục chưa), từng loại, các lần gần đây, **ghi nhận đã diễn tập khôi phục**, ghi tay một lần sao lưu;
  - **Cài đặt:** sửa giá trị JSON, kiểm kiểu ngay (cài đặt SQL đọc trực tiếp chỉ nhận `true/false`), mô tả cài đặt đã biết.
- **Chưa làm:** liên kết công cụ thử nghiệm SAM 3 (`sam3-lab.html` ở thư mục gốc, chưa được ứng dụng phục vụ; làm cùng MG-04).
- **Kiểm tra:** E2E `van-hanh.spec.ts` (chuyên viên không vào được; chạy lại việc lỗi tạo việc mới và khóa việc cũ; hủy việc đang chạy; sửa và trả lại cài đặt; ghi nhận sao lưu).

### FE-45 · Khay chờ AI và "Trích xuất ngay" ✅ · 1,5 ngày (đã nối API thật cùng FE-21, 17/11/2026)
- **Phụ thuộc:** BE-97, BE-98, BE-99. Thiết kế mức ưu tiên ở `docs/tasks/ai.md`.
- **Trạng thái:** 17/11/2026 bấm thử bằng Chromium với `HOSO_MOCK=1`; từ khi FE-21 nối API thật (17/11) các nút chạy với API thật ở hộp tiếp nhận, màn đối chiếu và tab Giấy tờ. Tệp:
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

### FE-48 · Đi trong danh sách bằng bàn phím ✅ · 0,5 ngày
- **Đã có (18/11/2026):** `components/ui/row-navigation.tsx` (có test): ↑ ↓ chuyển giữa các dòng, Home/End về đầu/cuối, Enter mở (dòng là liên kết nên Enter có sẵn). Gắn trình nghe phím cho cả trang, chỉ chiếm phím khi trang có liên kết `a[data-row]` đang hiện; nhường phím cho ô nhập, danh sách chọn, hộp thoại và mọi tổ hợp có Ctrl/Alt/⌘/Shift. Dòng đánh dấu bằng `data-row` ở danh sách hồ sơ (bảng và thẻ), tra cứu, hàng việc ở Việc của tôi và hồ sơ trong vị trí kho.
- **Đã gắn thêm (18/11/2026):** hộp tiếp nhận (liên kết chính của dòng, `ButtonLink row`), danh sách thông báo, lô quét, đợt nộp lưu, thủ tục, người dùng, nhóm danh mục. **Chưa thử bằng trình duyệt thật** ngoài E2E (mới có test jsdom cho `RowNavigation`).## Sau khi xong các màn

| ID | Task | Ngày |
|---|---|---|
| MG-04 ⏸ | (hoãn có chủ ý, đi cùng MG-01…03 và cần người dùng đồng ý gỡ bản thí điểm) Chuyển `index.html`, `nghiep-vu-vai-tro.html` vào `public/nghien-cuu/` dạng tĩnh, liên kết từ trang đăng nhập | 0,5 |
| SEC-04 ✅ | (19/11/2026) Quy tắc lint an toàn: cấm `dangerouslySetInnerHTML`, `eval`, import `server-only` vào client; Server Action phải qua `runAction`/`requireSession` (docs/05). Làm bằng plugin `frontend/eslint-rules/hoso.mjs`: `react/no-danger`, `no-eval`, `no-implied-eval`, `no-new-func` cùng hai luật riêng. **`hoso/no-server-only-in-client`**: tệp `"use client"` không được import `server-only`, `next/headers`, `*-data`, `@/lib/api/server`, `@/lib/auth/session`, `@/lib/auth/page-guard`, `@/lib/actions`, `@/lib/log` (import kiểu `import type` vẫn được). **`hoso/server-action-guard`**: mọi hàm async export trong tệp `"use server"` phải gọi `runAction`, `getSession`, `requireSession`, `pageSession` hoặc nhánh `serverEnv().mock`; ngoại lệ phải ghi `eslint-disable` kèm lý do (hiện có hai: `mockSignOut`, `clearAssignment` ở `actions/session.ts`, vì chúng chỉ xóa cookie của chính người gọi). Test `src/lint/hoso-rules.test.ts` (18 ca bằng `RuleTester`). Chạy trong `npm run lint` nên vào CI | 0,5 |
| LOG-04 | Gửi lỗi máy chủ Next sang GlitchTip (gộp với FE-11) | 1 |
| LOG-08 ✅ | Màn Nhật ký hệ thống `/quan-tri/nhat-ky` (18/11/2026, BE-88, BE-117): ba cách xem (Mã lỗi, Truy cập, Thay đổi dữ liệu), bộ lọc trên URL (mã lỗi, mã tương quan, đối tượng, khoảng ngày giờ Việt Nam), phân trang theo id. Tra Mã lỗi (không phân biệt hoa thường) ra request, người, mã tương quan và các lần truy cập cùng request; mã sai định dạng hoặc không có đều có thông báo riêng. Nhật ký thay đổi chỉ hiện tên cột, không giá trị. Đã thử với một lỗi thật. Chưa làm: xuất CSV, lọc theo người (cần ô chọn người) | 1,5 |
| QA-02 | E2E đủ kịch bản theo vai trò trong `nghiep-vu-vai-tro.html` | 3 |
| QA-05 | Kiểm tra tiếp cận (axe + bàn phím) 10 màn chính | 1 |
| OPS-01 | Docker image `node .next/standalone/server.js` (không dùng `next start` với `output: standalone`), chạy không phải root | 0,5 |


## Hợp đồng backend cập nhật 17/11/2026 (BE-103, BE-107)

(Ghi lúc 17/11/2026, khi `tiep-nhan` và đối chiếu còn dùng dữ liệu mẫu; nay đã nối, xem trạng thái cuối mục.) Khi nối API:

- Inbox nhận `{ items, nextCursor }` từ `GET /intake/inbox`, mặc định 50, tối đa 200; nút tải thêm dùng `cursor=nextCursor`, reset cursor khi đổi bộ lọc. Không coi phản hồi là mảng.
- Màn đối chiếu cần cho người dùng kiểm tra và xác nhận tiêu đề, hình thức, số văn bản, ngày ban hành qua `PUT /documents/{id}/metadata` kèm `version` mới nhất. Hiển thị người/thời điểm/ghi chú xác nhận; khi 409 tải lại dữ liệu để người dùng kiểm tra.
- `needs_review` ở metadata làm checklist/actions chưa sẵn sàng dù các trường OCR đã xác nhận. Nếu sửa giá trị metadata, backend đặt review về `pending`; cần xác nhận giấy tờ lại. Không tự động gọi xác nhận thay người dùng.
- Màn hủy chỉ báo hoàn tất khi trạng thái `executed`. `executing` nghĩa là đã nhận yêu cầu và đang xử lý/thử lại; đọc lại trạng thái, không tự gửi execute lần nữa.

OpenAPI đã xuất lại ở `frontend/src/api/openapi.json`.

**Trạng thái nối (17/11/2026):**
- inbox `{ items, nextCursor }`, nút "Tải thêm", đổi thẻ thì bắt đầu lại: ✅ (FE-21);
- đối chiếu xác nhận đầu văn bản kèm `version`, hiện người/thời điểm/ghi chú, 409 thì tải lại, không tự xác nhận thay người dùng: ✅ (FE-23). Tên người xác nhận có từ 18/11/2026 (BE-116);
- màn hủy chỉ báo hoàn tất khi `executed`: ⬜ (FE-39).
