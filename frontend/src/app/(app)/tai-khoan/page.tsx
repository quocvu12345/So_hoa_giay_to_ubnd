import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";
import { scopeLabel } from "@/lib/auth/types";

export const metadata: Metadata = { title: "Tài khoản" };

export default async function AccountPage() {
  const { session } = await pageSession();
  return (
    <ScaffoldPage
      title="Tài khoản"
      description="Thông tin tài khoản, các phân công đang có hiệu lực và ủy quyền nhận được."
      breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Tài khoản" }]}
      icon={UserRound}
      task="FE-42 (API: BE-30)"
      plan={["Đổi mật khẩu và xác thực hai lớp thực hiện ở trang tài khoản của hệ thống đăng nhập cơ quan", "Lịch sử đăng nhập gần đây"]}
    >
      <section className="grid gap-3 border border-line bg-surface p-4">
        <h2 className="text-base font-bold">{session.user.displayName}</h2>
        <p className="text-sm text-muted">Tài khoản: {session.user.username}</p>
        <h3 className="text-sm font-bold">Phân công đang có hiệu lực</h3>
        <ul className="grid gap-1 text-sm">
          {session.assignments.map((a) => (
            <li key={a.id}>
              {scopeLabel(a)}
              {a.id === session.activeAssignment.id && <strong className="ml-2 text-primary">· đang dùng</strong>}
            </li>
          ))}
        </ul>
      </section>
    </ScaffoldPage>
  );
}
