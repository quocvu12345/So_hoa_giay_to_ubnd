import Link from "next/link";
import { Lock } from "lucide-react";
import { scopeLabel, type Session } from "@/lib/auth/types";

/** Phân công đang dùng không có quyền mở màn này. Nói rõ đang dùng phân công nào và làm gì tiếp. */
export function NoAccess({ session, what }: { session: Session; what: string }) {
  const others = session.assignments.length > 1;
  return (
    <div className="mx-4 my-6 grid max-w-2xl gap-3 border border-line bg-surface p-5 sm:mx-6">
      <p className="flex items-center gap-2 text-lg font-bold">
        <Lock aria-hidden className="size-5 text-muted" /> Bạn chưa có quyền {what}
      </p>
      <p className="text-sm">
        Bạn đang làm với phân công <strong>{scopeLabel(session.activeAssignment)}</strong>.
        {others ? " Nếu việc này thuộc phân công khác của bạn, đổi phân công ở thanh trên cùng." : " Nếu cần quyền này, đề nghị quản trị bổ sung phân công."}
      </p>
      <Link href="/viec-cua-toi" className="inline-flex h-10 w-fit items-center border border-line-strong px-4 text-sm font-semibold hover:border-primary">
        Về Việc của tôi
      </Link>
    </div>
  );
}
