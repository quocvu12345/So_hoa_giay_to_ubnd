import type { Metadata } from "next";
import Link from "next/link";
import { FileSearch, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { RowNavigation } from "@/components/ui/row-navigation";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { highlight } from "@/features/search/highlight";
import { search, type SearchResult } from "@/features/search/search-data";
import { hasSearchFilters, searchHref, type SearchUrlState } from "@/features/search/search-url";
import { parseViDate } from "@/features/review/review-state";
import { getWorkGroups } from "@/features/review/review-data";
import { ApiError } from "@/lib/api/server";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Tra cứu văn bản" };

const KINDS = [
  { key: "all", label: "Tất cả" },
  { key: "documents", label: "Giấy tờ" },
  { key: "dossiers", label: "Hồ sơ" },
] as const;

function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Đoạn chữ có từ khóa tô đậm bằng <mark>. Không dùng dangerouslySetInnerHTML: tách đoạn rồi để React tự escape. */
function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlight(text, query).map((s, i) =>
        s.match ? (
          <mark key={i} className="bg-warn-soft px-0.5 font-semibold text-ink">{s.text}</mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/**
 * Tra cứu (FE-34): từ khóa và bộ lọc nằm trên URL (form GET). Gõ không dấu ra kết quả có dấu; mỗi kết quả có đoạn trích tô đậm và số trang trúng,
 * bấm mở đúng trang. Kết quả và số lượng chỉ gồm văn bản trong phạm vi của phân công đang dùng.
 */
export default async function SearchPage({ searchParams }: PageProps<"/tra-cuu">) {
  const { session, allowed } = await pageSession("document.view");
  if (!allowed) return <NoAccess session={session} what="tra cứu văn bản" />;
  const params = await searchParams;
  const q = param(params.q);
  const kindParam = param(params.loai);
  const kind = KINDS.find((k) => k.key === kindParam)?.key ?? "all";
  const workGroup = param(params.nhom);
  const form = param(params["hinh-thuc"]);
  const fromText = param(params["tu-ngay"]);
  const toText = param(params["den-ngay"]);
  const issuer = param(params["co-quan"]).slice(0, 200);
  const cursor = param(params["con-tro"]);
  const real = !serverEnv().mock;

  const from = fromText ? parseViDate(fromText) : null;
  const to = toText ? parseViDate(toText) : null;
  const inputError = q.length > 0 && q.length < 2 ? "Nhập ít nhất 2 ký tự để tìm." : fromText && !from ? "Từ ngày chưa đúng dạng ngày/tháng/năm, ví dụ 01/01/2026." : toText && !to ? "Đến ngày chưa đúng dạng ngày/tháng/năm, ví dụ 31/12/2026." : from && to && from > to ? "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu." : null;

  let result: SearchResult | null = null;
  let failure: string | null = null;
  if (real && q.length >= 2 && !inputError) {
    try {
      result = await search({ q, kind, workGroup, form, issuedFrom: from ?? undefined, issuedTo: to ?? undefined, issuer, cursor });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      failure = error.status === 400 ? (error.errors ? Object.values(error.errors).flat().join(" ") : error.message) : `Chưa tìm được. Thử lại sau ít giây. Mã lỗi: ${error.errorId ?? error.code}.`;
    }
  }
  const groups = real && can(session, "document.view") ? await getWorkGroups(session.activeAssignment.organizationCode).catch(() => []) : [];
  const documents = result?.hits.filter((h) => h.kind === "document") ?? [];
  const dossiers = result?.hits.filter((h) => h.kind === "dossier") ?? [];
  const state: SearchUrlState = { q, kind, workGroup, form, fromText, toText, issuer };
  const filtered = hasSearchFilters(state);
  const hrefWith = (next?: string) => searchHref(routes.search, state, next) as never;

  return (
    <>
      <PageHeader
        title="Tra cứu văn bản"
        description="Tìm theo số ký hiệu, trích yếu, mã hồ sơ hoặc nội dung đã đọc bằng OCR. Gõ không dấu vẫn tìm được. Kết quả chỉ gồm văn bản trong phạm vi của bạn."
        breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Tra cứu" }]}
      />
      <PageBody>
        {!real ? (
          <NeedsRealApi what="Tra cứu" />
        ) : (
          <>
            <form role="search" className="grid gap-3 border border-line bg-surface p-3">
              <div className="flex flex-wrap gap-2">
                <label htmlFor="q" className="sr-only">Từ khóa</label>
                <span className="flex min-w-[240px] flex-1 items-center gap-2 border border-line-strong px-3 focus-within:border-primary">
                  <Search aria-hidden className="size-4 text-muted" />
                  <input id="q" name="q" defaultValue={q} placeholder="Ví dụ: 26/KH-UBND, kế hoạch công tác, UBND-2026-000002" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
                </span>
                <Button type="submit" variant="primary">Tìm</Button>
              </div>
              <div className="flex flex-wrap items-end gap-3 text-[13px] font-semibold">
                <label className="grid gap-1">
                  Phạm vi
                  <select name="loai" defaultValue={kind} className="h-9 border border-line-strong bg-surface px-2 font-normal">
                    {KINDS.map((k) => (
                      <option key={k.key} value={k.key}>{k.label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  Nhóm hồ sơ
                  <select name="nhom" defaultValue={workGroup} className="h-9 max-w-60 border border-line-strong bg-surface px-2 font-normal">
                    <option value="">Tất cả</option>
                    {groups.map((g) => (
                      <option key={g.code} value={g.code}>{g.code} · {g.title}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  Hình thức văn bản
                  <input name="hinh-thuc" defaultValue={form} placeholder="Công văn, Quyết định…" className="h-9 w-44 border border-line-strong bg-surface px-2 font-normal" />
                </label>
                <label className="grid gap-1">
                  Cơ quan ban hành
                  <input name="co-quan" defaultValue={issuer} maxLength={200} placeholder="Sở Tài chính, UBND…" aria-describedby="issuer-hint" className="h-9 w-48 border border-line-strong bg-surface px-2 font-normal" />
                  <span id="issuer-hint" className="text-xs font-normal text-muted">Chỉ lọc giấy tờ; bỏ qua hồ sơ.</span>
                </label>
                <label className="grid gap-1">
                  Ban hành từ ngày
                  <input name="tu-ngay" defaultValue={fromText} inputMode="numeric" placeholder="dd/mm/yyyy" className="h-9 w-32 border border-line-strong bg-surface px-2 font-normal" />
                </label>
                <label className="grid gap-1">
                  đến ngày
                  <input name="den-ngay" defaultValue={toText} inputMode="numeric" placeholder="dd/mm/yyyy" className="h-9 w-32 border border-line-strong bg-surface px-2 font-normal" />
                </label>
                {filtered && <Link href={q ? `${routes.search}?q=${encodeURIComponent(q)}` as never : routes.search} className="h-9 content-center font-normal text-primary hover:underline">Xóa bộ lọc</Link>}
              </div>
            </form>

            {(inputError || failure) && <p role="alert" className="border border-bad bg-bad-soft p-3 text-sm text-bad">{inputError ?? failure}</p>}

            {!q ? (
              <EmptyState icon={FileSearch} title="Nhập từ khóa để tìm">
                Ví dụ: 26/KH-UBND, “kế hoạch công tác”, UBND-2026-000002. Tìm được cả nội dung bên trong bản quét đã được AI đọc.
              </EmptyState>
            ) : result && documents.length + dossiers.length === 0 ? (
              <EmptyState icon={FileSearch} title={`Không có kết quả cho “${q}”`}>
                Thử từ khóa ngắn hơn, bỏ bộ lọc, hoặc tìm theo một phần số ký hiệu. Giấy tờ ngoài phạm vi phân công của bạn không hiện ở đây.
              </EmptyState>
            ) : result ? (
              <div className="grid gap-4">
                <RowNavigation />
                <p role="status" className="text-sm text-muted">
                  Tìm thấy <b className="text-ink">{result.totalDocuments}</b> giấy tờ và <b className="text-ink">{result.totalDossiers}</b> hồ sơ cho “{q}”.
                  {cursor && " Đang xem các trang sau."}
                </p>
                {documents.length > 0 && (
                  <section aria-label="Giấy tờ" className="grid gap-2">
                    <h2 className="text-base font-bold">Giấy tờ</h2>
                    <ul className="grid gap-2">
                      {documents.map((hit) => {
                        const href = `${routes.document(hit.id)}${hit.page ? `?trang=${hit.page}` : ""}` as never;
                        return (
                          <li key={hit.id} className="grid gap-1 border border-line bg-surface p-3 text-sm">
                            <Link href={href} data-row className="font-semibold text-primary hover:underline">
                              <Highlighted text={hit.title} query={q} />
                            </Link>
                            <span className="text-xs text-muted">
                              {hit.subtitle}
                              {hit.number && <> · <span className="font-mono"><Highlighted text={hit.number} query={q} /></span></>}
                              {hit.issuedOn && <> · Ban hành {formatDate(hit.issuedOn)}</>}
                            </span>
                            {hit.snippet && (
                              <p className="text-ink">
                                <Highlighted text={hit.snippet} query={q} />
                                {hit.page && <Link href={href} className="ml-2 text-xs font-semibold whitespace-nowrap text-primary hover:underline">Trang {hit.page}</Link>}
                              </p>
                            )}
                            {hit.dossiers.length > 0 && (
                              <p className="text-xs text-muted">
                                Trong hồ sơ:{" "}
                                {hit.dossiers.map((d, i) => (
                                  <span key={d.id}>{i > 0 && ", "}<Link href={routes.dossier(d.id)} className="font-mono text-primary hover:underline">{d.code}</Link></span>
                                ))}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
                {dossiers.length > 0 && (
                  <section aria-label="Hồ sơ" className="grid gap-2">
                    <h2 className="text-base font-bold">Hồ sơ</h2>
                    <ul className="grid gap-2">
                      {dossiers.map((hit) => (
                        <li key={hit.id} className="grid gap-0.5 border border-line bg-surface p-3 text-sm">
                          <Link href={routes.dossier(hit.id)} data-row className="font-semibold text-primary hover:underline"><Highlighted text={hit.title} query={q} /></Link>
                          <span className="font-mono text-xs text-muted">{hit.number}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {(cursor || result.nextCursor) && (
                  <nav aria-label="Các trang kết quả" className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
                    <span aria-live="polite">{documents.length} giấy tờ và {dossiers.length} hồ sơ trên trang này.</span>
                    <span className="flex gap-3">
                      {cursor && <Link href={hrefWith()} className="font-semibold text-primary hover:underline">← Về trang đầu</Link>}
                      {result.nextCursor && <Link href={hrefWith(result.nextCursor)} className="font-semibold text-primary hover:underline">Trang sau →</Link>}
                    </span>
                  </nav>
                )}
              </div>
            ) : null}
          </>
        )}
      </PageBody>
    </>
  );
}
