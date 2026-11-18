"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  confirmRetention, createField, createGroup, createType, deleteField, deleteGroup, deleteRetention, deleteType, proposeRetention, updateField, updateGroup, updateType,
} from "@/app/actions/catalog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialog, type FieldSpec, type SubmitOutcome, type Values } from "@/components/ui/form-dialog";
import { Chip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import type { ActionResult } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import type { DocType, FieldDef, RetentionRule, WorkGroup } from "./catalog-data";
import { RETENTION_STATUS, toCount, validateDocumentType, validateField, validateGroup, validateLegalReference, validateRetention, VALUE_TYPE_LABEL, VALUE_TYPES, VERIFICATION } from "./catalog-rules";

const failure = (r: { message: string; errorId?: string }) => (r.errorId ? `${r.message} (Mã lỗi ${r.errorId})` : r.message);
const str = (v: string | boolean | undefined) => String(v ?? "");

/** Kết quả Server Action → kết quả hộp thoại biểu mẫu; lỗi theo ô của API hiện đúng ô. */
function outcome(r: ActionResult<unknown>): SubmitOutcome {
  return r.ok ? { ok: true } : { ok: false, message: failure(r), fieldErrors: r.fieldErrors };
}

type Org = { code: string; name: string };
type Dep = { code: string; name: string; organizationCodes: string[] };

// =====================================================================================================================
// Nhóm hồ sơ
// =====================================================================================================================
export function CreateGroupButton({ orgs, departments }: { orgs: Org[]; departments: Dep[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const fields: FieldSpec[] = [
    { name: "code", label: "Mã nhóm", hint: "2–10 ký tự gồm chữ và số, bắt đầu bằng chữ (ví dụ U35). Không đổi được sau khi tạo.", maxLength: 10 },
    { name: "organizationCode", label: "Cơ quan", kind: "select", options: [{ value: "", label: "Chọn cơ quan…" }, ...orgs.map((o) => ({ value: o.code, label: o.name }))] },
    { name: "departmentCode", label: "Đơn vị phụ trách", kind: "select", options: [{ value: "", label: "Chọn đơn vị…" }, ...departments.map((d) => ({ value: d.code, label: d.name }))] },
    { name: "title", label: "Tên nhóm hồ sơ", maxLength: 300 },
    { name: "responsibility", label: "Trách nhiệm", kind: "textarea", rows: 2 },
    { name: "filingRule", label: "Quy tắc lập hồ sơ", kind: "textarea", rows: 2 },
    { name: "businessFields", label: "Lĩnh vực nghiệp vụ", kind: "textarea", rows: 2 },
  ];
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><Plus aria-hidden className="size-4" /> Thêm nhóm hồ sơ</Button>
      <FormDialog open={open} onClose={() => setOpen(false)} title="Thêm nhóm hồ sơ" description="Nhóm mới dùng được ngay khi đã có ít nhất một loại giấy tờ. Thông tin nghiệp vụ cần được xác nhận sau." submitLabel="Thêm nhóm"
        fields={fields} initial={{ code: "", organizationCode: orgs[0]?.code ?? "", departmentCode: "", title: "", responsibility: "", filingRule: "", businessFields: "" }}
        validate={(v) => validateGroup({ code: str(v.code), title: str(v.title), organizationCode: str(v.organizationCode), departmentCode: str(v.departmentCode) }, "create")}
        onSubmit={async (v) => {
          const result = await createGroup({ code: str(v.code), organizationCode: str(v.organizationCode), departmentCode: str(v.departmentCode), title: str(v.title), responsibility: str(v.responsibility), filingRule: str(v.filingRule), businessFields: str(v.businessFields) });
          if (result.ok) { toast.success(`Đã thêm nhóm ${result.data.code}.`); setOpen(false); router.push(`${routes.adminCatalog}?nhom=${result.data.code}` as "/quan-tri/danh-muc"); router.refresh(); }
          return outcome(result);
        }} />
    </>
  );
}

export function GroupPanel({ group }: { group: WorkGroup }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(run: () => Promise<ActionResult<unknown>>, success: string) {
    setBusy(true);
    setMessage(null);
    const r = await run();
    setBusy(false);
    if (r.ok) { toast.success(success); router.refresh(); } else setMessage(failure(r));
    return r.ok;
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    const r = await deleteGroup(group.code);
    setBusy(false);
    setRemoving(false);
    if (r.ok) { toast.success(`Đã xóa nhóm ${group.code}.`); router.push(routes.adminCatalog); router.refresh(); } else setMessage(failure(r));
  }

  return (
    <section className="grid gap-3 border border-line bg-surface p-4" aria-labelledby="nhom-dang-chon">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id="nhom-dang-chon" className="text-base font-bold">{group.code} · {group.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={group.active ? "ok" : "neutral"}>{group.active ? "Đang dùng" : "Đã ngừng dùng"}</Chip>
          <Chip tone={group.verificationStatus === "confirmed" ? "ok" : "warn"}>{VERIFICATION[group.verificationStatus] ?? group.verificationStatus}</Chip>
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted">Đơn vị phụ trách</dt><dd>{group.departmentCode} · {group.organizationCode}</dd></div>
        <div><dt className="text-xs text-muted">Số loại giấy tờ</dt><dd>{Number(group.documentTypeCount)}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted">Trách nhiệm</dt><dd>{group.responsibility || "Chưa ghi"}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted">Quy tắc lập hồ sơ</dt><dd>{group.filingRule || "Chưa ghi"}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setEditing(true)}>Sửa nhóm</Button>
        {group.verificationStatus !== "confirmed" && <Button size="sm" onClick={() => act(() => updateGroup(group.code, { verificationStatus: "confirmed" }), "Đã xác nhận thông tin nhóm.")} disabled={busy}>Xác nhận thông tin</Button>}
        <Button size="sm" onClick={() => act(() => updateGroup(group.code, { active: !group.active }), group.active ? "Đã ngừng dùng nhóm. Hồ sơ cũ giữ nguyên." : "Đã dùng lại nhóm.")} disabled={busy}>{group.active ? "Ngừng dùng" : "Dùng lại"}</Button>
        {removing ? (
          <span className="flex flex-wrap items-center gap-2"><span className="text-[13px]">Xóa hẳn nhóm này? Chỉ xóa được nhóm chưa có dữ liệu.</span><Button size="sm" variant="danger" onClick={remove} disabled={busy}>Xóa nhóm</Button><Button size="sm" onClick={() => setRemoving(false)}>Giữ lại</Button></span>
        ) : <Button size="sm" variant="danger" onClick={() => { setMessage(null); setRemoving(true); }}>Xóa nhóm…</Button>}
      </div>
      {message && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{message}{message.toLowerCase().includes("dùng") ? "" : " Nếu nhóm đã có dữ liệu, hãy ngừng dùng thay vì xóa."}</p>}
      <FormDialog open={editing} onClose={() => setEditing(false)} title={`Sửa nhóm ${group.code}`} submitLabel="Lưu"
        fields={[{ name: "title", label: "Tên nhóm hồ sơ", maxLength: 300 }, { name: "responsibility", label: "Trách nhiệm", kind: "textarea", rows: 2 }, { name: "filingRule", label: "Quy tắc lập hồ sơ", kind: "textarea", rows: 2 }]}
        initial={{ title: group.title, responsibility: group.responsibility ?? "", filingRule: group.filingRule ?? "" }}
        validate={(v) => validateGroup({ title: str(v.title) }, "edit")}
        onSubmit={async (v: Values) => {
          const result = await updateGroup(group.code, { title: str(v.title), responsibility: str(v.responsibility), filingRule: str(v.filingRule) });
          if (result.ok) { toast.success("Đã lưu nhóm."); setEditing(false); router.refresh(); }
          return outcome(result);
        }} />
    </section>
  );
}

// =====================================================================================================================
// Loại giấy tờ và trường dữ liệu
// =====================================================================================================================
const TYPE_FIELDS: FieldSpec[] = [
  { name: "name", label: "Tên loại giấy tờ", maxLength: 300 },
  { name: "documentForm", label: "Hình thức văn bản", hint: "Ví dụ: Tờ trình, Quyết định, Biên bản. Bỏ trống nếu không cố định." },
  { name: "requiredInDossier", label: "Bắt buộc có trong hồ sơ", kind: "checkbox" },
  { name: "minCount", label: "Số lượng tối thiểu", kind: "number", hint: "Từ 0 đến 100; bỏ trống nếu không quy định." },
];
const FIELD_FIELDS: FieldSpec[] = [
  { name: "label", label: "Tên trường", maxLength: 200 },
  { name: "valueType", label: "Kiểu giá trị", kind: "select", options: VALUE_TYPES.map((t) => ({ value: t.value, label: t.label })) },
  { name: "requiredForReview", label: "Bắt buộc đối chiếu (người dùng phải kiểm trước khi xác nhận)", kind: "checkbox" },
  { name: "isKeyField", label: "Trường quan trọng (hiện đầu danh sách đối chiếu)", kind: "checkbox" },
  { name: "fieldGroup", label: "Nhóm trường", hint: "Ví dụ: Thông tin chung. Bỏ trống nếu không gom nhóm." },
  { name: "validationPattern", label: "Biểu thức kiểm tra giá trị (không bắt buộc)", hint: "Biểu thức chính quy, ví dụ ^\\d+/\\d{4}$ cho số văn bản." },
];

export function TypesPanel({ group, types }: { group: WorkGroup; types: DocType[] }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DocType | null>(null);
  const [fieldFor, setFieldFor] = useState<{ type: DocType; field: FieldDef | null } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(run: () => Promise<ActionResult<unknown>>, success: string) {
    setBusy(true);
    setMessage(null);
    const r = await run();
    setBusy(false);
    setConfirming(null);
    if (r.ok) { toast.success(success); router.refresh(); } else setMessage(failure(r));
  }

  return (
    <section className="grid gap-3 border border-line bg-surface p-4" aria-labelledby="loai-giay-to">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="loai-giay-to" className="text-base font-bold">Loại giấy tờ ({types.length})</h2>
        <Button size="sm" variant="primary" onClick={() => setCreating(true)}><Plus aria-hidden className="size-4" /> Thêm loại giấy tờ</Button>
      </div>
      {message && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{message}</p>}
      {types.length === 0 ? <p className="text-sm text-muted">Nhóm này chưa có loại giấy tờ nào.</p> : (
        <ul className="grid gap-2" aria-label="Loại giấy tờ">
          {types.map((t) => (
            <li key={t.code} className="border border-line">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <b>{t.name}</b>
                <span className="font-mono text-xs text-muted">{t.code}</span>
                {!t.active && <Chip>Đã ngừng dùng</Chip>}
                {t.requiredInDossier && <Chip tone="info">Bắt buộc có{t.minCount ? ` ≥ ${Number(t.minCount)}` : ""}</Chip>}
                {t.documentForm && <Chip>{t.documentForm}</Chip>}
                <span className="ml-auto flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setEditing(t)} aria-label={`Sửa loại ${t.name}`}>Sửa</Button>
                  <Button size="sm" onClick={() => act(() => updateType(t.code, { active: !t.active }), t.active ? "Đã ngừng dùng loại giấy tờ." : "Đã dùng lại loại giấy tờ.")} disabled={busy} aria-label={`${t.active ? "Ngừng dùng" : "Dùng lại"} loại ${t.name}`}>{t.active ? "Ngừng dùng" : "Dùng lại"}</Button>
                  {t.active ? null : confirming === t.code ? (
                    <span className="flex items-center gap-2"><span className="text-[13px]">Xóa hẳn?</span><Button size="sm" variant="danger" onClick={() => act(() => deleteType(t.code), "Đã xóa loại giấy tờ.")} disabled={busy}>Xóa</Button><Button size="sm" onClick={() => setConfirming(null)}>Giữ lại</Button></span>
                  ) : <Button size="sm" variant="danger" onClick={() => setConfirming(t.code)} aria-label={`Xóa loại ${t.name}`}>Xóa…</Button>}
                </span>
              </div>
              <details className="border-t border-line px-3 py-2 text-sm">
                <summary className="cursor-pointer font-semibold">Trường dữ liệu ({t.fields.length})</summary>
                <ul className="mt-2 grid divide-y divide-line border border-line" aria-label={`Trường của ${t.name}`}>
                  {t.fields.map((f) => (
                    <li key={f.code} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                      <span className="font-semibold">{f.label}</span>
                      <Chip>{VALUE_TYPE_LABEL[f.valueType] ?? f.valueType}</Chip>
                      {f.isKeyField && <Chip tone="info">Quan trọng</Chip>}
                      {f.requiredForReview && <Chip tone="warn">Bắt buộc đối chiếu</Chip>}
                      {f.validationPattern && <span className="font-mono text-xs text-muted">{f.validationPattern}</span>}
                      <span className="ml-auto flex gap-2">
                        <Button size="sm" onClick={() => setFieldFor({ type: t, field: f })} aria-label={`Sửa trường ${f.label}`}>Sửa</Button>
                        {confirming === f.code ? (
                          <span className="flex items-center gap-2"><Button size="sm" variant="danger" onClick={() => act(() => deleteField(f.code), "Đã xóa trường.")} disabled={busy}>Xóa trường</Button><Button size="sm" onClick={() => setConfirming(null)}>Giữ lại</Button></span>
                        ) : <Button size="sm" variant="danger" onClick={() => setConfirming(f.code)} aria-label={`Xóa trường ${f.label}`}>Xóa…</Button>}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2"><Button size="sm" onClick={() => setFieldFor({ type: t, field: null })} aria-label={`Thêm trường cho ${t.name}`}><Plus aria-hidden className="size-4" /> Thêm trường</Button></div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <FormDialog open={creating} onClose={() => setCreating(false)} title={`Thêm loại giấy tờ cho nhóm ${group.code}`} description="Mã loại do hệ thống tự cấp. Thêm trường dữ liệu sau khi tạo." submitLabel="Thêm loại"
        fields={TYPE_FIELDS} initial={{ name: "", documentForm: "", requiredInDossier: false, minCount: "" }}
        validate={(v) => validateDocumentType({ name: str(v.name), minCount: str(v.minCount) })}
        onSubmit={async (v) => {
          const r = await createType({ workGroupCode: group.code, name: str(v.name), documentForm: str(v.documentForm), requiredInDossier: Boolean(v.requiredInDossier), minCount: toCount(str(v.minCount)) });
          if (r.ok) { toast.success(`Đã thêm loại giấy tờ ${r.data.name}.`); setCreating(false); router.refresh(); }
          return outcome(r);
        }} />
      <FormDialog open={editing !== null} onClose={() => setEditing(null)} title={editing ? `Sửa loại ${editing.name}` : "Sửa loại giấy tờ"} submitLabel="Lưu"
        fields={TYPE_FIELDS} initial={{ name: editing?.name ?? "", documentForm: editing?.documentForm ?? "", requiredInDossier: Boolean(editing?.requiredInDossier), minCount: editing?.minCount == null ? "" : String(editing.minCount) }}
        validate={(v) => validateDocumentType({ name: str(v.name), minCount: str(v.minCount) })}
        onSubmit={async (v) => {
          if (!editing) return { ok: true };
          const r = await updateType(editing.code, { name: str(v.name), documentForm: str(v.documentForm), requiredInDossier: Boolean(v.requiredInDossier), minCount: toCount(str(v.minCount)) });
          if (r.ok) { toast.success("Đã lưu loại giấy tờ."); setEditing(null); router.refresh(); }
          return outcome(r);
        }} />
      <FormDialog open={fieldFor !== null} onClose={() => setFieldFor(null)} title={fieldFor?.field ? `Sửa trường ${fieldFor.field.label}` : `Thêm trường cho ${fieldFor?.type.name ?? ""}`}
        description="Mã và thứ tự trường do hệ thống tự cấp. Giá trị trường đã nhập ở giấy tờ cũ giữ nguyên khi sửa tên hoặc kiểu." submitLabel={fieldFor?.field ? "Lưu" : "Thêm trường"}
        fields={FIELD_FIELDS}
        initial={{ label: fieldFor?.field?.label ?? "", valueType: fieldFor?.field?.valueType ?? "text", requiredForReview: Boolean(fieldFor?.field?.requiredForReview), isKeyField: Boolean(fieldFor?.field?.isKeyField), fieldGroup: fieldFor?.field?.fieldGroup ?? "", validationPattern: fieldFor?.field?.validationPattern ?? "" }}
        validate={(v) => validateField({ label: str(v.label), valueType: str(v.valueType), validationPattern: str(v.validationPattern) })}
        onSubmit={async (v) => {
          if (!fieldFor) return { ok: true };
          const input = { label: str(v.label), valueType: str(v.valueType), requiredForReview: Boolean(v.requiredForReview), isKeyField: Boolean(v.isKeyField), fieldGroup: str(v.fieldGroup), validationPattern: str(v.validationPattern) };
          const r = fieldFor.field ? await updateField(fieldFor.field.code, input) : await createField(fieldFor.type.code, input);
          if (r.ok) { toast.success(fieldFor.field ? "Đã lưu trường." : "Đã thêm trường."); setFieldFor(null); router.refresh(); }
          return outcome(r);
        }} />
    </section>
  );
}

// =====================================================================================================================
// Thời hạn bảo quản
// =====================================================================================================================
export function RetentionPanel({ group, rules, types }: { group: WorkGroup; rules: RetentionRule[]; types: DocType[] }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<RetentionRule | null>(null);
  const [legal, setLegal] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const problem = validateLegalReference(legal);
  const typeName = (code: string | null | undefined) => (code ? (types.find((t) => t.code === code)?.name ?? code) : "Cả nhóm");

  async function doConfirm() {
    setTouched(true);
    setError(null);
    if (!confirming || problem) return;
    setBusy(true);
    const r = await confirmRetention(confirming.id, legal);
    setBusy(false);
    if (r.ok) { toast.success("Đã xác nhận thời hạn bảo quản. Từ nay hồ sơ đủ năm được đề nghị hủy."); setConfirming(null); setLegal(""); setTouched(false); router.refresh(); } else setError(failure(r));
  }

  async function remove(rule: RetentionRule) {
    setMessage(null);
    const r = await deleteRetention(rule.id);
    if (r.ok) { toast.success("Đã xóa đề xuất."); router.refresh(); } else setMessage(failure(r));
  }

  return (
    <section className="grid gap-3 border border-line bg-surface p-4" aria-labelledby="bao-quan">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="bao-quan" className="text-base font-bold">Thời hạn bảo quản</h2>
        <Button size="sm" onClick={() => setCreating(true)}><Plus aria-hidden className="size-4" /> Đề xuất thời hạn</Button>
      </div>
      <p className="text-[13px] text-muted">Hệ thống không tự đặt thời hạn. Đề xuất chỉ có hiệu lực sau khi được xác nhận kèm căn cứ pháp lý; hồ sơ chỉ được đề nghị hủy khi đã lưu trữ đủ số năm theo quy tắc ĐÃ xác nhận.</p>
      {message && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{message}</p>}
      {rules.length === 0 ? <p className="text-sm text-muted">Nhóm này chưa có quy tắc bảo quản nào.</p> : (
        <ul className="grid divide-y divide-line border border-line" aria-label="Quy tắc bảo quản">
          {rules.map((r) => (
            <li key={r.id} className="grid gap-1 px-3 py-2.5 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <b>{r.retentionLabel}</b>
                {r.retentionYears != null && <span className="text-muted">({Number(r.retentionYears)} năm)</span>}
                <Chip>{typeName(r.documentTypeCode)}</Chip>
                <Chip tone={r.status === "confirmed" ? "ok" : "warn"}>{RETENTION_STATUS[r.status] ?? r.status}</Chip>
                {r.status !== "confirmed" && (
                  <span className="ml-auto flex gap-2">
                    <Button size="sm" variant="primary" onClick={() => { setConfirming(r); setLegal(""); setTouched(false); setError(null); }} aria-label={`Xác nhận thời hạn ${r.retentionLabel}`}>Xác nhận…</Button>
                    <Button size="sm" variant="danger" onClick={() => remove(r)} aria-label={`Xóa đề xuất ${r.retentionLabel}`}>Xóa đề xuất</Button>
                  </span>
                )}
              </span>
              {r.legalReference && <span className="text-xs text-muted">Căn cứ: {r.legalReference}{r.confirmedAt ? ` · xác nhận ${formatDate(r.confirmedAt)}` : ""}</span>}
            </li>
          ))}
        </ul>
      )}

      <FormDialog open={creating} onClose={() => setCreating(false)} title={`Đề xuất thời hạn bảo quản cho nhóm ${group.code}`} submitLabel="Đề xuất"
        description="Đề xuất chưa có hiệu lực. Người có thẩm quyền xác nhận kèm căn cứ pháp lý ở bước sau."
        fields={[
          { name: "documentTypeCode", label: "Áp dụng cho", kind: "select", options: [{ value: "", label: "Cả nhóm hồ sơ" }, ...types.map((t) => ({ value: t.code, label: t.name }))] },
          { name: "retentionLabel", label: "Thời hạn", hint: 'Ví dụ: "20 năm", "Vĩnh viễn".', maxLength: 100 },
          { name: "retentionYears", label: "Số năm (bỏ trống nếu vĩnh viễn)", kind: "number", hint: "Dùng để tính hồ sơ đủ điều kiện hủy; từ 0 đến 200." },
        ]}
        initial={{ documentTypeCode: "", retentionLabel: "", retentionYears: "" }}
        validate={(v) => validateRetention({ retentionLabel: str(v.retentionLabel), retentionYears: str(v.retentionYears) })}
        onSubmit={async (v) => {
          const r = await proposeRetention({ workGroupCode: group.code, documentTypeCode: str(v.documentTypeCode) || null, retentionLabel: str(v.retentionLabel), retentionYears: toCount(str(v.retentionYears)) });
          if (r.ok) { toast.success("Đã đề xuất thời hạn bảo quản."); setCreating(false); router.refresh(); }
          return outcome(r);
        }} />
      <Dialog open={confirming !== null} onClose={() => !busy && setConfirming(null)} title={confirming ? `Xác nhận thời hạn ${confirming.retentionLabel}` : "Xác nhận"}
        description="Xác nhận ghi tên bạn và căn cứ pháp lý vào quy tắc. Từ lúc này hồ sơ đủ số năm được phép đề nghị hủy."
        footer={<><Button onClick={() => setConfirming(null)} disabled={busy}>Hủy</Button><Button variant="primary" onClick={doConfirm} disabled={busy}>{busy ? "Đang xác nhận…" : "Xác nhận"}</Button></>}>
        <div className="grid gap-1">
          <label htmlFor="can-cu-phap-ly" className="text-[13px] font-semibold">Căn cứ pháp lý (từ 5 ký tự)</label>
          <input id="can-cu-phap-ly" value={legal} onChange={(e) => setLegal(e.target.value)} placeholder="Ví dụ: Thông tư 01/2020/TT-BNV, Phụ lục II" autoComplete="off" className="h-9 border border-line-strong bg-surface px-2 text-sm outline-none focus:border-primary" aria-invalid={touched && problem ? true : undefined} />
          {touched && problem && <p role="alert" className="text-[13px] text-bad">{problem}</p>}
          {error && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{error}</p>}
        </div>
      </Dialog>
    </section>
  );
}
