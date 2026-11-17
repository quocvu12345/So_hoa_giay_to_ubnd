import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { PageBody, Section } from "@/components/ui/blocks";
import { WorkflowChip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { getHistory } from "@/features/dossier/dossier-data";
import { actionKinds } from "@/features/dossier/history";
import { pageSession } from "@/lib/auth/page-guard";
import { cn } from "@/lib/cn";
import { serverEnv } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { loadOrNotFound } from "@/lib/load-or-not-found";

export const metadata: Metadata = { title: "Nhật ký hồ sơ" };

const PAGE = 20;

/** Tab Nhật ký (FE-32): chuyển bước, phân công, thêm/gỡ giấy tờ. Ghi tự động, không sửa hoặc xóa được. Lọc theo loại và "hiện thêm" nằm trên URL. */
export default async function DossierHistory({ params, searchParams }: PageProps<"/ho-so/[id]/nhat-ky">) {
  await pageSession("dossier.read");
  if (serverEnv().mock) return null;
  const { id } = await params;
  const query = await searchParams;
  const kind = typeof query.loai === "string" ? query.loai : "";
  const shown = Math.min(Math.max(Number(query["hien"]) || PAGE, PAGE), 1000);

  const all = await loadOrNotFound(() => getHistory(id));
  // API trả cũ → mới; người dùng cần việc gần nhất ở trên.
  const newest = [...all].sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id - a.id);
  const kinds = actionKinds(all);
  const filtered = kind ? newest.filter((e) => e.action === kind) : newest;
  const visible = filtered.slice(0, shown);
  const href = (params: Record<string, string>) => {
    const search = new URLSearchParams(params).toString();
    return `${routes.dossierHistory(id)}${search ? `?${search}` : ""}` as Route;
  };

  return (
    <PageBody>
      <Section title="Nhật ký xử lý" description="Ghi tự động, không sửa hoặc xóa được. Việc gần nhất ở trên.">
        {kinds.length > 1 && (
          <nav aria-label="Lọc theo loại sự kiện" className="flex flex-wrap gap-1.5">
            <Link href={href({})} aria-current={kind === "" ? "true" : undefined} className={cn("h-8 content-center border px-3 text-[13px] font-semibold", kind === "" ? "border-primary bg-primary text-white" : "border-line-strong bg-surface hover:border-primary")}>
              Tất cả ({all.length})
            </Link>
            {kinds.map((k) => (
              <Link key={k.action} href={href({ loai: k.action })} aria-current={kind === k.action ? "true" : undefined} className={cn("h-8 content-center border px-3 text-[13px] font-semibold", kind === k.action ? "border-primary bg-primary text-white" : "border-line-strong bg-surface hover:border-primary")}>
                {k.label} ({k.count})
              </Link>
            ))}
          </nav>
        )}
        {filtered.length === 0 ? (
          <p className="border border-dashed border-line-strong p-4 text-sm text-muted">
            {all.length === 0 ? "Hồ sơ chưa có sự kiện nào. Mỗi lần trình, trả lại, phân công sẽ được ghi ở đây." : "Không có sự kiện nào thuộc loại này."}
          </p>
        ) : (
          <ol className="grid gap-4 border-l-2 border-line pl-4">
            {visible.map((e) => (
              <li key={e.id} className="grid gap-0.5">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {e.actorName} <span className="font-normal text-muted">({e.actorRole})</span> · {e.actionLabel}
                  {e.fromState && e.fromState !== e.toState && (
                    <span className="inline-flex items-center gap-1 text-xs font-normal text-muted">
                      <WorkflowChip state={e.fromState} /> → <WorkflowChip state={e.toState} />
                    </span>
                  )}
                </span>
                <time dateTime={e.at} className="text-xs text-muted tabular-nums">{formatDateTime(e.at)}</time>
                {e.note && <span className="text-sm">“{e.note}”</span>}
              </li>
            ))}
          </ol>
        )}
        {filtered.length > visible.length && (
          <Link href={href({ ...(kind ? { loai: kind } : {}), hien: String(shown + PAGE) })} className="justify-self-start text-sm font-semibold text-primary hover:underline">
            Hiện thêm ({filtered.length - visible.length} sự kiện cũ hơn)
          </Link>
        )}
      </Section>
    </PageBody>
  );
}
