import type { Metadata } from "next";
import { PageBody, PlannedScreen, Section } from "@/components/ui/blocks";
import { MOCK_TIMELINE } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Nhật ký hồ sơ" };

export default function DossierHistory() {
  return (
    <PageBody>
      <Section title="Nhật ký xử lý" description="Ghi tự động, không sửa hoặc xóa được.">
        <ol className="grid gap-3 border-l-2 border-line pl-4">
          {MOCK_TIMELINE.map((e) => (
            <li key={e.at} className="grid gap-0.5">
              <span className="text-sm font-semibold">{e.who} · {e.action}</span>
              <span className="text-xs text-muted tabular-nums">{e.at}</span>
              {e.note && <span className="text-sm">“{e.note}”</span>}
            </li>
          ))}
        </ol>
      </Section>
      <PlannedScreen task="FE-32 (API: BE-68)" items={["Gộp chuyển bước, phân công, thêm/gỡ giấy tờ", "Lọc theo loại sự kiện"]} />
    </PageBody>
  );
}
