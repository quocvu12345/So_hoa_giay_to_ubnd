import type { Metadata } from "next";
import { PageBody, Section } from "@/components/ui/blocks";
import { PageHeader } from "@/components/ui/page-header";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { getMyLogins } from "@/features/admin/admin-data";
import { expiryChip } from "@/features/admin/user-rules";
import { ApiError } from "@/lib/api/server";
import { pageSession } from "@/lib/auth/page-guard";
import { scopeLabel } from "@/lib/auth/types";
import { serverEnv } from "@/lib/env";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Tài khoản" };

/** Lịch sử đăng nhập là thông tin phụ: lỗi tải không làm hỏng cả trang tài khoản. */
async function loadLogins() {
  if (serverEnv().mock) return null;
  try {
    return await getMyLogins(15);
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
}

/**
 * Tài khoản (FE-42, BE-30, BE-123): thông tin người dùng, các phân công đang có hiệu lực (kể cả ủy quyền, kèm hạn) và các lần đăng nhập gần đây
 * để tự phát hiện đăng nhập lạ. Đổi mật khẩu và xác thực hai lớp làm ở hệ thống đăng nhập của cơ quan, không ở đây.
 */
export default async function AccountPage() {
  const { session } = await pageSession();
  const logins = await loadLogins();
  const now = new Date();

  return (
    <>
      <PageHeader title="Tài khoản" description="Thông tin tài khoản, các phân công đang có hiệu lực, ủy quyền nhận được và các lần đăng nhập gần đây." breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Tài khoản" }]} />
      <PageBody>
        <Section title={session.user.displayName}>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted">Tên đăng nhập</dt><dd className="font-mono">{session.user.username}</dd></div>
            <div><dt className="text-xs text-muted">Mật khẩu và xác thực hai lớp</dt><dd>Đổi ở trang tài khoản của hệ thống đăng nhập cơ quan.</dd></div>
          </dl>
        </Section>

        <Section title={`Phân công đang có hiệu lực (${session.assignments.length})`} description="Đổi phân công đang dùng ở thanh trên cùng. Mỗi phân công có quyền và phạm vi hồ sơ riêng.">
          <ul className="grid divide-y divide-line border border-line" aria-label="Phân công">
            {session.assignments.map((a) => {
              const chip = a.delegatedUntil ? expiryChip(a.delegatedUntil, now) : null;
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                  <b>{scopeLabel(a)}</b>
                  {a.id === session.activeAssignment.id && <Chip tone="info">Đang dùng</Chip>}
                  {a.delegatedUntil && <Chip>Ủy quyền đến {formatDateTime(a.delegatedUntil)}</Chip>}
                  {chip && <Chip tone={chip.tone}>{chip.text}</Chip>}
                </li>
              );
            })}
          </ul>
        </Section>

        {logins && (
          <Section title="Đăng nhập gần đây" description="Thấy lần đăng nhập mình không thực hiện thì báo quản trị để buộc đăng xuất và kiểm tra.">
            {logins.length === 0 ? <p className="text-sm text-muted">Chưa có lần đăng nhập nào được ghi.</p> : (
              <ul className="grid divide-y divide-line border border-line" aria-label="Đăng nhập gần đây">
                {logins.map((l, i) => (
                  <li key={`${l.at}-${i}`} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span>{formatDateTime(l.at)}</span>
                    <span className="font-mono text-xs text-muted">{l.clientIp ?? "Không rõ địa chỉ"}</span>
                    {i === 0 && <Chip tone="ok">Mới nhất</Chip>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </PageBody>
    </>
  );
}
