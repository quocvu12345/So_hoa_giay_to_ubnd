import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, Download, ExternalLink } from "lucide-react";
import { NeedsRealApi, PageBody, Section } from "@/components/ui/blocks";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { formatBytes } from "@/features/document/file-versions";
import { getProcedure, type ProcedureTemplate } from "@/features/procedure/procedure-data";
import { groupBySection, isProcedureId, isRetired, LIFECYCLE_LABELS, quantityLabel } from "@/features/procedure/procedure-filter";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { loadOrNotFound } from "@/lib/load-or-not-found";

export const metadata: Metadata = { title: "Thủ tục hành chính" };

const KIND_LABELS: Record<string, string> = { blank_form: "Mẫu trống", guide_pdf: "Hướng dẫn (PDF)", eform_json: "Biểu mẫu điện tử" };

/** Tên bằng chứng của một sự kiện hiệu lực (CSDL lưu mảng `[{ name }]`); dạng khác thì bỏ qua, không đoán. */
function evidenceNames(evidence: unknown): string[] {
  if (!Array.isArray(evidence)) return [];
  return evidence.flatMap((e) => (e && typeof e === "object" && "name" in e && typeof e.name === "string" ? [e.name] : []));
}

function TemplateLink({ template }: { template: ProcedureTemplate }) {
  if (!template.downloadable) return <span className="text-xs text-muted">{template.filename} (chưa có tệp)</span>;
  // Liên kết thường tới API (GET chỉ mang cookie; phân công theo cookie, BE-118). Tải đúng tên gốc nhờ Content-Disposition.
  return (
    <a href={`/api/v1/form-templates/${template.id}/file`} className={buttonClass("secondary", "sm")}>
      <Download aria-hidden className="size-4" /> {template.filename} <span className="text-xs font-normal text-muted">({KIND_LABELS[template.kind] ?? template.kind}, {formatBytes(Number(template.byteSize))})</span>
    </a>
  );
}

/**
 * Chi tiết thủ tục (FE-35): thông tin, thành phần hồ sơ theo từng mục kèm số bản và mẫu biểu tải về, lịch sử hiệu lực.
 * Thủ tục đã bãi bỏ hoặc thay thế có cảnh báo nổi bật và không cho tạo hồ sơ mới theo thủ tục đó.
 */
