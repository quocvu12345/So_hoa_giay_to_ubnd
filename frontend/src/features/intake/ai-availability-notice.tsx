import { AlertTriangle } from "lucide-react";
import { aiAvailabilityNotice, type AiAvailability } from "./ai-availability";

/** Băng báo ở hộp tiếp nhận khi máy AI không đọc được (AI-24). Không hiện gì khi bình thường. */
export function AiAvailabilityNotice({ availability }: { availability: AiAvailability | null | undefined }) {
  const notice = aiAvailabilityNotice(availability);
  if (!notice) return null;
  return (
    <div role="status" className="flex items-start gap-2 border border-warn bg-warn-soft p-3 text-sm text-warn">
      <AlertTriangle aria-hidden className="mt-0.5 size-4 flex-none" />
      <p>
        <b>{notice.title}.</b> {notice.body}
      </p>
    </div>
  );
}
