import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageBody, PlannedScreen, Section } from "@/components/ui/blocks";
import { PageHeader } from "@/components/ui/page-header";
import { Chip, WorkflowChip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";
import type { RoleCode } from "@/lib/auth/permissions";
import { scopeLabel } from "@/lib/auth/types";
import { MOCK_DOSSIERS, MOCK_INBOX, type MockDossier, type WorkflowState } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Việc của tôi" };

type Queue = { title: string; hint: string; states: WorkflowState[]; href: Route };

/** Hàng việc mặc định theo vai trò (docs/01-tong-quan-du-an.md mục 3). Bản thật: GET /api/v1/workspace/queue. */
const QUEUES: Record<RoleCode, Queue[]> = {
  employee: [
    { title: "Bị trả lại, cần bổ sung", hint: "Sửa theo ý kiến rồi trình lại", states: ["returned"], href: `${routes.dossiers}?trang-thai=returned` as Route },
    { title: "Đang chuẩn bị", hint: "Hồ sơ được giao, chưa trình", states: ["draft"], href: `${routes.dossiers}?trang-thai=draft` as Route },
  ],
  clerk: [
    { title: "Chờ tiếp nhận nộp lưu", hint: "Đã qua kiểm tra, kiểm tra bàn giao và vị trí bản giấy", states: ["ready_archive"], href: routes.archive },
    { title: "Bị trả lại, cần bổ sung", hint: "Hồ sơ văn thư đang chuẩn bị", states: ["returned"], href: `${routes.dossiers}?trang-thai=returned` as Route },
  ],
  manager: [
    { title: "Chờ bạn kiểm tra", hint: "Chuyên viên đã trình, cần Đạt, Trả lại hoặc Trình lãnh đạo", states: ["department_review"], href: `${routes.dossiers}?trang-thai=department_review` as Route },
    { title: "Đơn vị đang chuẩn bị", hint: "Theo dõi tiến độ và hạn nội bộ", states: ["draft", "returned"], href: routes.dossiers },
  ],
  chair: [{ title: "Chờ bạn cho ý kiến", hint: "Hồ sơ khối UBND được trình", states: ["leadership_review"], href: `${routes.dossiers}?trang-thai=leadership_review` as Route }],
  council: [{ title: "Chờ bạn cho ý kiến", hint: "Hồ sơ khối HĐND được trình", states: ["leadership_review"], href: `${routes.dossiers}?trang-thai=leadership_review` as Route }],
  technical_admin: [],
};

function DossierRow({ d }: { d: MockDossier }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line py-2.5 first:border-t-0">
      <Link href={routes.dossier(d.id)} className="grid min-w-0 flex-1 gap-0.5 hover:text-primary">
        <span className="font-mono text-xs text-muted">{d.code}</span>
        <span className="font-semibold">{d.title}</span>
      </Link>
      <WorkflowChip state={d.status} />
      <span className="w-28 text-right text-[13px] text-muted tabular-nums">{d.dueOn ? `Hạn ${d.dueOn.split("-").reverse().join("/")}` : "Không đặt hạn"}</span>
    </li>
  );
}

export default async function MyWorkPage() {
  const { session } = await pageSession();
  const role = session.activeAssignment.role;
  const queues = QUEUES[role];
  const canUpload = session.permissions.includes("intake.upload");
  const readyPdf = MOCK_INBOX.filter((i) => i.stage === "ready").length;

  return (
    <>
      <PageHeader
        title="Việc của tôi"
        description="Những việc đang chờ bạn, xếp theo mức cần làm trước. Nhấn vào một dòng để mở ngay."
        meta={<span>Phân công: {scopeLabel(session.activeAssignment)}</span>}
        actions={
          canUpload ? (
            <ButtonLink href={routes.intakeUpload} variant="primary">
              <Upload aria-hidden className="size-4" /> Nạp PDF
            </ButtonLink>
          ) : undefined
        }
      />
      <PageBody>
        {canUpload && readyPdf > 0 && (
          <Link href={routes.intake} className="flex items-center justify-between gap-3 border border-primary/40 bg-accent-soft px-4 py-3 hover:border-primary">
            <span>
              <strong>{readyPdf} PDF đã đọc xong</strong> đang chờ bạn đối chiếu và xếp vào hồ sơ.
            </span>
            <ArrowRight aria-hidden className="size-5 text-primary" />
          </Link>
        )}

        {queues.length === 0 && role === "technical_admin" && (
          <Section title="Vận hành" description="Quản trị kỹ thuật không xem nội dung hồ sơ.">
            <ul className="grid gap-1 text-sm">
              <li><Link className="text-primary hover:underline" href={routes.adminOperations}>Hàng đợi AI và lỗi đọc PDF</Link></li>
              <li><Link className="text-primary hover:underline" href={routes.adminOperations}>Lần sao lưu gần nhất</Link></li>
              <li><Link className="text-primary hover:underline" href={routes.adminUsers}>Phân công sắp hết hạn</Link></li>
            </ul>
          </Section>
        )}

        {queues.map((q) => {
          const items = MOCK_DOSSIERS.filter((d) => q.states.includes(d.status));
          return (
            <Section
              key={q.title}
              title={`${q.title} · ${items.length}`}
              description={q.hint}
              actions={<Link href={q.href} className="text-sm font-semibold text-primary hover:underline">Xem tất cả</Link>}
            >
              {items.length === 0 ? (
                <EmptyState title="Không có việc nào">Khi có hồ sơ cần bạn xử lý, hồ sơ sẽ hiện ở đây.</EmptyState>
              ) : (
                <ul>{items.map((d) => <DossierRow key={d.id} d={d} />)}</ul>
              )}
            </Section>
          );
        })}

        {session.isMock && <Chip tone="warn" className="w-fit">Dữ liệu giả lập</Chip>}
        <PlannedScreen
          task="FE-20 (API: BE-69)"
          items={[
            "Số liệu và hàng việc lấy từ GET /api/v1/workspace/summary và /workspace/queue theo phân công đang dùng",
            "Hồ sơ quá hạn lên đầu, có chip đỏ; sắp đến hạn (≤ 2 ngày) chip vàng",
            "Tự cập nhật khi có thông báo mới qua luồng sự kiện (SSE)",
          ]}
        />
      </PageBody>
    </>
  );
}
