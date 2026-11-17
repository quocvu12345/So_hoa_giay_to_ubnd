import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api/server";
import { requestState } from "@/lib/api/request-state";
import { log } from "@/lib/log";
import { ASSIGNMENT_COOKIE, MOCK_USER_COOKIE, serverEnv } from "@/lib/env";
import { MOCK_ACCOUNTS, MOCK_ROLE_PERMISSIONS } from "@/lib/mock/accounts";
import { hasAny, type Permission } from "./permissions";
import type { Session } from "./types";

/** Vì sao không có phiên: chưa đăng nhập, hoặc đã đăng nhập nhưng tài khoản chưa có phân công nào còn hiệu lực. */
export type SessionProblem = "no_assignment" | null;

/**
 * Lớp truy cập phiên (Data Access Layer). Mọi trang và Server Action lấy người dùng qua đây.
 * Phiên thật do API .NET giữ (cookie httpOnly); Next chỉ hỏi lại /api/v1/me.
 * `cache` của React: mỗi request chỉ hỏi API một lần dù nhiều component cùng gọi.
 */
export const getSessionState = cache(async (): Promise<{ session: Session | null; problem: SessionProblem }> => {
  const { mock } = serverEnv();
  const cookieStore = await cookies();
  const preferred = cookieStore.get(ASSIGNMENT_COOKIE)?.value;

  if (mock) {
    const account = MOCK_ACCOUNTS.find((a) => a.username === cookieStore.get(MOCK_USER_COOKIE)?.value);
    if (!account) return { session: null, problem: null };
    const active = account.assignments.find((a) => a.id === preferred) ?? account.assignments[0];
    return {
      session: {
        user: { id: account.username, username: account.username, displayName: account.displayName },
        assignments: account.assignments,
        activeAssignment: active,
        permissions: MOCK_ROLE_PERMISSIONS[active.role],
        isMock: true,
      },
      problem: null,
    };
  }

  try {
    return { session: await apiFetch<Session>("/api/v1/me"), problem: null };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 401) return { session: null, problem: null };
    // Cookie phân công cũ (hết hạn, bị thu hồi, của người dùng trước trên cùng máy): bỏ header và dùng phân công mặc định,
    // nếu không người dùng bị đẩy về trang đăng nhập mãi dù phiên vẫn còn (đăng nhập lại cũng không xóa cookie này).
    if (error.code === "assignment_not_allowed" && !requestState().dropAssignment) {
      requestState().dropAssignment = true;
      log.warn("assignment_cookie_stale");
      try {
        const session = await apiFetch<Session>("/api/v1/me");
        return { session: { ...session, assignmentReset: true }, problem: null };
      } catch (retry) {
        if (retry instanceof ApiError && retry.code === "no_assignment") return { session: null, problem: "no_assignment" };
        if (retry instanceof ApiError && (retry.status === 401 || retry.status === 403)) return { session: null, problem: null };
        throw retry;
      }
    }
    if (error.code === "no_assignment") return { session: null, problem: "no_assignment" };
    if (error.status === 403) return { session: null, problem: null };
    throw error;
  }
});

export async function getSession(): Promise<Session | null> {
  return (await getSessionState()).session;
}

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
