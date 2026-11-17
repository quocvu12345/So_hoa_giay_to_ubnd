"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createDossier, updateDossier } from "@/app/actions/dossier";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { useServerAction } from "@/lib/use-server-action";
import { ACCESS_LEVELS, dueOnForApi, mapApiErrors, validateDossierForm, type DossierFormErrors, type DossierFormValues } from "./dossier-form-rules";

export type GroupChoice = { code: string; title: string; departmentCode: string; departmentName: string };

type Props =
  | { mode: "create"; groups: GroupChoice[]; initial?: Partial<DossierFormValues> }
  | { mode: "edit"; dossierId: string; version: number; groups: GroupChoice[]; initial: DossierFormValues; groupLabel: string };

/**
 * Tạo và sửa hồ sơ (FE-27). Kiểm tra ngay khi rời ô, lỗi của API hiện dưới đúng ô.
 * Nhóm hồ sơ gom theo đầu mối (phòng, Ban) và chỉ gồm nhóm phân công đang dùng được tạo. Sửa gửi kèm `version`: người khác vừa sửa thì báo và cho tải lại.
 * Tạo xong mở tab Giấy tờ của hồ sơ mới.
 */
export function DossierForm(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const ids = { title: useId(), group: useId(), access: useId(), due: useId(), year: useId(), creator: useId(), notes: useId() };
  const [values, setValues] = useState<DossierFormValues>({
    title: "", workGroupCode: props.groups.length === 1 ? props.groups[0].code : "", accessLevel: "internal", internalDueOn: "", notes: "", year: "", creatorOrganizationName: "",
    ...props.initial,
  });
  const [errors, setErrors] = useState<DossierFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const create = useServerAction(createDossier, { toastErrors: false });
  const update = useServerAction(updateDossier, { toastErrors: false });
  const pending = create.pending || update.pending;

  const set = <K extends keyof DossierFormValues>(key: K, value: DossierFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };
  const check = (key: keyof DossierFormValues) => {
    const found = validateDossierForm(values, props.mode)[key];
    setErrors((current) => (current[key] === found ? current : { ...current, [key]: found }));
  };

  async function submit() {
    setFormError(null);
    const found = validateDossierForm(values, props.mode);
    setErrors(found);
    const first = (Object.keys(found) as (keyof DossierFormValues)[])[0];
    if (first) {
      const idOf = { title: ids.title, workGroupCode: ids.group, accessLevel: ids.access, internalDueOn: ids.due, notes: ids.notes, year: ids.year, creatorOrganizationName: ids.creator }[first];
      document.getElementById(idOf)?.focus();
      return;
    }
    const payload = { ...values, internalDueOn: dueOnForApi(values.internalDueOn) };
    if (props.mode === "create") {
      const outcome = await create.run(payload);
      if (outcome.ok) {
        toast.success(`Đã tạo hồ sơ ${outcome.data.code}. Thêm giấy tờ vào hồ sơ ở bước này.`);
        router.push(routes.dossierDocuments(outcome.data.id));
        return;
      }
      report(outcome);
      return;
    }
    const outcome = await update.run(props.dossierId, props.version, payload);
    if (outcome.ok) {
      toast.success("Đã lưu thông tin hồ sơ.");
      router.push(routes.dossier(props.dossierId));
      return;
    }
    if (outcome.status === 409) {
      setConflict(true);
      return;
    }
    report(outcome);
  }

  function report(outcome: { message: string; errorId?: string; fieldErrors?: Record<string, string[]> }) {
    const { fields, other } = mapApiErrors(outcome.fieldErrors);
    setErrors(fields);
    if (Object.keys(fields).length === 0 || other.length > 0) setFormError(outcome.errorId ? `${outcome.message} (Mã lỗi: ${outcome.errorId})` : [outcome.message, ...other].join(" "));
  }

  const byDepartment = new Map<string, { name: string; groups: GroupChoice[] }>();
  for (const g of props.groups) {
    const entry = byDepartment.get(g.departmentCode) ?? { name: g.departmentName, groups: [] };
    entry.groups.push(g);
    byDepartment.set(g.departmentCode, entry);
  }

  const field = (key: keyof DossierFormValues) => cn("border bg-surface px-2 text-sm", errors[key] ? "border-bad" : "border-line-strong");
  const message = (key: keyof DossierFormValues) => errors[key] && <p className="text-xs text-bad">{errors[key]}</p>;

  return (
    <form
      noValidate
      className="grid max-w-3xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {conflict && (
        <div role="alert" className="grid gap-2 border border-warn bg-warn-soft p-3 text-sm text-warn">
          <p>Hồ sơ vừa được người khác sửa nên chưa lưu được. Tải lại để xem bản mới; thay đổi của bạn trong biểu mẫu này sẽ mất.</p>
          <Button className="justify-self-start" onClick={() => router.refresh()}>Tải lại hồ sơ</Button>
        </div>
      )}

      <div className="grid gap-1">
        <label htmlFor={ids.title} className="text-[13px] font-semibold">Tên hồ sơ <span className="text-bad" title="Bắt buộc">*</span></label>
        <input id={ids.title} value={values.title} onChange={(e) => set("title", e.target.value)} onBlur={() => check("title")} aria-invalid={errors.title ? true : undefined} className={cn(field("title"), "h-10")} />
        <p className="text-xs text-muted">Thể hiện vụ việc, kỳ họp hoặc dự án, ví dụ “Hồ sơ kiểm tra môi trường tại cơ sở A”.</p>
        {message("title")}
      </div>

      {props.mode === "create" ? (
        <div className="grid gap-1">
          <label htmlFor={ids.group} className="text-[13px] font-semibold">Nhóm hồ sơ <span className="text-bad" title="Bắt buộc">*</span></label>
          <select id={ids.group} value={values.workGroupCode} onChange={(e) => set("workGroupCode", e.target.value)} aria-invalid={errors.workGroupCode ? true : undefined} className={cn(field("workGroupCode"), "h-10")}>
            <option value="">Chọn nhóm…</option>
            {[...byDepartment.entries()].map(([code, entry]) => (
              <optgroup key={code} label={entry.name}>
                {entry.groups.map((g) => (
                  <option key={g.code} value={g.code}>{g.code} · {g.title}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-xs text-muted">
            {props.groups.length === 0 ? "Phân công đang dùng không có nhóm hồ sơ nào để tạo." : "Chỉ hiện nhóm thuộc đơn vị của phân công đang dùng. Mã hồ sơ do hệ thống cấp."}
          </p>
          {message("workGroupCode")}
        </div>
      ) : (
        <p className="text-sm"><span className="text-muted">Nhóm hồ sơ: </span><b>{props.groupLabel}</b> <span className="text-xs text-muted">(không đổi được sau khi tạo; giấy tờ đã đối chiếu giữ nguyên)</span></p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1">
          <label htmlFor={ids.access} className="text-[13px] font-semibold">Mức tiếp cận</label>
          <select id={ids.access} value={values.accessLevel} onChange={(e) => set("accessLevel", e.target.value)} className={cn(field("accessLevel"), "h-10")}>
            {ACCESS_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <p className="text-xs text-muted">{ACCESS_LEVELS.find((l) => l.value === values.accessLevel)?.hint}</p>
        </div>
        <div className="grid gap-1">
          <label htmlFor={ids.due} className="text-[13px] font-semibold">Hạn nội bộ</label>
          <input id={ids.due} value={values.internalDueOn} inputMode="numeric" placeholder="dd/mm/yyyy" onChange={(e) => set("internalDueOn", e.target.value)} onBlur={() => check("internalDueOn")} aria-invalid={errors.internalDueOn ? true : undefined} className={cn(field("internalDueOn"), "h-10")} />
          {message("internalDueOn")}
        </div>
        {props.mode === "create" && (
          <div className="grid gap-1">
            <label htmlFor={ids.year} className="text-[13px] font-semibold">Năm</label>
            <input id={ids.year} value={values.year} inputMode="numeric" placeholder={String(new Date().getFullYear())} onChange={(e) => set("year", e.target.value)} onBlur={() => check("year")} aria-invalid={errors.year ? true : undefined} className={cn(field("year"), "h-10 tabular-nums")} />
            <p className="text-xs text-muted">Để trống thì lấy năm hiện tại.</p>
            {message("year")}
          </div>
        )}
      </div>

      {props.mode === "create" && (
        <div className="grid gap-1">
          <label htmlFor={ids.creator} className="text-[13px] font-semibold">Cơ quan hình thành (tùy chọn)</label>
          <input id={ids.creator} value={values.creatorOrganizationName} onChange={(e) => set("creatorOrganizationName", e.target.value)} className={cn(field("creatorOrganizationName"), "h-10")} />
          <p className="text-xs text-muted">Chỉ điền khi hồ sơ do cơ quan khác hình thành rồi bàn giao.</p>
        </div>
      )}

      <div className="grid gap-1">
        <label htmlFor={ids.notes} className="flex justify-between text-[13px] font-semibold">
          <span>Ghi chú (tùy chọn)</span>
          <span className="font-normal text-muted tabular-nums">{values.notes.length}/4000</span>
        </label>
        <textarea id={ids.notes} rows={3} maxLength={4000} value={values.notes} onChange={(e) => set("notes", e.target.value)} className={cn(field("notes"), "py-1.5")} />
        {message("notes")}
      </div>

      {formError && <p role="alert" className="border border-bad bg-bad-soft p-3 text-sm text-bad">{formError}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href={props.mode === "edit" ? routes.dossier(props.dossierId) : routes.dossiers}>Hủy</ButtonLink>
        <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
          {pending ? "Đang lưu…" : props.mode === "create" ? "Tạo hồ sơ" : "Lưu thông tin"}
        </Button>
      </div>
      {props.mode === "edit" && <p className="text-xs text-muted">Giấy tờ trong hồ sơ không đổi khi sửa thông tin.</p>}
    </form>
  );
}
