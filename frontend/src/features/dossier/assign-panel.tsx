"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { assignDossier } from "@/app/actions/dossier";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useServerAction } from "@/lib/use-server-action";
import { filterAssignees, MIN_NOTE_LENGTH, todayVietnam, validateAssignment, workload, type AssigneeOption, type AssignErrors } from "./assign-rules";
import { toSearchParams, parseDossierFilter } from "./dossier-filter";

type Props = {
  dossierId: string;
  options: AssigneeOption[];
  currentAssigneeId: string | null;
  currentDueOn: string | null;
  /** Hồ sơ đã lưu trữ thì khóa: không giao lại. */
  locked?: string;
};

/** Đường dẫn danh sách hồ sơ lọc theo một người chủ trì (xem họ đang giữ gì trước khi giao thêm). */
function heldHref(userId: string): string {
  return `/ho-so?${toSearchParams({ ...parseDossierFilter({}), assignee: userId }).toString()}`;
}

/**
 * Ô chọn người chủ trì và hạn nội bộ (FE-31). Danh sách từ API (chuyên viên còn hiệu lực của đúng phòng); gõ tên không dấu để tìm,
 * mỗi người kèm số hồ sơ đang giữ để trưởng phòng cân tải. Đổi sang người khác phải ghi lý do; hạn không trước hôm nay.
 */
