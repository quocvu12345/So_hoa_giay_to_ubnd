import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { Chip } from "@/components/ui/status-chip";
import { getAudit, getErrors, PAGE_SIZE, type AuditRow, type ErrorEventRow } from "@/features/ops/audit-data";
import { normalizeErrorId, parseAuditFilter, toSearchParams, VIEW_LABELS, VIEWS, type AuditFilter } from "@/features/ops/audit-filter";
import { ApiError } from "@/lib/api/server";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Nhật ký hệ thống" };

const ACTION_LABELS: Record<string, string> = { view: "Xem", download: "Tải", print: "In", export: "Xuất", search: "Tìm kiếm", login: "Đăng nhập", logout: "Đăng xuất", INSERT: "Thêm", UPDATE: "Sửa", DELETE: "Xóa" };

const field = "h-9 border border-line-strong bg-surface px-2 font-normal outline-none focus:border-primary";

/**
 * Nhật ký hệ thống (LOG-08, FE-44; chỉ `admin.settings`). Ba cách xem, bộ lọc nằm trên URL:
 * - Mã lỗi: người dùng gửi Mã lỗi (8 ký tự) thì ra đúng request, người, mã tương quan và các lần truy cập cùng request (BE-117);
 * - Truy cập: ai xem, tải, in, xuất, tìm kiếm gì (BE-88);
 * - Thay đổi dữ liệu: bảng và cột nào đổi; KHÔNG hiện giá trị cũ hay mới vì có thể là thông tin cá nhân.
 * Chỉ đọc: không có thao tác sửa hay xóa nhật ký.
 */
