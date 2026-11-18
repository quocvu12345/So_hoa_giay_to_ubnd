"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer } from "lucide-react";
import { createLocation, placeDossier, updateLocation } from "@/app/actions/storage";
import { Button, buttonClass } from "@/components/ui/button";
import { FormDialog, type SubmitOutcome } from "@/components/ui/form-dialog";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import type { ActionResult } from "@/lib/action-result";
import { useServerAction } from "@/lib/use-server-action";
import { childKinds, KIND_LABEL, validateLocation } from "./location-rules";
import type { LocationNode } from "./storage-data";

const failure = (r: { message: string; errorId?: string }) => (r.errorId ? `${r.message} (Mã lỗi ${r.errorId})` : r.message);
const str = (v: string | boolean | undefined) => String(v ?? "");
function outcome(r: ActionResult<unknown>): SubmitOutcome {
  return r.ok ? { ok: true } : { ok: false, message: failure(r), fieldErrors: r.fieldErrors };
}

/** Thêm vị trí: ở trang Kho (gốc, cấp "Kho") hoặc trong một vị trí (cấp con sâu hơn). */
export function AddLocationButton({ parent, label }: { parent: Pick<LocationNode, "id" | "kind" | "name"> | null; label?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const kinds = childKinds(parent?.kind ?? null);
  if (kinds.length === 0) return null;
  return (
    <>
      <Button size="sm" variant={parent ? "secondary" : "primary"} onClick={() => setOpen(true)}><Plus aria-hidden className="size-4" /> {label ?? (parent ? "Thêm vị trí con" : "Thêm kho")}</Button>
      <FormDialog open={open} onClose={() => setOpen(false)} title={parent ? `Thêm vị trí trong ${parent.name}` : "Thêm kho"} submitLabel="Thêm vị trí"
        description="Mã in trên nhãn QR dán lên hộp, kệ; không đổi được sau khi tạo. Quét nhãn ở trang Kho bản giấy để mở đúng vị trí."
        fields={[
          { name: "kind", label: "Cấp", kind: "select", options: kinds.map((k) => ({ value: k, label: KIND_LABEL[k] })) },
          { name: "code", label: "Mã vị trí", hint: "Chữ, số, dấu chấm, gạch ngang hoặc gạch dưới; tối đa 40 ký tự. Ví dụ K1-T2-H07.", maxLength: 40 },
          { name: "name", label: "Tên vị trí", maxLength: 200 },
          { name: "capacityNote", label: "Ghi chú sức chứa (không bắt buộc)", maxLength: 200 },
        ]}
        initial={{ kind: kinds[0], code: "", name: "", capacityNote: "" }}
        validate={(v) => validateLocation({ code: str(v.code), name: str(v.name) }, "create")}
        onSubmit={async (v) => {
          const result = await createLocation({ parentId: parent?.id ?? null, parentKind: parent?.kind ?? null, kind: str(v.kind), code: str(v.code), name: str(v.name), capacityNote: str(v.capacityNote) });
          if (result.ok) {
            toast.success(`Đã thêm ${KIND_LABEL[result.data.kind] ?? "vị trí"} ${result.data.name}.`);
            setOpen(false);
            router.push(`${routes.storageLocation(result.data.id)}` as never);
            router.refresh();
          }
          return outcome(result);
        }} />
    </>
  );
}

/** Sửa tên, ghi chú và ngừng dùng/dùng lại một vị trí. */
export function LocationActions({ location, labelsHref }: { location: LocationNode; labelsHref: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const toggle = useServerAction(updateLocation, { toastErrors: false });

  async function setActive(active: boolean) {
    setMessage(null);
    const result = await toggle.run(location.id, { active });
    if (result.ok) { toast.success(active ? "Đã dùng lại vị trí." : "Đã ngừng dùng vị trí."); router.refresh(); } else setMessage(failure(result));
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <AddLocationButton parent={location} />
        <Button size="sm" onClick={() => setEditing(true)}>Sửa</Button>
        <Button size="sm" onClick={() => setActive(!location.active)} disabled={toggle.pending}>{location.active ? "Ngừng dùng" : "Dùng lại"}</Button>
        {labelsHref && <a href={labelsHref} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")} title="Mở nhãn QR (PDF A4, 24 nhãn mỗi trang) của vị trí này và mọi vị trí con đang dùng"><Printer aria-hidden className="size-4" /> In nhãn cả nhánh</a>}
      </div>
      {message && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{message}</p>}
      <FormDialog open={editing} onClose={() => setEditing(false)} title={`Sửa ${location.name}`} submitLabel="Lưu"
        fields={[{ name: "name", label: "Tên vị trí", maxLength: 200 }, { name: "capacityNote", label: "Ghi chú sức chứa", maxLength: 200 }]}
        initial={{ name: location.name, capacityNote: "" }}
        validate={(v) => validateLocation({ name: str(v.name) }, "edit")}
        onSubmit={async (v) => {
          const result = await updateLocation(location.id, { name: str(v.name), capacityNote: str(v.capacityNote) });
          if (result.ok) { toast.success("Đã lưu vị trí."); setEditing(false); router.refresh(); }
          return outcome(result);
        }} />
    </div>
  );
}

/** Đặt hoặc chuyển vị trí bản giấy của một hồ sơ (chỉ hộp hoặc kệ còn dùng). */
export function PlaceDossierButton({ dossierId, current, choices }: { dossierId: string; current: string | null; choices: { id: string; path: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const action = useServerAction(placeDossier, { toastErrors: false });

  async function submit(locationId: string | null) {
    setError(null);
    const result = await action.run(dossierId, locationId, note);
    if (result.ok) {
      toast.success(locationId ? `Đã đặt hồ sơ ở ${result.data.path}.` : "Đã gỡ vị trí bản giấy của hồ sơ.");
      setOpen(false);
      router.refresh();
    } else setError(failure(result));
  }

  return (
    <>
      <Button size="sm" onClick={() => { setTarget(""); setNote(""); setError(null); setOpen(true); }}>{current ? "Chuyển vị trí" : "Đặt vị trí"}</Button>
      <Dialog open={open} onClose={() => !action.pending && setOpen(false)} title={current ? "Chuyển vị trí bản giấy" : "Đặt vị trí bản giấy"} description={current ? `Hiện ở: ${current}. Lịch sử chuyển được ghi kèm ghi chú.` : "Chọn hộp hoặc kệ đang dùng. Lịch sử đặt được ghi kèm ghi chú."}
        footer={<><Button onClick={() => setOpen(false)} disabled={action.pending}>Hủy</Button>{current && <Button variant="danger" onClick={() => submit(null)} disabled={action.pending}>Gỡ vị trí</Button>}<Button variant="primary" onClick={() => target && submit(target)} disabled={action.pending || !target}>{action.pending ? "Đang lưu…" : "Lưu vị trí"}</Button></>}>
        <div className="grid gap-3">
          <label className="grid gap-1 text-[13px] font-semibold">Vị trí mới
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="h-9 border border-line-strong bg-surface px-2 text-sm font-normal outline-none focus:border-primary">
              <option value="">Chọn hộp hoặc kệ…</option>
              {choices.map((c) => <option key={c.id} value={c.id}>{c.path}</option>)}
            </select>
          </label>
          {choices.length === 0 && <p className="text-sm text-muted">Chưa có hộp hoặc kệ nào đang dùng. Thêm ở trang Kho bản giấy.</p>}
          <label className="grid gap-1 text-[13px] font-semibold">Ghi chú (không bắt buộc)
            <textarea value={note} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Chuyển sau khi kiểm kê" className="border border-line-strong bg-surface p-2 text-sm font-normal outline-none focus:border-primary" />
          </label>
          {error && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{error}</p>}
        </div>
      </Dialog>
    </>
  );
}
