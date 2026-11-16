import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, RotateCw, Scissors } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PlannedScreen } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";
import { cn } from "@/lib/cn";
import { MOCK_INBOX, MOCK_REVIEW_FIELDS } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Đối chiếu" };

/**
 * Bước 2: bản gốc bên trái, trường bên phải. Trường cần xem lên đầu.
 * Bấm vào trường → bên trái nhảy tới đúng trang và vùng nguồn (FE-22).
 */
export default async function ReviewPage({ params }: PageProps<"/tiep-nhan/[documentId]/doi-chieu">) {
  const { session, allowed } = await pageSession("document.edit");
  if (!allowed) return <NoAccess session={session} what="đối chiếu giấy tờ" />;
  const { documentId } = await params;
  const item = MOCK_INBOX.find((i) => i.id === documentId);
  if (!item) notFound();

  const fields = [...MOCK_REVIEW_FIELDS].sort((a, b) => Number(Boolean(b.attention)) - Number(Boolean(a.attention)));
  const attention = fields.filter((f) => f.attention).length;

  return (
    <div className="grid">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="grid gap-0.5">
          <h1 className="text-xl font-bold">{item.fileName}</h1>
          <p className="text-[13px] text-muted">{item.pages} trang · còn {MOCK_INBOX.length - 1} PDF trong hộp tiếp nhận</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink size="sm" href={routes.intakeSplit(documentId)}>
            <Scissors aria-hidden className="size-4" /> Tách thành nhiều văn bản
          </ButtonLink>
        </div>
      </div>

      <div className="grid min-h-[60vh] lg:grid-cols-2">
        <section aria-label="Bản gốc" className="grid place-items-center gap-3 border-b border-line bg-soft p-6 lg:border-r lg:border-b-0">
          <div className="grid aspect-[210/297] w-full max-w-[380px] content-start gap-2 border border-line bg-surface p-6" aria-hidden>
            <div className="flex justify-between gap-4">
              <div className="grid w-2/5 gap-1.5"><div className="h-1.5 bg-line" /><div className="h-1.5 w-3/5 bg-line" /></div>
              <div className="grid w-2/5 gap-1.5"><div className="h-1.5 bg-line" /><div className="h-1.5 bg-warn-soft outline-2 outline-offset-2 outline-warn" /></div>
            </div>
            <div className="mx-auto mt-4 h-1.5 w-1/2 bg-line" />
            {Array.from({ length: 12 }, (_, i) => <div key={i} className={cn("h-1.5 bg-line", i % 4 === 3 && "w-3/5")} />)}
          </div>
          <div className="flex items-center gap-3 text-[13px] text-muted">
            <span>Trang 1 / {item.pages} · đọc bằng OCR</span>
            <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" disabled>
              <RotateCw aria-hidden className="size-3.5" /> Đọc lại trang này
            </button>
          </div>
        </section>

        <section aria-label="Thông tin giấy tờ" className="grid content-start gap-3 bg-surface p-4 sm:p-6">
          <div className="grid gap-1 border border-line p-3">
            <span className="text-xs text-muted">Gợi ý của AI · cần bạn xác nhận</span>
            <div className="flex flex-wrap gap-2"><Chip tone="info">Kế hoạch</Chip><Chip tone="info">U02 · Chỉ đạo, điều hành</Chip></div>
          </div>
          {attention > 0 && (
            <p className="flex items-center gap-2 text-sm font-semibold text-warn">
              <AlertTriangle aria-hidden className="size-4" /> {attention} trường cần bạn xem trước
            </p>
          )}
          {fields.map((f) => (
            <div key={f.label} className={cn("grid gap-1 border p-3", f.attention ? "border-warn bg-warn-soft" : "border-line")}>
              <label className="flex justify-between gap-2 text-xs text-muted" htmlFor={`f-${f.label}`}>
                <span className="font-semibold text-ink">
                  {f.label}
                  {f.key && <span className="ml-1 text-bad" title="Trường quan trọng, bắt buộc xác nhận">*</span>}
                </span>
                <span>{f.page ? `Trang ${f.page}` : "Không thấy trong tài liệu"}</span>
              </label>
              <input id={`f-${f.label}`} defaultValue={f.value} className="h-9 border border-line-strong bg-surface px-2 text-sm" />
              {f.attention && <p className="text-xs text-warn">{f.attention}</p>}
            </div>
          ))}
        </section>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 sm:px-6">
        <span className="text-[13px] text-muted">
          {attention} trường cần xác nhận · <kbd className="border border-line px-1">Ctrl</kbd>+<kbd className="border border-line px-1">Enter</kbd> để sang bước tiếp
        </span>
        <div className="flex gap-2">
          <Link href={routes.intake} className="inline-flex h-10 items-center border border-line-strong px-4 text-sm font-semibold hover:border-bad hover:text-bad">Bỏ PDF này</Link>
          <ButtonLink href={routes.intakeFile(documentId)} variant="primary">Xác nhận, xếp vào hồ sơ →</ButtonLink>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6">
        <PlannedScreen
          task="FE-22, FE-23 (API: BE-43, BE-47 → BE-50)"
          items={[
            "Trình xem pdf.js đọc /api/v1/files/{id}/content theo Range; làm nổi vùng theo source_region",
            "Form sinh theo field_definitions và value_type; kiểm tra ngày/số ngay khi nhập",
            "Đổi loại giấy tờ thì giữ giá trị đã nhập, đánh dấu cần đối chiếu lại",
            "Lưu nháp tự động; rời trang khi còn thay đổi chưa lưu thì hỏi lại trong trang",
          ]}
        />
      </div>
    </div>
  );
}
