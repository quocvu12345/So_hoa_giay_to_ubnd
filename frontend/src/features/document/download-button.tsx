"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { browserHeaders } from "@/lib/api/client";
import { friendlyMessage, problemFrom } from "@/lib/api/problem";
import { useAssignmentId } from "@/lib/auth/client-session";

/**
 * Tải tệp gốc (ghi nhật ký truy cập ở API). Dùng fetch có header phân công rồi lưu từ blob, vì liên kết <a href> thẳng vào API
 * không gửi được X-Assignment-Id (xem lib/auth/client-session.tsx). Tệp lớn nằm tạm trong bộ nhớ trình duyệt cho tới khi lưu xong.
 */
export function DownloadButton({ fileId, fileName }: { fileId: string; fileName: string }) {
  const assignmentId = useAssignmentId();
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  async function download() {
    setState({ busy: true, error: null });
    try {
      const response = await fetch(`/api/v1/files/${fileId}/download`, { headers: browserHeaders(assignmentId), credentials: "same-origin" });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        setState({ busy: false, error: friendlyMessage(problemFrom(response.status, body)) });
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState({ busy: false, error: null });
    } catch {
      setState({ busy: false, error: "Mất kết nối khi tải tệp. Kiểm tra mạng rồi thử lại." });
    }
  }

  return (
    <span className="inline-grid justify-items-end gap-1">
      <Button size="sm" onClick={() => void download()} disabled={state.busy} aria-busy={state.busy}>
        <Download aria-hidden className="size-4" /> {state.busy ? "Đang tải…" : "Tải tệp gốc"}
      </Button>
      <span role="alert" className="max-w-64 text-right text-xs text-bad">{state.error}</span>
    </span>
  );
}