export function AssignPanel({ dossierId, options, currentAssigneeId, currentDueOn, locked }: Props) {
  const router = useRouter();
  const toast = useToast();
  const ids = { search: useId(), due: useId(), note: useId(), group: useId() };
  const [query, setQuery] = useState("");
  const [userId, setUserId] = useState(currentAssigneeId ?? "");
  const [dueOn, setDueOn] = useState(currentDueOn ?? "");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<AssignErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const action = useServerAction(assignDossier, { toastErrors: false });
  const today = useMemo(() => todayVietnam(), []);
  const shown = useMemo(() => filterAssignees(options, query), [options, query]);
  const changing = userId !== "" && userId !== currentAssigneeId;
  const unchanged = !changing && dueOn === (currentDueOn ?? "");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const found = validateAssignment({ userId, dueOn, note }, currentAssigneeId, today);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const result = await action.run(dossierId, { userId, dueOn, note });
    if (result.ok) {
      toast.success(changing ? "Đã đổi người chủ trì." : "Đã cập nhật hạn nội bộ.");
      setNote("");
      router.refresh();
    } else if (result.fieldErrors) {
      const mapped: AssignErrors = {};
      if (result.fieldErrors.userId) mapped.userId = result.fieldErrors.userId[0];
      if (result.fieldErrors.dueOn) mapped.dueOn = result.fieldErrors.dueOn[0];
      if (result.fieldErrors.note) mapped.note = result.fieldErrors.note[0];
      setErrors(mapped);
    } else {
      setFormError(result.errorId ? `${result.message} (Mã lỗi ${result.errorId})` : result.message);
    }
  }

  if (locked) return <p role="status" className="border border-dashed border-line-strong p-3 text-sm text-muted">{locked}</p>;
  if (options.length === 0) {
    return <p role="status" className="border border-dashed border-line-strong p-3 text-sm text-muted">Phòng này chưa có chuyên viên nào còn hiệu lực để giao. Nhờ quản trị kỹ thuật thêm phân công chuyên viên.</p>;
  }

  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-4" noValidate>
      <fieldset className="grid gap-2" aria-describedby={errors.userId ? `${ids.group}-error` : undefined}>
        <legend className="text-[13px] font-semibold">Người chủ trì</legend>
        <label className="grid gap-1 text-[13px]" htmlFor={ids.search}>
          <span className="sr-only">Tìm người theo tên</span>
          <input
            id={ids.search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, không cần gõ dấu…"
            className="h-9 border border-line-strong bg-surface px-2 outline-none focus:border-primary"
            autoComplete="off"
          />
        </label>
        <ul className="max-h-72 divide-y divide-line overflow-y-auto border border-line bg-surface" aria-label="Chuyên viên của phòng">
          {shown.length === 0 && <li className="px-3 py-3 text-sm text-muted">Không có ai tên khớp &ldquo;{query}&rdquo;.</li>}
          {shown.map((o) => (
            <li key={o.userId}>
              <label className={cn("flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm hover:bg-soft", userId === o.userId && "bg-soft")}>
                <input
                  type="radio"
                  name="userId"
                  value={o.userId}
                  checked={userId === o.userId}
                  onChange={() => {
                    setUserId(o.userId);
                    setErrors((e) => ({ ...e, userId: undefined, note: undefined }));
                  }}
                  className="mt-1 size-4 accent-primary"
                />
                <span className="grid flex-1 gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {o.displayName}
                    {o.isCurrent && <Chip tone="info">Đang chủ trì</Chip>}
                    {o.isDeputy && <Chip tone="neutral">Kiêm nhiệm</Chip>}
                  </span>
                  <span className={cn("text-xs", o.overdue > 0 ? "text-bad" : "text-muted")}>{workload(o)}</span>
                </span>
                {o.holding > 0 && (
                  <Link href={heldHref(o.userId) as "/ho-so"} className="whitespace-nowrap text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                    Xem hồ sơ
                  </Link>
                )}
              </label>
            </li>
          ))}
        </ul>
        {errors.userId && <p id={`${ids.group}-error`} role="alert" className="text-[13px] text-bad">{errors.userId}</p>}
      </fieldset>

      <label className="grid max-w-60 gap-1 text-[13px] font-semibold" htmlFor={ids.due}>
        Hạn nội bộ
        <input
          id={ids.due}
          type="date"
          value={dueOn}
          min={today}
          onChange={(e) => {
            setDueOn(e.target.value);
            setErrors((x) => ({ ...x, dueOn: undefined }));
          }}
          aria-invalid={errors.dueOn ? true : undefined}
          aria-describedby={errors.dueOn ? `${ids.due}-error` : undefined}
          className="h-9 border border-line-strong bg-surface px-2 font-normal outline-none focus:border-primary"
        />
        {errors.dueOn && <span id={`${ids.due}-error`} role="alert" className="font-normal text-bad">{errors.dueOn}</span>}
      </label>

      <label className="grid gap-1 text-[13px] font-semibold" htmlFor={ids.note}>
        Lý do{changing ? " (bắt buộc khi đổi người)" : " (không bắt buộc)"}
        <textarea
          id={ids.note}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setErrors((x) => ({ ...x, note: undefined }));
          }}
          rows={3}
          maxLength={500}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? `${ids.note}-error` : undefined}
          placeholder={changing ? "Ví dụ: Chuyển cho chuyên viên phụ trách địa bàn" : "Ghi chú cho người nhận việc"}
          className="border border-line-strong bg-surface px-2 py-1.5 font-normal outline-none focus:border-primary"
        />
        <span className="flex justify-between font-normal text-muted">
          <span>{changing ? `Tối thiểu ${MIN_NOTE_LENGTH} ký tự; ghi vào Nhật ký của hồ sơ.` : "Ghi vào Nhật ký của hồ sơ."}</span>
          <span aria-hidden>{note.length}/500</span>
        </span>
        {errors.note && <span id={`${ids.note}-error`} role="alert" className="font-normal text-bad">{errors.note}</span>}
      </label>

      {formError && <p role="alert" className="border border-bad bg-bad-soft p-3 text-sm text-bad">{formError}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={action.pending || unchanged}>
          {action.pending ? "Đang lưu…" : changing ? "Giao việc" : "Lưu hạn nội bộ"}
        </Button>
        {unchanged && <span className="text-[13px] text-muted">Chọn người khác hoặc đổi hạn để lưu.</span>}
      </div>
    </form>
  );
}
