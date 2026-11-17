"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { clearAssignment } from "@/app/actions/session";
import { useToast } from "@/components/ui/toast";

/**
 * Báo các tình huống phiên cần người dùng biết:
 * - phân công đã chọn trước đó không còn hiệu lực: xóa cookie, báo đang dùng phân công nào;
 * - phân công đang dùng cần xác thực hai lớp (BE-95): API chưa cấp quyền nào cho tới khi đăng nhập lại có MFA.
 */
export function SessionNotices({ assignmentReset, mfaRequired, activeLabel }: { assignmentReset: boolean; mfaRequired: boolean; activeLabel: string }) {
  const toast = useToast();
  const pathname = usePathname();
  const done = useRef(false);

  useEffect(() => {
    if (!assignmentReset || done.current) return;
    done.current = true;
    void clearAssignment().then(() => toast.info(`Phân công bạn chọn trước đó không còn hiệu lực. Đang dùng: ${activeLabel}.`));
  }, [assignmentReset, activeLabel, toast]);

  if (!mfaRequired) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-warn bg-warn-soft px-4 py-2 text-[13px] text-warn sm:px-6">
      <ShieldAlert aria-hidden className="size-4 flex-none" />
      <span>
        Phân công <b>{activeLabel}</b> cần xác thực hai lớp. Trước khi xác thực, bạn chưa dùng được chức năng nào của phân công này.
      </span>
      <a href={`/api/v1/auth/login?mfa=true&returnUrl=${encodeURIComponent(pathname)}`} className="font-semibold text-primary underline">
        Đăng nhập lại có xác thực hai lớp
      </a>
      <span>hoặc chọn phân công khác ở góc trên.</span>
    </div>
  );
}
