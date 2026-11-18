"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { createUser } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { routes } from "@/config/routes";
import { useServerAction } from "@/lib/use-server-action";
import { validateUserForm, type UserForm, type UserFormErrors } from "./user-rules";

const EMPTY: UserForm = { username: "", displayName: "", email: "", externalAuthSubject: "" };

/** Thêm người dùng (FE-42, BE-34). Tạo xong mở trang người đó để thêm phân công: người chưa có phân công thì chưa đăng nhập dùng được. */
export function CreateUserButton() {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(EMPTY);
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const action = useServerAction(createUser, { toastErrors: false });

  function close() {
    if (action.pending) return;
    setOpen(false);
    setForm(EMPTY);
    setErrors({});
    setFormError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const found = validateUserForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const result = await action.run(form);
    if (result.ok) router.push(routes.adminUser(result.data.user.id));
    else if (result.fieldErrors) setErrors({ username: result.fieldErrors.username?.[0], displayName: result.fieldErrors.displayName?.[0], email: result.fieldErrors.email?.[0], externalAuthSubject: result.fieldErrors.externalAuthSubject?.[0] });
    else setFormError(result.errorId ? `${result.message} (Mã lỗi ${result.errorId})` : result.message);
  }

  const bind = (key: keyof UserForm) => ({ id: `${id}-${key}`, value: form[key], autoComplete: "off", onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((c) => ({ ...c, [key]: e.target.value })), "aria-invalid": errors[key] ? true : undefined, "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined });
  const input = "h-9 border border-line-strong bg-surface px-2 text-sm font-normal outline-none focus:border-primary aria-[invalid=true]:border-bad";
  const err = (key: keyof UserForm) => errors[key] && <span id={`${id}-${key}-error`} role="alert" className="text-[13px] font-normal text-bad">{errors[key]}</span>;

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><UserPlus aria-hidden className="size-4" /> Thêm người dùng</Button>
      <Dialog open={open} onClose={close} title="Thêm người dùng" description="Tạo tài khoản rồi thêm phân công ở bước sau. Người chưa có phân công đang hiệu lực chưa dùng được hệ thống."
        footer={<><Button onClick={close} disabled={action.pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-form`} disabled={action.pending}>{action.pending ? "Đang tạo…" : "Tạo người dùng"}</Button></>}>
        <form id={`${id}-form`} onSubmit={submit} className="grid gap-3" noValidate>
          <label className="grid gap-1 text-[13px] font-semibold" htmlFor={`${id}-username`}>Tên đăng nhập
            <input {...bind("username")} placeholder="nguyen.van.a" className={input} />{err("username")}</label>
          <label className="grid gap-1 text-[13px] font-semibold" htmlFor={`${id}-displayName`}>Họ tên hiển thị
            <input {...bind("displayName")} placeholder="Nguyễn Văn A" className={input} />{err("displayName")}</label>
          <label className="grid gap-1 text-[13px] font-semibold" htmlFor={`${id}-email`}>Email (không bắt buộc)
            <input {...bind("email")} type="email" className={input} />{err("email")}</label>
          <label className="grid gap-1 text-[13px] font-semibold" htmlFor={`${id}-externalAuthSubject`}>Mã danh tính ở hệ thống đăng nhập (không bắt buộc)
            <input {...bind("externalAuthSubject")} className={input} />{err("externalAuthSubject")}</label>
          {formError && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{formError}</p>}
        </form>
      </Dialog>
    </>
  );
}
