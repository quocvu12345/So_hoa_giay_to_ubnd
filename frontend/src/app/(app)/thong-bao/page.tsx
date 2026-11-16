import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";
import { MOCK_NOTIFICATIONS } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Thông báo" };

export default async function NotificationsPage() {
  await pageSession();
  return (
    <ScaffoldPage
      title="Thông báo"
      description="Việc được giao, hồ sơ bị trả lại, chờ ý kiến, sắp đến hạn và PDF đã đọc xong."
      breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Thông báo" }]}
      icon={Bell}
      task="FE-40 (API: BE-70)"
      plan={["Thông báo mới đến trực tiếp qua SSE, chuông cập nhật số", "Đánh dấu tất cả đã đọc"]}
    >
      <ul className="grid border border-line bg-surface">
        {MOCK_NOTIFICATIONS.map((n) => (
          <li key={n.id} className={`grid gap-0.5 border-t border-line px-4 py-3 first:border-t-0 ${n.read ? "" : "bg-accent-soft/50"}`}>
            <span className="text-sm font-semibold">{n.read ? "" : "● "}{n.title}</span>
            <span className="text-sm text-muted">{n.body}</span>
            <span className="text-xs text-muted">{n.at}</span>
          </li>
        ))}
      </ul>
    </ScaffoldPage>
  );
}
