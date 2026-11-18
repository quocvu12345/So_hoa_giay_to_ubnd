import type { Metadata } from "next";
import Link from "next/link";
import { NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { AiJobsList } from "@/features/ops/ai-jobs-list";
import { AiStatusPanel } from "@/features/ops/ai-status-panel";
import { BackupsPanel } from "@/features/ops/backups-panel";
import { getAiJobs, getAiStatus, getBackups, getBackupStatus, getSettings } from "@/features/ops/ops-data";
import { JOB_FILTERS, parseJobFilter } from "@/features/ops/ops-rules";
import { SettingsPanel } from "@/features/ops/settings-panel";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Vận hành" };

type Section = "ai" | "viec" | "sao-luu" | "cai-dat";

/**
 * Vận hành (FE-44, BE-88, BE-89, BE-120): máy AI (hàng đợi, worker, mô hình), việc AI (hủy, chạy lại), sao lưu, cài đặt hệ thống.
 * Mỗi mục là một giá trị `?muc=` trên URL; chỉ hiện mục mà phân công đang dùng có quyền (`processing.manage` cho hai mục AI, `admin.settings` cho sao lưu và cài đặt).
 */
export default async function AdminOperationsPage({ searchParams }: PageProps<"/quan-tri/van-hanh">) {
  const { session, allowed } = await pageSession(["processing.manage", "admin.settings"]);
  if (!allowed) return <NoAccess session={session} what="xem vận hành" />;
  const params = await searchParams;
  const canAi = can(session, "processing.manage");
  const canSettings = can(session, "admin.settings");
  const available: { value: Section; label: string }[] = [
    ...(canAi ? [{ value: "ai" as const, label: "Máy AI" }, { value: "viec" as const, label: "Việc AI" }] : []),
    ...(canSettings ? [{ value: "sao-luu" as const, label: "Sao lưu" }, { value: "cai-dat" as const, label: "Cài đặt" }] : []),
  ];
  const wanted = typeof params.muc === "string" ? params.muc : "";
  const section = available.find((s) => s.value === wanted)?.value ?? available[0].value;
  const jobFilter = parseJobFilter(params["trang-thai"]);
  const real = !serverEnv().mock;

  return (
    <>
      <PageHeader
        title="Vận hành"
        description="Máy AI và hàng đợi, việc đọc lỗi cần chạy lại, sao lưu và cài đặt hệ thống."
        breadcrumbs={[{ label: "Quản trị" }, { label: "Vận hành" }]}
      />
      <nav aria-label="Mục vận hành" className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-4 sm:px-6">
        {available.map((s) => (
          <Link key={s.value} href={`${routes.adminOperations}?muc=${s.value}` as "/quan-tri/van-hanh"} aria-current={s.value === section ? "page" : undefined}
            className={cn("flex-none border-b-[3px] px-3 py-2.5 text-sm font-semibold", s.value === section ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink")}>
            {s.label}
          </Link>
        ))}
      </nav>
      <PageBody>
        {!real ? <NeedsRealApi what="Vận hành" /> : <SectionBody section={section} jobFilter={jobFilter} />}
      </PageBody>
    </>
  );
}

async function SectionBody({ section, jobFilter }: { section: Section; jobFilter: ReturnType<typeof parseJobFilter> }) {
  if (section === "ai") return <AiStatusPanel status={await getAiStatus()} />;
  if (section === "sao-luu") {
    const [status, runs] = await Promise.all([getBackupStatus(), getBackups()]);
    return <BackupsPanel status={status} runs={runs} />;
  }
  if (section === "cai-dat") return <SettingsPanel settings={await getSettings()} />;

  const page = await getAiJobs(jobFilter);
  return (
    <div className="grid gap-3">
      <nav aria-label="Lọc việc AI" className="flex flex-wrap gap-2 text-sm">
        {JOB_FILTERS.map((f) => (
          <Link key={f.value} href={`${routes.adminOperations}?muc=viec&trang-thai=${f.value}` as "/quan-tri/van-hanh"} aria-current={f.value === jobFilter ? "page" : undefined}
            className={cn("border px-3 py-1.5", f.value === jobFilter ? "border-primary bg-primary text-white" : "border-line-strong hover:border-primary")}>
            {f.label}
          </Link>
        ))}
      </nav>
      <AiJobsList key={`${jobFilter}-${page.items[0]?.id ?? "rong"}-${page.items[0]?.status ?? ""}`} initial={page.items} initialCursor={page.nextCursor ?? null} filter={jobFilter} />
    </div>
  );
}
