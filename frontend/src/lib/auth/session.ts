import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api/server";
import { ASSIGNMENT_COOKIE, MOCK_USER_COOKIE, serverEnv } from "@/lib/env";
import { MOCK_ACCOUNTS, MOCK_ROLE_PERMISSIONS } from "@/lib/mock/accounts";
import { hasAny, type Permission } from "./permissions";
import type { Session } from "./types";

/**
 * Lớp truy cập phiên (Data Access Layer). Mọi trang và Server Action lấy người dùng qua đây.
 * Phiên thật do API .NET giữ (cookie httpOnly); Next chỉ hỏi lại /api/v1/me.
 * `cache` của React: mỗi request chỉ hỏi API một lần dù nhiều component cùng gọi.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const { mock } = serverEnv();
  const cookieStore = await cookies();
  const preferred = cookieStore.get(ASSIGNMENT_COOKIE)?.value;

  if (mock) {
    const account = MOCK_ACCOUNTS.find((a) => a.username === cookieStore.get(MOCK_USER_COOKIE)?.value);
    if (!account) return null;
    const active = account.assignments.find((a) => a.id === preferred) ?? account.assignments[0];
    return {
      user: { id: account.username, username: account.username, displayName: account.displayName },
      assignments: account.assignments,
      activeAssignment: active,
      permissions: MOCK_ROLE_PERMISSIONS[active.role],
      isMock: true,
    };
  }

  try {
    return await apiFetch<Session>("/api/v1/me");
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
});

/** Bắt buộc đăng nhập; chưa có phiên thì chuyển sang trang đăng nhập và quay lại đúng trang. */
export async function requireSession(returnTo?: string): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const query = returnTo ? `?tiep=${encodeURIComponent(returnTo)}` : "";
    redirect(`/dang-nhap${query}` as "/dang-nhap");
  }
  return session;
}

export function can(session: Session, required?: Permission | readonly Permission[]): boolean {
  return hasAny(session.permissions, required);
}
