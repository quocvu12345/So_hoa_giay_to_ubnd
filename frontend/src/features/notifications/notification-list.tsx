"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { loadMoreNotifications, markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { useServerAction } from "@/lib/use-server-action";
import { cn } from "@/lib/cn";
import type { NotificationItem } from "./notification-data";
import { kindLabel, mergePages, notificationHref } from "./notification-links";

type Props = { initial: NotificationItem[]; initialCursor: string | null; unread: number; unreadOnly: boolean };

/**
 * Danh sách thông báo (FE-40). Bấm một thông báo thì đánh dấu đã đọc rồi mở đúng nơi (hồ sơ, đợt nộp lưu…). "Đánh dấu tất cả đã đọc",
 * "Tải thêm" theo con trỏ. Trang tự làm mới khi có thông báo mới (RefreshOnEvents ở trang), nên danh sách đầu luôn từ máy chủ;
 * phần "tải thêm" giữ ở đây và đặt lại khi danh sách đầu đổi (key ở trang).
 */
export function NotificationList({ initial, initialCursor, unread, unreadOnly }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [more, setMore] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const markOne = useServerAction(markNotificationRead, { toastErrors: false });
  const markAll = useServerAction(markAllNotificationsRead);
  const loadMore = useServerAction(loadMoreNotifications);
  const items = mergePages(initial, more);

  function open(item: NotificationItem) {
    if (item.read || readIds.has(item.id)) return;
    setReadIds((current) => new Set(current).add(item.id));
    // Không chờ kết quả: mở trang đích ngay; đánh dấu lỗi thì lần sau thông báo vẫn còn đó, không mất gì.
    void markOne.run(item.id).then(() => router.refresh());
  }

  async function readAll() {
    const result = await markAll.run();
    if (result.ok) {
      setReadIds(new Set(items.map((i) => i.id)));
      toast.success(result.data.updated > 0 ? `Đã đánh dấu ${result.data.updated} thông báo là đã đọc.` : "Không có thông báo chưa đọc.");
      router.refresh();
    }
  }

  async function loadOlder() {
    if (!cursor) return;
    const result = await loadMore.run(cursor, unreadOnly);
    if (result.ok) {
      setMore((current) => mergePages(current, result.data.items));
      setCursor(result.data.nextCursor ?? null);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Lọc thông báo" className="flex gap-2 text-sm">
          <Link href="/thong-bao" aria-current={!unreadOnly ? "page" : undefined} className={cn("border px-3 py-1.5", !unreadOnly ? "border-primary bg-primary text-white" : "border-line-strong hover:border-primary")}>
            Tất cả
          </Link>
          <Link href={"/thong-bao?chua-doc=1" as "/thong-bao"} aria-current={unreadOnly ? "page" : undefined} className={cn("border px-3 py-1.5", unreadOnly ? "border-primary bg-primary text-white" : "border-line-strong hover:border-primary")}>
            Chưa đọc{unread > 0 ? ` (${unread})` : ""}
          </Link>
        </nav>
        <Button onClick={readAll} disabled={markAll.pending || unread === 0} aria-label="Đánh dấu tất cả thông báo là đã đọc">
          <CheckCheck aria-hidden className="size-4" /> Đánh dấu tất cả đã đọc
        </Button>
      </div>

      <ul className="grid border border-line bg-surface" aria-label="Danh sách thông báo">
        {items.map((n) => {
          const read = n.read || readIds.has(n.id);
          const href = notificationHref(n);
          const content = (
            <>
              <span className="flex flex-wrap items-center gap-2">
                {!read && <span aria-hidden className="size-2 rounded-full bg-primary" />}
                <span className={cn("text-sm", read ? "font-medium" : "font-bold")}>{n.title}</span>
                {!read && <span className="sr-only">(chưa đọc)</span>}
                <Chip tone="neutral">{kindLabel(n.kind)}</Chip>
              </span>
              {n.body && <span className="text-sm text-muted">{n.body}</span>}
              <span className="text-xs text-muted">{formatDateTime(n.createdAt)}</span>
            </>
          );
          const row = cn("grid gap-0.5 px-4 py-3", !read && "bg-accent-soft/50");
          return (
            <li key={n.id} className="border-t border-line first:border-t-0">
              {href ? (
                <Link href={href as "/"} data-row onClick={() => open(n)} className={cn(row, "hover:bg-soft focus-visible:outline-2 focus-visible:-outline-offset-2")}>
                  {content}
                </Link>
              ) : (
                <button type="button" data-row onClick={() => open(n)} className={cn(row, "w-full text-left hover:bg-soft")}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {cursor && (
        <div className="flex justify-center">
          <Button onClick={loadOlder} disabled={loadMore.pending}>{loadMore.pending ? "Đang tải…" : "Tải thêm"}</Button>
        </div>
      )}
    </div>
  );
}