export default async function ProcedurePage({ params }: PageProps<"/thu-tuc/[id]">) {
  const { session } = await pageSession();
  const { id } = await params;
  if (!isProcedureId(id)) notFound();
  if (serverEnv().mock) return <><PageHeader title="Thủ tục hành chính" breadcrumbs={[{ label: "Thủ tục hành chính", href: routes.procedures }]} /><PageBody><NeedsRealApi what="Thủ tục hành chính" /></PageBody></>;

  const p = await loadOrNotFound(() => getProcedure(id));
  const retired = isRetired(p.lifecycleStatus);
  const sections = groupBySection(p.components);
  const facts: [string, string | null | undefined][] = [
    ["Mã thủ tục", p.procedureCode], ["Lĩnh vực", p.domain], ["Cơ quan quản lý", p.managingAgency], ["Cấp thực hiện", p.executionLevel],
    ["Cơ quan có thẩm quyền", p.competentAuthority], ["Lệ phí", p.fees], ["Nơi tiếp nhận", p.receivingLocation],
    ["Quyết định của Bộ", p.ministryDecision], ["Quyết định của Hà Nội", p.hanoiDecision], ["Quyết định quy trình", p.workflowDecision],
    ["Quyết định ủy quyền", p.delegationDecision], ["Ủy quyền hết hạn", p.delegationExpiry],
  ];

  return (
    <>
      <PageHeader
        title={p.name}
        description={[p.procedureCode && `Mã ${p.procedureCode}`, p.domain, p.executionLevel].filter(Boolean).join(" · ")}
        breadcrumbs={[{ label: "Thủ tục hành chính", href: routes.procedures }, { label: p.procedureCode ?? p.id }]}
        meta={<Chip tone={retired ? "bad" : p.lifecycleStatus === "unverified" ? "warn" : "ok"}>{LIFECYCLE_LABELS[p.lifecycleStatus] ?? p.lifecycleStatus}</Chip>}
        actions={can(session, "dossier.prepare") && !retired ? <ButtonLink href={`${routes.dossierNew}?thu-tuc=${encodeURIComponent(p.id)}` as "/ho-so/tao-moi"} variant="primary">Tạo hồ sơ theo thủ tục này</ButtonLink> : undefined}
      />
      <PageBody>
        {(p.warning || retired) && (
          <div role="alert" className="flex items-start gap-2 border border-bad bg-bad-soft p-3 text-sm text-bad">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 flex-none" />
            <p>{p.warning ?? "Thủ tục này không còn hiệu lực."} Không dùng mẫu cũ làm mẫu hiện hành; chỉ tra cứu để đối chiếu hồ sơ đã lập. Thủ tục này không dùng để tạo hồ sơ mới.</p>
          </div>
        )}

        <Section title="Thông tin thủ tục">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {facts.filter(([, v]) => v).map(([label, value]) => (
              <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="break-words">{value}</dd></div>
            ))}
          </dl>
          {p.sourceUrl && /^https:\/\//.test(p.sourceUrl) && (
            <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <ExternalLink aria-hidden className="size-4" /> Xem trên trang nguồn
            </a>
          )}
        </Section>

        <Section title={`Thành phần hồ sơ (${p.components.length})`} description="Số bản theo quy định đã công bố. Thành phần đánh dấu bắt buộc phải có khi nộp.">
          {sections.length === 0 ? (
            <p className="text-sm text-muted">Chưa có danh sách thành phần hồ sơ cho thủ tục này.</p>
          ) : (
            sections.map((group) => (
              <div key={group.section} className="grid gap-2">
                <h3 className="text-sm font-bold">{group.section}</h3>
                <ul className="grid divide-y divide-line border border-line" aria-label={group.section}>
                  {group.items.map((c) => (
                    <li key={c.id} className="grid gap-1.5 px-3 py-2.5 text-sm">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{c.name}</span>
                        {c.requiredAsPublished && <Chip tone="info">Bắt buộc</Chip>}
                        {c.hasElectronicForm && <Chip tone="neutral">Có biểu mẫu điện tử</Chip>}
                        {c.paperCode && <span className="text-xs text-muted">Mã giấy tờ {c.paperCode}</span>}
                        {quantityLabel(Number(c.originalQuantity), Number(c.copyQuantity)) && <span className="text-xs text-muted">{quantityLabel(Number(c.originalQuantity), Number(c.copyQuantity))}</span>}
                      </span>
                      {c.templates.length > 0 && <span className="flex flex-wrap gap-2">{c.templates.map((t) => <TemplateLink key={t.id} template={t} />)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </Section>

        {p.procedureFiles.length > 0 && (
          <Section title="Tệp của thủ tục" description="Hướng dẫn và biểu mẫu áp dụng cho cả thủ tục.">
            <div className="flex flex-wrap gap-2">{p.procedureFiles.map((t) => <TemplateLink key={t.id} template={t} />)}</div>
          </Section>
        )}

        {p.lifecycle.length > 0 && (
          <Section title="Lịch sử hiệu lực" description="Các quyết định thay thế, bãi bỏ đã ghi nhận (giữ lại để truy vết).">
            <ul className="grid gap-2" aria-label="Lịch sử hiệu lực">
              {p.lifecycle.map((e, i) => (
                <li key={i} className="grid gap-0.5 border border-line p-2.5 text-sm">
                  <span className="flex flex-wrap items-center gap-2"><Chip tone={isRetired(e.status) ? "bad" : "neutral"}>{e.label}</Chip>{e.effectiveFrom && <span className="text-xs text-muted">Hiệu lực từ {formatDate(e.effectiveFrom)}</span>}{e.reviewedOn && <span className="text-xs text-muted">Rà soát {formatDate(e.reviewedOn)}</span>}</span>
                  {e.note && <span className="text-muted">{e.note}</span>}
                  {evidenceNames(e.evidence).length > 0 && <span className="text-xs text-muted">Căn cứ: {evidenceNames(e.evidence).join("; ")}</span>}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </PageBody>
    </>
  );
}
