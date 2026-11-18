import Link from "next/link";
import type { Route } from "next";
import { Section } from "@/components/ui/blocks";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { cellHref, STAGE_LABELS, STAGE_ORDER, type StageKey } from "./leadership-links";
import type { LeadershipSummary } from "./workspace-data";

type Counts = LeadershipSummary["totals"];
type Row = { key: string; label: string; counts: Counts; scope: { department?: string; workGroups?: string[] }; note?: string };

/** Một ô số: có việc thì là liên kết mở đúng danh sách; số 0 thì chữ mờ, không liên kết. Quá hạn > 0 luôn có chữ "quá hạn" ở tiêu đề cột và màu cảnh báo (không chỉ dựa vào màu). */
function Cell({ stage, count, scope }: { stage: StageKey; count: number; scope: Row["scope"] }) {
  const href = cellHref(stage, count, scope);
  const tone = stage === "overdue" && count > 0 ? "font-bold text-bad" : count === 0 ? "text-muted" : "font-semibold";
  return (
    <td className={cn("px-3 py-2.5 text-right tabular-nums", tone)}>
      {href ? (
        <Link href={href as Route} className="underline-offset-2 hover:text-primary hover:underline" aria-label={`${STAGE_LABELS[stage]}: ${count} hồ sơ. Mở danh sách`}>
          {count}
        </Link>
      ) : (
        count
      )}
    </td>
  );
}

function Table({ caption, firstColumn, rows, totals }: { caption: string; firstColumn: string; rows: Row[]; totals: Counts }) {
  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-soft text-left text-[13px] text-heading">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">{firstColumn}</th>
            {STAGE_ORDER.map((stage) => (
              <th key={stage} scope="col" className="px-3 py-2 text-right font-semibold">{STAGE_LABELS[stage]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-line">
              <th scope="row" className="px-3 py-2.5 text-left font-semibold">
                {row.label}
                {row.note && <span className="block text-xs font-normal text-muted">{row.note}</span>}
              </th>
              {STAGE_ORDER.map((stage) => (
                <Cell key={stage} stage={stage} count={row.counts[stage]} scope={row.scope} />
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line-strong bg-soft">
            <th scope="row" className="px-3 py-2.5 text-left font-bold">Tổng cộng</th>
            {STAGE_ORDER.map((stage) => (
              <td key={stage} className={cn("px-3 py-2.5 text-right font-bold tabular-nums", stage === "overdue" && totals[stage] > 0 && "text-bad")}>{totals[stage]}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * Bảng tổng hợp cho lãnh đạo (FE-47, BE-115). Chủ tịch UBND: theo phòng (kể cả phòng chưa có hồ sơ). Lãnh đạo HĐND: ba lối vào
 * (kỳ họp và nghị quyết, thẩm tra của các Ban, giám sát và kiến nghị) và một dòng hoạt động khác. Số đếm theo ĐÚNG phân công đang dùng;
 * "Quá hạn" nằm trong "Đang xử lý", không cộng thêm. Bấm một số để mở danh sách hồ sơ tương ứng.
 */
export function LeadershipOverview({ summary }: { summary: LeadershipSummary }) {
  const asOf = formatDate(summary.asOf);
  if (summary.departments.length > 0) {
    const rows: Row[] = summary.departments.map((d) => ({ key: d.departmentCode, label: d.departmentName, counts: d.counts, scope: { department: d.departmentCode } }));
    return (
      <Section title="Tổng hợp theo phòng" description={`Số hồ sơ của từng phòng, ban theo giai đoạn, tính đến ${asOf}. Quá hạn nằm trong số đang xử lý.`}>
        <Table caption="Số hồ sơ theo phòng và giai đoạn xử lý" firstColumn="Phòng / Ban" rows={rows} totals={summary.totals} />
      </Section>
    );
  }
  if (summary.activities.length > 0) {
    const rows: Row[] = summary.activities
      .filter((a) => a.activity !== "other" || a.counts.open > 0 || a.workGroupCodes.length > 0)
      .map((a) => ({
        key: a.activity,
        label: a.label,
        counts: a.counts,
        scope: { workGroups: a.workGroupCodes },
        note: a.workGroupCodes.length > 0 ? `Nhóm hồ sơ ${a.workGroupCodes.join(", ")}` : undefined,
      }));
    return (
      <Section title="Tổng hợp theo hoạt động" description={`Số hồ sơ của HĐND theo ba lối vào, tính đến ${asOf}. Quá hạn nằm trong số đang xử lý.`}>
        <Table caption="Số hồ sơ theo hoạt động của HĐND và giai đoạn xử lý" firstColumn="Hoạt động" rows={rows} totals={summary.totals} />
      </Section>
    );
  }
  return null;
}
