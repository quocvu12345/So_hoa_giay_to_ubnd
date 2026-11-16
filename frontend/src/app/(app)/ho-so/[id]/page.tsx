import type { Metadata } from "next";
import Link from "next/link";
import { Check, CircleAlert, X } from "lucide-react";
import { PageBody, PlannedScreen, Section } from "@/components/ui/blocks";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { MOCK_CHECKLIST } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Tổng quan hồ sơ" };

const ICONS = { ok: Check, pending: CircleAlert, missing: X } as const;
const TONES = { ok: "text-ok", pending: "text-warn", missing: "text-bad" } as const;
const CHIP = { ok: "ok", pending: "warn", missing: "bad" } as const;

/** Tab Tổng quan: danh sách kiểm tra đủ thành phần thay cho thông báo lỗi chung khi trình. */
export default async function DossierOverview({ params }: PageProps<"/ho-so/[id]">) {
  const { id } = await params;
  return (
    <PageBody className="lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Section title="Thành phần hồ sơ" description="Thành phần bắt buộc theo danh mục hoặc thủ tục. Thiếu thì chưa trình được.">
        <ul className="grid">
          {MOCK_CHECKLIST.map((c) => {
            const Icon = ICONS[c.state];
            return (
              <li key={c.name} className="flex items-center gap-3 border-t border-dashed border-line py-2 first:border-t-0">
                <Icon aria-hidden className={`size-4 flex-none ${TONES[c.state]}`} />
                <span className="flex-1 text-sm">{c.name}</span>
                <Chip tone={CHIP[c.state]}>{c.note}</Chip>
              </li>
            );
          })}
        </ul>
        <Link href={routes.dossierDocuments(id)} className="text-sm font-semibold text-primary hover:underline">
          ＋ Thêm giấy tờ còn thiếu
        </Link>
      </Section>
      <div className="grid content-start gap-4">
        <Section title="Thông tin">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">Mức tiếp cận</dt><dd>Nội bộ</dd>
            <dt className="text-muted">Năm</dt><dd>2026</dd>
            <dt className="text-muted">Vị trí bản giấy</dt><dd>Kho UBND · Tủ 2 · Kệ B · Hộp 07</dd>
            <dt className="text-muted">Thời hạn bảo quản</dt><dd className="text-muted">Chưa xác nhận theo danh mục</dd>
          </dl>
        </Section>
        <PlannedScreen task="FE-28 (API: BE-64)" items={["Danh sách kiểm tra từ GET /api/v1/dossiers/{id}/checklist", "Bấm vào thành phần thiếu → mở hộp tiếp nhận lọc sẵn loại giấy tờ đó", "Vị trí bản giấy bấm được → mở hộp trong Kho bản giấy"]} />
      </div>
    </PageBody>
  );
}
