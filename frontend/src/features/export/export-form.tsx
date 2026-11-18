"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createExport } from "@/app/actions/exports";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useServerAction } from "@/lib/use-server-action";
import { DOSSIER_STATUS_CHOICES, EXPORT_FORMATS, MAX_DOSSIERS, validateExportForm, type ExportErrors, type ExportForm as Form } from "./export-rules";

export type GroupChoice = { code: string; title: string };

const select = "h-10 min-w-0 border border-line-strong bg-surface px-2 text-sm font-normal outline-none focus:border-primary aria-[invalid=true]:border-bad";

/**
 * Tạo gói xuất bàn giao (FE-38, BE-86): chọn điều kiện lọc (trạng thái, nhóm hồ sơ, khoảng thời gian lưu trữ) và định dạng. API chốt danh sách hồ sơ
 * trong phạm vi của người yêu cầu (tối đa 2.000) rồi đóng ZIP nền; gói hiện ở danh sách bên dưới và báo tiến độ trực tiếp.
 */
export function ExportForm({ groups }: { groups: GroupChoice[] }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [form, setForm] = useState<Form>({ status: "archived", workGroupCode: "", archivedFrom: "", archivedTo: "", format: EXPORT_FORMATS[0].value });
  const [errors, setErrors] = useState<ExportErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const action = useServerAction(createExport, { toastErrors: false });
  const format = EXPORT_FORMATS.find((f) => f.value === form.format);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const found = validateExportForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const result = await action.run(form);
    if (result.ok) {
      toast.success(`Đã tạo gói xuất ${Number(result.data.totalItems)} hồ sơ. Gói được đóng nền, báo ngay khi xong.`);
      router.refresh();
    } else setMessage(result.errorId ? `${result.message} (Mã lỗi ${result.errorId})` : result.message);
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((c) => ({ ...c, [key]: value }));
    setErrors((c) => ({ ...c, [key]: undefined, scope: undefined }));
  };

  return (
    <form onSubmit={submit} className="grid gap-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-[13px] font-semibold" htmlFor={`${id}-status`}>Trạng thái hồ sơ
          <select id={`${id}-status`} value={form.status} onChange={(e) => set("status", e.target.value)} className={select}>
            <option value="">Tất cả trạng thái</option>
            {DOSSIER_STATUS_CHOICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[13px] font-semibold" htmlFor={`${id}-group`}>Nhóm hồ sơ
          <select id={`${id}-group`} value={form.workGroupCode} onChange={(e) => set("workGroupCode", e.target.value)} className={select}>
            <option value="">Tất cả nhóm</option>
            {groups.map((g) => <option key={g.code} value={g.code}>{g.title}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[13px] font-semibold" htmlFor={`${id}-from`}>Lưu trữ từ ngày
          <input id={`${id}-from`} type="date" value={form.archivedFrom} onChange={(e) => set("archivedFrom", e.target.value)} className={select} aria-invalid={errors.archivedFrom ? true : undefined} />
          {errors.archivedFrom && <span role="alert" className="text-[13px] font-normal text-bad">{errors.archivedFrom}</span>}
        </label>
        <label className="grid gap-1 text-[13px] font-semibold" htmlFor={`${id}-to`}>Đến ngày
          <input id={`${id}-to`} type="date" value={form.archivedTo} onChange={(e) => set("archivedTo", e.target.value)} className={select} aria-invalid={errors.archivedTo ? true : undefined} />
          {errors.archivedTo && <span role="alert" className="text-[13px] font-normal text-bad">{errors.archivedTo}</span>}
        </label>
      </div>
      <label className="grid max-w-xl gap-1 text-[13px] font-semibold" htmlFor={`${id}-format`}>Định dạng gói
        <select id={`${id}-format`} value={form.format} onChange={(e) => set("format", e.target.value)} className={select}>
          {EXPORT_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        {format && <span className="text-xs font-normal text-muted">{format.hint}</span>}
      </label>
      <p className="text-[13px] text-muted">Chỉ gồm hồ sơ trong phạm vi phân công đang dùng, tối đa {MAX_DOSSIERS.toLocaleString("vi-VN")} hồ sơ một gói; quá thì thu hẹp điều kiện rồi xuất từng phần. Gói giữ 7 ngày và chỉ bạn tải được.</p>
      {errors.scope && <p role="alert" className="text-sm text-bad">{errors.scope}</p>}
      {message && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{message}</p>}
      <div><Button type="submit" variant="primary" disabled={action.pending}>{action.pending ? "Đang tạo gói…" : "Tạo gói xuất"}</Button></div>
    </form>
  );
}
