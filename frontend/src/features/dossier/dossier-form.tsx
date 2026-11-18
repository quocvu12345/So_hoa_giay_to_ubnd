"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createDossier, updateDossier } from "@/app/actions/dossier";
import type { ProcedureSummary } from "@/app/actions/procedure";
import { Button, ButtonLink } from "@/components/ui/button";
import { DateInput, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { useServerAction } from "@/lib/use-server-action";
import { ProcedurePicker } from "./procedure-picker";
import { ACCESS_LEVELS, dueOnForApi, mapApiErrors, validateDossierForm, type DossierFormErrors, type DossierFormValues } from "./dossier-form-rules";

export type GroupChoice = { code: string; title: string; departmentCode: string; departmentName: string };

type Props =
  | { mode: "create"; groups: GroupChoice[]; initial?: Partial<DossierFormValues>; procedure?: ProcedureSummary }
  | { mode: "edit"; dossierId: string; version: number; groups: GroupChoice[]; initial: DossierFormValues; groupLabel: string };

/**
 * Tạo và sửa hồ sơ (FE-27). Kiểm tra ngay khi rời ô, lỗi của API hiện dưới đúng ô.
 * Nhóm hồ sơ gom theo đầu mối (phòng, Ban) và chỉ gồm nhóm phân công đang dùng được tạo. Sửa gửi kèm `version`: người khác vừa sửa thì báo và cho tải lại.
 * Tạo hồ sơ có thể chọn thủ tục hành chính ngay trong form (`ProcedurePicker`); tạo xong mở tab Giấy tờ của hồ sơ mới.
 */
export function DossierForm(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [procedure, setProcedure] = useState<ProcedureSummary | null>(props.mode === "create" ? (props.procedure ?? null) : null);
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
    if (Object.keys(found).length > 0) {
      // Chờ biểu mẫu vẽ lại các ô lỗi rồi đưa tiêu điểm tới ô lỗi đầu tiên theo thứ tự trên trang.
      setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    const payload = { ...values, internalDueOn: dueOnForApi(values.internalDueOn) };
    if (props.mode === "create") {
      const outcome = await create.run(payload, procedure?.id);
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

  return (
    <form
      ref={formRef}
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

      <Input
        label="Tên hồ sơ"
        required
        value={values.title}
        onChange={(e) => set("title", e.target.value)}
        onBlur={() => check("title")}
        error={errors.title}
        hint="Thể hiện vụ việc, kỳ họp hoặc dự án, ví dụ “Hồ sơ kiểm tra môi trường tại cơ sở A”."
      />

      {props.mode === "create" ? (
        <Select
          label="Nhóm hồ sơ"
          required
          value={values.workGroupCode}
          onChange={(e) => set("workGroupCode", e.target.value)}
          error={errors.workGroupCode}
          hint={props.groups.length === 0 ? "Phân công đang dùng không có nhóm hồ sơ nào để tạo." : "Chỉ hiện nhóm thuộc đơn vị của phân công đang dùng. Mã hồ sơ do hệ thống cấp."}
        >
          <option value="">Chọn nhóm…</option>
          {[...byDepartment.entries()].map(([code, entry]) => (
            <optgroup key={code} label={entry.name}>
              {entry.groups.map((g) => (
                <option key={g.code} value={g.code}>{g.code} · {g.title}</option>
              ))}
            </optgroup>
          ))}
        </Select>
      ) : (
        <p className="text-sm"><span className="text-muted">Nhóm hồ sơ: </span><b>{props.groupLabel}</b> <span className="text-xs text-muted">(không đổi được sau khi tạo; giấy tờ đã đối chiếu giữ nguyên)</span></p>
      )}

      {props.mode === "create" && <ProcedurePicker value={procedure} onChange={setProcedure} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Mức tiếp cận" value={values.accessLevel} onChange={(e) => set("accessLevel", e.target.value)} hint={ACCESS_LEVELS.find((l) => l.value === values.accessLevel)?.hint}>
          {ACCESS_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </Select>
        <DateInput
          label="Hạn nội bộ"
          value={values.internalDueOn}
          onValueChange={(value) => set("internalDueOn", value)}
          onBlur={() => check("internalDueOn")}
          error={errors.internalDueOn}
        />
        {props.mode === "create" && (
          <Input
            label="Năm"
            value={values.year}
            inputMode="numeric"
            placeholder={String(new Date().getFullYear())}
            onChange={(e) => set("year", e.target.value)}
            onBlur={() => check("year")}
            error={errors.year}
            hint="Để trống thì lấy năm hiện tại."
          />
        )}
      </div>

      {props.mode === "create" && (
        <Input
          label="Cơ quan hình thành (tùy chọn)"
          value={values.creatorOrganizationName}
          onChange={(e) => set("creatorOrganizationName", e.target.value)}
          hint="Chỉ điền khi hồ sơ do cơ quan khác hình thành rồi bàn giao."
        />
      )}

      <Textarea
        label="Ghi chú (tùy chọn)"
        rows={3}
        maxLength={4000}
        value={values.notes}
        onChange={(e) => set("notes", e.target.value)}
        error={errors.notes}
      />

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
