"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { routes } from "@/config/routes";
import { bellLabel } from "@/features/notifications/notification-links";
import { useServerEvent } from "@/lib/events/server-events";

/**
 * Chuông trên thanh trên (FE-04, FE-40). Số gốc từ máy chủ (khung chung); thông báo mới đến qua SSE cộng thêm ngay không cần tải lại.
 * Khi máy chủ gửi lại số mới (sau khi làm mới trang) thì phần cộng thêm được đặt lại về 0 nhờ `key`.
 */
export function NotificationBell({ unread }: { unread: number }) {
  return <BellInner key={unread} unread={unread} />;
}

function BellInner({ unread }: { unread: number }) {
  const [extra, setExtra] = useState(0);
  useServerEvent("notification.created", () => setExtra((n) => n + 1));
  const total = unread + extra;
  const label = bellLabel(total);
  return (
    <Link href={routes.notifications} className="relative grid size-10 place-items-center border border-line hover:border-primary" aria-label={`Thông báo, ${total} chưa đọc`}>
      <Bell aria-hidden className="size-5" />
      {label && <span className="absolute -top-1 -right-1 min-w-5 bg-bad px-1 text-center text-[11px] font-bold text-white">{label}</span>}
    </Link>
  );
}
