import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { FolderInput, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageBody, PlannedScreen } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";
import { cn } from "@/lib/cn";
import { MOCK_INBOX } from "@/lib/mock/data";
import { AiStatusChip } from "@/features/intake/ai-status";
import { ExtractNowButton } from "@/features/intake/extract-now-button";

export const metadata: Metadata = { title: "Tiếp nhận PDF" };

const TABS = [
  { key: "cho-xep", label: "Chờ xếp hồ sơ" },
  { key: "da-xep", label: "Đã xếp" },
  { key: "da-bo", label: "Đã bỏ" },
] as const;

/** Hộp tiếp nhận: mọi PDF đã nạp, trạng thái đọc của AI và việc tiếp theo cho từng tệp. */
export default async function IntakePage({ searchParams }: PageProps<"/tiep-nhan">) {
  const { session, allowed } = await pageSession(["intake.upload", "intake.manage"]);
  if (!allowed) return <NoAccess session={session} what="tiếp nhận PDF" />;
  const tab = (await searchParams)["trang-thai"] ?? "cho-xep";
  const items = tab === "cho-xep" ? MOCK_INBOX : [];

  return (
    <>
      <PageHeader
        title="Tiếp nhận PDF"
        description="Nạp bản quét, AI đọc và gợi ý; bạn đối chiếu rồi xếp vào hồ sơ. PDF mới nạp vào khay chờ, AI đọc khi rảnh. Cần ngay thì bấm Trích xuất ngay để đưa lên đầu hàng."
        breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Tiếp nhận PDF" }]}
        actions={
          <>
            <ButtonLink href={routes.intakeBatches}>
              <FolderInput aria-hidden className="size-4" /> Lô quét
            </ButtonLink>
            <ButtonLink href={routes.intakeUpload} variant="primary">
              <Upload aria-hidden className="size-4" /> Nạp PDF
            </ButtonLink>
          </>
        }
      />
      <nav aria-label="Lọc theo trạng thái" className="flex gap-1 border-b border-line bg-surface px-4 sm:px-6">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`${routes.intake}?trang-thai=${t.key}` as Route}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("border-b-[3px] px-3 py-2.5 text-sm font-semibold", tab === t.key ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <PageBody>
        {items.length === 0 ? (
          <EmptyState icon={Upload} title="Chưa có PDF nào ở đây" action={<ButtonLink href={routes.intakeUpload} variant="primary">Nạp PDF</ButtonLink>}>
            Kéo thả một hoặc nhiều PDF vào màn Nạp PDF. Tệp trùng với tệp đã có sẽ được báo ngay, không đọc lại.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-soft text-left text-[13px] text-heading">
                <tr>
                  <th className="px-3 py-2 font-semibold">Tệp</th>
                  <th className="px-3 py-2 font-semibold">Trang</th>
                  <th className="px-3 py-2 font-semibold">Tình trạng đọc</th>
                  <th className="px-3 py-2 font-semibold">Gợi ý của AI</th>
                  <th className="px-3 py-2 text-right font-semibold">Việc tiếp theo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-line">
                    <td className="px-3 py-2.5">
                      <span className="font-semibold">{item.fileName}</span>
                      <span className="block text-xs text-muted">Nạp lúc {item.uploadedAt}</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{item.pages}</td>
                    <td className="px-3 py-2.5"><AiStatusChip item={item} /></td>
                    <td className="px-3 py-2.5 text-muted">{item.suggestion ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      {item.stage === "ready" && (
                        <span className="inline-flex items-start justify-end gap-2">
                          <ExtractNowButton scope="document" id={item.id} force />
                          <ButtonLink size="sm" variant="primary" href={routes.intakeReview(item.id)}>Đối chiếu</ButtonLink>
                        </span>
                      )}
                      {item.stage === "failed" && <ButtonLink size="sm" href={routes.intakeReview(item.id)}>Xem và đọc lại</ButtonLink>}
                      {item.stage === "queued" && item.queueKind !== "priority" && <ExtractNowButton scope="document" id={item.id} variant="primary" />}
                      {item.stage === "queued" && item.queueKind === "priority" && <span className="text-xs text-muted">Đã đưa lên đầu hàng</span>}
                      {item.stage === "reading" && <span className="text-xs text-muted">Chờ AI đọc xong</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PlannedScreen
          task="FE-21 (API: BE-41, BE-42, BE-44)"
          items={[
            "Danh sách từ GET /api/v1/intake/inbox?status=…; tiến độ cập nhật trực tiếp qua SSE /api/v1/events",
            "Bỏ PDF có Hoàn tác trong 30 ngày (POST /intake/documents/{id}/discard, /restore)",
            "Lọc theo lô quét, người nạp; chọn nhiều để bỏ hoặc xếp cùng một hồ sơ",
          ]}
        />
      </PageBody>
    </>
  );
}
