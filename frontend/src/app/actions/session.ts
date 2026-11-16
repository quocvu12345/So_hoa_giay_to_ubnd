"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ASSIGNMENT_COOKIE, MOCK_USER_COOKIE, serverEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { MOCK_ACCOUNTS } from "@/lib/mock/accounts";

const cookieBase = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production" };

/** Chỉ cho đường dẫn nội bộ, chặn chuyển hướng ra ngoài (open redirect). */
function safeReturnTo(value: FormDataEntryValue | null): string {
  const text = typeof value === "string" ? value : "";
  return text.startsWith("/") && !text.startsWith("//") && !text.startsWith("/\\") ? text : "/viec-cua-toi";
}

/** Đổi phân công đang dùng. Phân công phải thuộc người dùng hiện tại; API kiểm tra lại lần nữa. */
export async function switchAssignment(formData: FormData) {
  const session = await getSession();
  const id = formData.get("assignmentId");
  if (!session || typeof id !== "string" || !session.assignments.some((a) => a.id === id)) {
    log.warn("assignment_switch_rejected", { requested: id });
    return;
  }
  (await cookies()).set(ASSIGNMENT_COOKIE, id, { ...cookieBase, maxAge: 60 * 60 * 12 });
  redirect("/viec-cua-toi");
}

/** Đăng nhập GIẢ LẬP, chỉ khi HOSO_MOCK=1. Bản thật đăng nhập qua /api/v1/auth/login của API .NET. */
export async function mockSignIn(formData: FormData) {
  if (!serverEnv().mock) throw new Error("Đăng nhập giả lập đang tắt.");
  const username = formData.get("username");
  const account = MOCK_ACCOUNTS.find((a) => a.username === username);
  if (!account) return;
  const store = await cookies();
  store.set(MOCK_USER_COOKIE, account.username, { ...cookieBase, maxAge: 60 * 60 * 12 });
  store.delete(ASSIGNMENT_COOKIE);
  log.info("mock_sign_in", { username: account.username });
  redirect(safeReturnTo(formData.get("returnTo")) as "/viec-cua-toi");
}

export async function mockSignOut() {
  const store = await cookies();
  store.delete(MOCK_USER_COOKIE);
  store.delete(ASSIGNMENT_COOKIE);
  redirect("/dang-nhap");
}
