# Frontend · Hồ sơ số (Next.js)

Next.js 16 (App Router, React 19, render phía máy chủ), TypeScript strict, Tailwind 4.

- Quy ước giao diện và bản đồ đường dẫn: [docs/07-khung-giao-dien.md](../docs/07-khung-giao-dien.md)
- Task: [docs/tasks/frontend.md](../docs/tasks/frontend.md)
- Bảo mật: [docs/05-bao-mat.md](../docs/05-bao-mat.md)
- Log và báo lỗi: [docs/06-log-va-giam-sat.md](../docs/06-log-va-giam-sat.md)

> Bản Next.js này thay đổi nhiều so với các bản trước. Đọc `node_modules/next/dist/docs/` trước khi dùng API lạ (xem `AGENTS.md`). Ví dụ: `middleware.ts` đã đổi thành `proxy.ts`; `error.tsx` nhận `retry`; `params` là Promise.

## Chạy

```sh
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

Có hai chế độ, chọn trong `.env.local`:

| Chế độ | Biến | Dùng khi |
|---|---|---|
| **Giả lập** | `HOSO_MOCK=1` | Làm giao diện khi chưa có API. Trang đăng nhập hiện 6 tài khoản mẫu theo vai trò; dữ liệu trong `src/lib/mock/` |
| **API thật** | `HOSO_MOCK=0`, `HOSO_API_INTERNAL_URL=http://localhost:5080`, `HOSO_SESSION_COOKIE=hoso_session_dev` | Chạy cùng backend .NET. Next chuyển tiếp `/api/*` sang API khi dev |

Bản production: chạy `npm run build` rồi `node .next/standalone/server.js`. Không dùng `next start`, vì lệnh này không hỗ trợ `output: standalone`.

## Cấu trúc

```
src/
├─ proxy.ts                    CSP nonce, mã tương quan, chặn khi chưa có cookie phiên
├─ instrumentation.ts          Ghi lỗi máy chủ (onRequestError) kèm digest
├─ instrumentation-client.ts   Bắt lỗi trình duyệt, gửi /client-log
├─ app/
│  ├─ layout.tsx               html lang="vi", metadata
│  ├─ (auth)/dang-nhap/        Đăng nhập
│  ├─ (app)/layout.tsx         AppShell cho mọi màn sau đăng nhập
│  ├─ (app)/…                  36 đường dẫn trang, xem docs/07
│  ├─ actions/session.ts       Server Action: đổi phân công, đăng nhập/đăng xuất giả lập
│  ├─ client-log/route.ts      Nhận lỗi trình duyệt (giới hạn kích thước, tần suất, Origin)
│  ├─ not-found.tsx · global-error.tsx · (app)/error.tsx · (app)/loading.tsx
├─ config/
│  ├─ routes.ts                Mọi đường dẫn; luôn dùng thay cho chuỗi viết tay
│  └─ navigation.ts            Menu: một nguồn cho sidebar, Ctrl+K
├─ components/
│  ├─ layout/                  AppShell, NavList, MobileNav, CommandPalette, AssignmentSwitcher
│  ├─ ui/                      Button, Chip, PageHeader, TabsNav, Stepper, EmptyState, ErrorPanel, NoAccess…
│  └─ dossier/action-bar.tsx   Thanh thao tác chuyển bước
├─ lib/
│  ├─ api/server.ts            serverApi() có kiểu theo openapi.json, apiFetch, chuyển tiếp cookie, ApiError
│  ├─ api/client.ts            Trình duyệt: header API, tải PDF lên bằng XHR có tiến độ
│  ├─ api/problem.ts           ProblemDetails, ApiError, thông báo lỗi tiếng Việt
│  ├─ actions.ts · action-result.ts · use-server-action.ts   Khung Server Action và hook gọi action
│  ├─ events/                  Luồng SSE dùng chung (fetch + bộ đọc SSE), hook useServerEvent
│  ├─ auth/                    permissions, session (DAL), page-guard, types
│  ├─ env.ts · log.ts · workflow.ts · cn.ts
│  └─ mock/                    Dữ liệu GIẢ LẬP, xóa dần khi nối API
├─ features/                   Mã theo nghiệp vụ: intake (hộp tiếp nhận, nạp PDF), review (đối chiếu), dossier (xếp hồ sơ), ops
├─ api/                        openapi.json (backend xuất) và schema.d.ts (npm run gen:api)
└─ types/global.d.ts
```

## Kiểm tra trước khi đẩy code

```sh
npm run typecheck && npm run lint && npm test && npm run build
```

Đổi `openapi.json` (backend xuất bằng `backend/scripts/export-openapi.sh`) thì chạy `npm run gen:api` rồi `npm run typecheck`: chỗ nào đã lệch hợp đồng sẽ lỗi biên dịch.

## E2E (Playwright)

Hai chế độ chọn bằng `E2E_MODE`:

| Chế độ | Cần | Chạy |
|---|---|---|
| `integration` | Stack thật: `scripts/dev-up.sh start` (API, worker AI, web, CSDL `hoso_dev`) | `E2E_MODE=integration npx playwright test` |
| mặc định | Web chạy `HOSO_MOCK=1` (chưa có kịch bản giả lập) | `npx playwright test` |

Kịch bản `@integration` (`e2e/tiep-nhan.spec.ts`) nạp 3 PDF mẫu, chờ AI đọc xong (1–3 phút), đối chiếu và xếp vào hồ sơ mới; dữ liệu thử nằm lại trong `hoso_dev` với tên bắt đầu bằng "E2E". Đăng nhập bằng `dev_admin` (API dev-login). Nếu Playwright báo thiếu trình duyệt, chạy `npx playwright install chromium` hoặc đặt `E2E_CHROMIUM` tới tệp chromium có sẵn. Luồng SSE luôn mở nên đừng dùng `waitForLoadState("networkidle")`.

## Gọi API từ trình duyệt

API chỉ nhận phân công đang dùng qua header `X-Assignment-Id`. Thẻ `<img>` và `EventSource` không gửi được header, còn cookie `hoso_assignment` là httpOnly. Vì vậy mọi lệnh gọi trực tiếp từ trình duyệt (tải lên, ảnh trang, SSE) lấy mã phân công từ `useAssignmentId()` và gắn `browserHeaders()` (`src/lib/api/client.ts`); ảnh trang và SSE đọc bằng `fetch`, không dùng `<img src>` hay `EventSource`.
