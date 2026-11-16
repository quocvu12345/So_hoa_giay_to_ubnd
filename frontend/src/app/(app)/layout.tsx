import { headers } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { routes } from "@/config/routes";
import { requireSession } from "@/lib/auth/session";
import { MOCK_INBOX, MOCK_NOTIFICATIONS } from "@/lib/mock/data";

/** Mọi màn sau đăng nhập dùng chung khung này. Phiên không hợp lệ thì về trang đăng nhập. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const returnTo = (await headers()).get("x-pathname") ?? undefined;
  const session = await requireSession(returnTo);

  // TODO(FE-20, BE-69): lấy số đếm từ GET /api/v1/workspace/summary thay cho dữ liệu mẫu.
  const badges = {
    [routes.intake]: MOCK_INBOX.filter((i) => i.stage === "ready").length,
    [routes.home]: 3,
  };
  const unread = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <AppShell session={session} badges={badges} unread={unread}>
      {children}
    </AppShell>
  );
}
