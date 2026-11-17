"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useConnectionStatus } from "@/lib/events/server-events";

/** Báo khi mất kết nối theo dõi tiến độ trực tiếp. Chờ vài giây mới hiện để không nhấp nháy khi chuyển trang. */
export function ConnectionBanner() {
  const status = useConnectionStatus();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (status !== "offline") {
      const reset = setTimeout(() => setVisible(false), 0);
      return () => clearTimeout(reset);
    }
    const show = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(show);
  }, [status]);

  return (
    <div role="status" aria-live="polite">
      {visible && (
        <p className="flex items-center gap-2 border-b border-warn bg-warn-soft px-4 py-1.5 text-[13px] font-semibold text-warn sm:px-6">
          <WifiOff aria-hidden className="size-4" /> Mất kết nối theo dõi tiến độ. Đang nối lại, số liệu trên màn hình có thể chưa mới.
        </p>
      )}
    </div>
  );
}