export default async function AdminAuditPage({ searchParams }: PageProps<"/quan-tri/nhat-ky">) {
  const { session, allowed } = await pageSession("admin.settings");
  if (!allowed) return <NoAccess session={session} what="xem nhật ký hệ thống" />;
  const filter = parseAuditFilter(await searchParams);
  const real = !serverEnv().mock;

  const idCheck = filter.errorId ? normalizeErrorId(filter.errorId) : null;
  const inputError = idCheck && !idCheck.valid ? "Mã lỗi gồm đúng 8 ký tự 0-9 và A-F, ví dụ 9FA13718." : null;

  let errors: ErrorEventRow[] | null = null;
  let audit: AuditRow[] | null = null;
  let failure: string | null = null;
  if (real && !inputError) {
    try {
      if (filter.view === "loi") errors = await getErrors(filter);
      else audit = await getAudit(filter);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      failure = error.status === 400 ? error.message : `Chưa tải được nhật ký. Thử lại sau ít giây. Mã lỗi: ${error.errorId ?? error.code}.`;
    }
  }

  const rows = errors ?? audit ?? [];
  const lastId = rows.length === PAGE_SIZE ? String(rows[rows.length - 1].id) : null;
  const href = (patch: Partial<AuditFilter>, before?: string): Route => {
    const query = toSearchParams({ ...filter, ...patch, before: "" }, before).toString();
    return `/quan-tri/nhat-ky${query ? `?${query}` : ""}` as Route;
  };

  return (
    <>
      <PageHeader
        title="Nhật ký hệ thống"
        description="Ai đã xem, tải, in, xuất, sửa gì và khi nào; tra Mã lỗi người dùng gửi ra đúng request. Chỉ đọc, không sửa hoặc xóa được."
        breadcrumbs={[{ label: "Quản trị" }, { label: "Nhật ký hệ thống" }]}
      />
      <PageBody>
        {!real ? (
          <NeedsRealApi what="Nhật ký hệ thống" />
        ) : (
          <>
            <nav aria-label="Cách xem nhật ký" className="flex flex-wrap gap-2">
              {VIEWS.map((v) => (
                <Link
                  key={v}
                  href={href({ view: v, errorId: "" })}
                  aria-current={filter.view === v ? "page" : undefined}
                  className={filter.view === v ? "border border-primary bg-accent-soft px-3 py-1.5 text-sm font-semibold text-primary" : "border border-line-strong bg-surface px-3 py-1.5 text-sm hover:border-primary"}
                >
                  {VIEW_LABELS[v]}
                </Link>
              ))}
            </nav>

            <form role="search" className="flex flex-wrap items-end gap-3 border border-line bg-surface p-3 text-[13px] font-semibold">
              {filter.view !== "loi" && <input type="hidden" name="xem" value={filter.view} />}
              {filter.view === "loi" && (
                <label className="grid gap-1">
                  Mã lỗi người dùng gửi
                  <span className="flex items-center gap-2 border border-line-strong px-2 focus-within:border-primary">
                    <Search aria-hidden className="size-4 text-muted" />
                    <input name="ma-loi" defaultValue={filter.errorId} maxLength={12} placeholder="9FA13718" autoComplete="off" spellCheck={false} className="h-9 w-32 bg-transparent font-mono font-normal uppercase outline-none" aria-invalid={inputError ? true : undefined} />
                  </span>
                </label>
              )}
              <label className="grid gap-1">
                Mã tương quan
                <input name="tuong-quan" defaultValue={filter.correlationId} maxLength={64} placeholder="mã của một request" className={`${field} w-56 font-mono`} />
              </label>
              {filter.view !== "loi" && (
                <label className="grid gap-1">
                  Đối tượng
                  <input name="doi-tuong" defaultValue={filter.objectType} maxLength={60} list="doi-tuong-goi-y" placeholder={filter.view === "thay-doi" ? "tên bảng, ví dụ dossiers" : "document, file, dossier…"} className={`${field} w-48`} />
                  <datalist id="doi-tuong-goi-y">
                    {(filter.view === "thay-doi" ? ["dossiers", "documents", "files", "document_field_values", "user_roles", "delegations"] : ["document", "file", "dossier", "search", "dossier_list"]).map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                </label>
              )}
              <label className="grid gap-1">
                Từ ngày
                <input type="date" name="tu-ngay" defaultValue={filter.from} className={field} />
              </label>
              <label className="grid gap-1">
                Đến ngày
                <input type="date" name="den-ngay" defaultValue={filter.to} className={field} />
              </label>
              <Button type="submit" variant="primary">Tra cứu</Button>
              <Link href={href({ errorId: "", correlationId: "", objectType: "", from: "", to: "" })} className="h-10 content-center font-normal text-primary hover:underline">Xóa lọc</Link>
            </form>

            {(inputError || failure) && <p role="alert" className="border border-bad bg-bad-soft p-3 text-sm text-bad">{inputError ?? failure}</p>}

            {!inputError && !failure && rows.length === 0 && (
              <EmptyState title={filter.errorId ? `Không thấy Mã lỗi ${filter.errorId}` : "Không có dòng nhật ký nào khớp"}>
                {filter.errorId
                  ? "Mã lỗi có thể đã quá 90 ngày, gõ sai, hoặc lỗi chưa kịp ghi (ghi chậm vài giây). Mã lỗi vẫn nằm trong log máy chủ ở các dòng request_rejected và unhandled_exception."
                  : "Thử bỏ bớt bộ lọc hoặc mở rộng khoảng thời gian."}
              </EmptyState>
            )}

            {errors && errors.length > 0 && <ErrorList rows={errors} href={href} />}
            {audit && audit.length > 0 && <AuditTable rows={audit} href={href} kind={filter.view === "thay-doi" ? "change" : "access"} />}

            {rows.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
                <span aria-live="polite">{rows.length} dòng trên trang này{filter.before ? " (đang xem trang sau)" : ""}.</span>
                <span className="flex gap-3">
                  {filter.before && <Link href={href({})} className="font-semibold text-primary hover:underline">← Về trang đầu</Link>}
                  {lastId && <Link href={href({}, lastId)} className="font-semibold text-primary hover:underline">Trang sau →</Link>}
                </span>
              </div>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}

function statusTone(status: number) {
  return status >= 500 ? "bad" : status === 401 || status === 403 ? "warn" : "neutral";
}

function ErrorList({ rows, href }: { rows: ErrorEventRow[]; href: (patch: Partial<AuditFilter>, before?: string) => Route }) {
  return (
    <ul className="grid gap-2" aria-label="Các lỗi tìm được">
      {rows.map((e) => (
        <li key={e.id} className="grid gap-1.5 border border-line bg-surface p-3 text-sm">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-bold">{e.errorId}</span>
            <Chip tone={statusTone(e.status)}>HTTP {e.status} · {e.code}</Chip>
            <span className="text-muted">{formatDateTime(e.at)}</span>
          </span>
          <span className="font-mono text-[13px] break-all">{e.method} {e.path}</span>
          <span className="text-[13px] text-muted">
            Người dùng: <b className="text-ink">{e.actor ?? "chưa đăng nhập"}</b>
            {e.correlationId && (
              <>
                {" · "}Mã tương quan{" "}
                <Link href={href({ errorId: "", correlationId: e.correlationId })} className="font-mono text-primary hover:underline">{e.correlationId}</Link>
              </>
            )}
          </span>
          {e.related.length > 0 && (
            <details className="border-t border-dashed border-line pt-1.5">
              <summary className="cursor-pointer text-[13px] font-semibold text-primary">Truy cập cùng request ({e.related.length})</summary>
              <ul className="mt-1.5 grid gap-1 text-[13px]">
                {e.related.map((r) => (
                  <li key={r.id} className="flex flex-wrap gap-2">
                    <span className="text-muted">{formatDateTime(r.at)}</span>
                    <b>{ACTION_LABELS[r.action] ?? r.action}</b>
                    <span>{r.objectType ?? "—"}</span>
                    {r.objectId && <span className="font-mono text-xs text-muted">{r.objectId}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

function AuditTable({ rows, href, kind }: { rows: AuditRow[]; href: (patch: Partial<AuditFilter>, before?: string) => Route; kind: "access" | "change" }) {
  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[760px] text-sm">
        <caption className="sr-only">{kind === "access" ? "Nhật ký truy cập" : "Nhật ký thay đổi dữ liệu"}, {rows.length} dòng</caption>
        <thead className="bg-soft text-left text-[13px] text-heading">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Thời điểm</th>
            <th scope="col" className="px-3 py-2 font-semibold">Người dùng</th>
            <th scope="col" className="px-3 py-2 font-semibold">Hành động</th>
            <th scope="col" className="px-3 py-2 font-semibold">{kind === "access" ? "Đối tượng" : "Bảng"}</th>
            <th scope="col" className="px-3 py-2 font-semibold">{kind === "access" ? "Mã tương quan" : "Cột đã đổi"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line align-top">
              <td className="px-3 py-2 whitespace-nowrap text-muted">{formatDateTime(r.at)}</td>
              <td className="px-3 py-2">{r.actor ?? <span className="text-muted">Hệ thống</span>}</td>
              <td className="px-3 py-2">{ACTION_LABELS[r.action] ?? r.action}</td>
              <td className="px-3 py-2">
                {r.objectType ?? "—"}
                {r.objectId && <span className="block font-mono text-xs break-all text-muted">{r.objectId}</span>}
              </td>
              <td className="px-3 py-2">
                {kind === "access" ? (
                  r.correlationId ? <Link href={href({ correlationId: r.correlationId, view: "truy-cap" })} className="font-mono text-xs break-all text-primary hover:underline">{r.correlationId}</Link> : "—"
                ) : (
                  <>
                    {r.changedColumns?.length ? <span className="font-mono text-xs">{r.changedColumns.join(", ")}</span> : <span className="text-muted">—</span>}
                    {/* LOG-05: mã tương quan của request đã gây ra thay đổi này; bấm để xem mọi thay đổi cùng request. Dòng cũ (trước migration 041) không có mã. */}
                    {r.correlationId && (
                      <span className="mt-0.5 block text-xs text-muted">
                        Request <Link href={href({ correlationId: r.correlationId, view: "thay-doi" })} className="font-mono break-all text-primary hover:underline">{r.correlationId}</Link>
                      </span>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
