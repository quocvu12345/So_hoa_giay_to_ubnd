import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { RefreshOnEvents } from "@/components/layout/refresh-on-events";
import { EmptyState, NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { getNotifications } from "@/features/notifications/notification-data";
import { NotificationList } from "@/features/notifications/notification-list";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Thông báo" };

/**
 * Thông báo (FE-40): việc được giao, hồ sơ bị trả lại, chờ ý kiến, sắp đến hạn, nộp lưu, mượn trả, đề nghị hủy.
 * Thông báo mới đến qua SSE thì trang tự làm mới và chuông tăng số (`NotificationBell`).
 */
export default async function NotificationsPage({ searchParams }: PageProps<"/thong-bao">) {
  await pageSession();
  const unreadOnly = (await searchParams)["chua-doc"] === "1";
  const real = !serverEnv().mock;
  const page = real ? await getNotifications({ unread: unreadOnly }) : null;

  return (
    <>
      <PageHeader
        title="Thông báo"
        description="Việc được giao, hồ sơ bị trả lại, chờ ý kiến, sắp đến hạn, nộp lưu, mượn trả và đề nghị hủy."
        breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Thông báo" }]}
      />
      <PageBody>
        {!page ? (
          <NeedsRealApi what="Thông báo" />
        ) : page.items.length === 0 ? (
          <EmptyState icon={Bell} title={unreadOnly ? "Không có thông báo chưa đọc" : "Chưa có thông báo nào"}>
            {unreadOnly ? "Bạn đã đọc hết. Bỏ lọc để xem lại các thông báo cũ." : "Khi có hồ sơ giao cho bạn, bị trả lại hoặc sắp đến hạn, thông báo hiện ở đây."}
          </EmptyState>
        ) : (
          <NotificationList key={`${unreadOnly}-${page.items[0]?.id}-${page.unread}`} initial={page.items} initialCursor={page.nextCursor ?? null} unread={page.unread} unreadOnly={unreadOnly} />
        )}
        {real && <RefreshOnEvents events={["notification.created", "resync"]} />}
      </PageBody>
    </>
  );
}
