"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { updateSetting } from "@/app/actions/ops";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { useServerAction } from "@/lib/use-server-action";
import type { Setting } from "./ops-data";
import { MAX_SETTING_LENGTH, parseSettingValue, settingPreview } from "./ops-rules";

/** Mô tả vài cài đặt đã biết, để người quản trị hiểu bật/tắt thì được gì. Khóa lạ vẫn hiện, không có mô tả. */
const KNOWN: Record<string, string> = {
  "dossier.enforce_procedure_components": "true: hồ sơ theo thủ tục chỉ trình được khi đủ thành phần bắt buộc và đã đối chiếu. false: chỉ cảnh báo.",
};

/**
 * Cài đặt hệ thống không nhạy cảm (FE-44, BE-89). Giá trị là JSON. API từ chối khóa chứa bí mật (mật khẩu, token…); bí mật đặt bằng biến môi trường.
 * Mỗi lần sửa ghi nhật ký thay đổi (chỉ tên cột).
 */
export function SettingsPanel({ settings }: { settings: Setting[] }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [editing, setEditing] = useState<Setting | null>(null);
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = useServerAction(updateSetting, { toastErrors: false });
  const parsed = editing ? parseSettingValue(editing.key, text) : null;

  function open(setting: Setting) {
    setEditing(setting);
    setText(JSON.stringify(setting.value, null, 2));
    setTouched(false);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!editing || !parsed || !parsed.ok) return;
    const result = await action.run(editing.key, text);
    if (result.ok) {
      toast.success(`Đã lưu cài đặt ${editing.key}.`);
      setEditing(null);
      router.refresh();
    } else if (result.fieldErrors?.value) setError(result.fieldErrors.value[0]);
    else setError(result.errorId ? `${result.message} (Mã lỗi ${result.errorId})` : result.message);
  }

  if (settings.length === 0) return <p className="border border-dashed border-line-strong p-4 text-sm text-muted">Chưa có cài đặt nào.</p>;
  const problem = touched && parsed && !parsed.ok ? parsed.error : null;

  return (
    <>
      <ul className="grid divide-y divide-line border border-line bg-surface" aria-label="Cài đặt hệ thống">
        {settings.map((s) => (
          <li key={s.key} className="grid gap-1 px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold">{s.key}</span>
              <span className="font-mono text-muted">= {settingPreview(s.value)}</span>
              <Button size="sm" className="ml-auto" onClick={() => open(s)} aria-label={`Sửa cài đặt ${s.key}`}>Sửa</Button>
            </div>
            {KNOWN[s.key] && <p className="text-[13px] text-muted">{KNOWN[s.key]}</p>}
            <p className="text-xs text-muted">Cập nhật {formatDateTime(s.updatedAt)}</p>
          </li>
        ))}
      </ul>
      <Dialog
        open={editing !== null}
        onClose={() => !action.pending && setEditing(null)}
        title={editing ? `Sửa ${editing.key}` : "Sửa cài đặt"}
        description="Giá trị là JSON: true, false, số, chữ trong ngoặc kép, danh sách hoặc đối tượng. Không lưu mật khẩu hay token ở đây."
        footer={<><Button onClick={() => setEditing(null)} disabled={action.pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-form`} disabled={action.pending}>{action.pending ? "Đang lưu…" : "Lưu"}</Button></>}
      >
        <form id={`${id}-form`} onSubmit={submit} className="grid gap-2" noValidate>
          <label htmlFor={`${id}-value`} className="text-[13px] font-semibold">Giá trị</label>
          <textarea id={`${id}-value`} value={text} rows={5} maxLength={MAX_SETTING_LENGTH + 100} onChange={(e) => setText(e.target.value)} className="border border-line-strong bg-surface p-2 font-mono text-sm outline-none focus:border-primary" aria-invalid={problem ? true : undefined} aria-describedby={problem ? `${id}-error` : undefined} />
          {problem && <p id={`${id}-error`} role="alert" className="text-[13px] text-bad">{problem}</p>}
          {error && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{error}</p>}
        </form>
      </Dialog>
    </>
  );
}
