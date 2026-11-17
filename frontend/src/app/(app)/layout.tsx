import { headers } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { ApiError, ok, serverApi } from "@/lib/api/server";
import { AssignmentProvider } from "@/lib/auth/client-session";
import { requireSession } from "@/lib/auth/session";
import { ServerEventsProvider } from "@/lib/events/server-events";
import { log } from "@/lib/log";
import { MOCK_INBOX, MOCK_NOTIFICATIONS } from "@/lib/mock/data";

/** Số đếm trên menu và chuông. Chạy thật: lấy từ API (BE-69); số liệu lỗi không được làm hỏng cả trang nên rơi về 0. */
async function loadCounts(isMock: boolean): Promise<{ badges: Record<string, number>; unread: number }> {
  if (isMock) {
    return {
      badges: { [routes.intake]: MOCK_INBOX.filter((i) => i.stage === "ready").length, [routes.home]: 3 },
      unread: MOCK_NOTIFICATIONS.filter((n) => !n.read).length,
    };
  }
  try {
    const summary = ok(await serverApi().GET("/api/v1/workspace/summary"));
    const queued = Object.values(summary.counts).reduce((sum, n) => sum + n, 0);
    return { badges: { [routes.intake]: summary.inbox, [routes.home]: queued }, unread: summary.unreadNotifications };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    log.warn("workspace_summary_unavailable", { status: error.status, code: error.code });
    return { badges: {}, unread: 0 };
  }
}

/** Mọi màn sau đăng nhập dùng chung khung này. Phiên không hợp lệ thì về trang đăng nhập. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const returnTo = (await headers()).get("x-pathname") ?? undefined;
  const session = await requireSession(returnTo);
  const { badges, unread } = await loadCounts(session.isMock);

  return (
    <AssignmentProvider assignmentId={session.isMock ? null : session.activeAssignment.id}>
      <ServerEventsProvider enabled={!session.isMock} assignmentId={session.activeAssignment.id}>
        <ToastProvider>
          <AppShell session={session} badges={badges} unread={unread}>
            {children}
          </AppShell>
        </ToastProvider>
      </ServerEventsProvider>
    </AssignmentProvider>
  );
}
