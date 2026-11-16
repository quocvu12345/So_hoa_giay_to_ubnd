import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { mockSignIn } from "@/app/actions/session";
import { getSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { MOCK_ACCOUNTS } from "@/lib/mock/accounts";

export const metadata: Metadata = { title: "Đăng nhập" };

function safeReturnTo(value: string | string[] | undefined) {
  const text = typeof value === "string" ? value : "";
  return text.startsWith("/") && !text.startsWith("//") && !text.startsWith("/\\") ? text : "/viec-cua-toi";
}

/**
 * Đăng nhập bằng tài khoản cơ quan (OIDC qua API .NET → Keycloak/SSO).
 * Không có ô chọn vai trò: vai trò lấy từ phân công của tài khoản.
 * Khi HOSO_MOCK=1, hiện danh sách tài khoản giả lập để thử từng vai trò.
 */
export default async function LoginPage({ searchParams }: PageProps<"/dang-nhap">) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.tiep);
  if (await getSession()) redirect(returnTo as "/viec-cua-toi");
  const { mock } = serverEnv();

  return (
    <main className="grid min-h-dvh place-items-center bg-page px-4 py-10">
      <div className="grid w-full max-w-md gap-5 border border-line bg-surface p-6">
        <div className="grid gap-1">
          <p className="text-[11px] font-bold tracking-[0.08em] text-primary uppercase">UBND · HĐND phường Từ Liêm</p>
          <h1 className="text-2xl font-bold">Hồ sơ số</h1>
          <p className="text-sm text-muted">Đăng nhập bằng tài khoản được cơ quan cấp. Màn hình và quyền thao tác theo phân công của bạn.</p>
        </div>

        {!mock && (
          <a
            href={`/api/v1/auth/login?returnUrl=${encodeURIComponent(returnTo)}`}
            className="inline-flex h-11 items-center justify-center gap-2 border border-primary bg-primary px-4 font-semibold text-white hover:bg-primary-hover"
          >
            <KeyRound aria-hidden className="size-4" /> Đăng nhập bằng tài khoản cơ quan
          </a>
        )}

        {mock && (
          <div className="grid gap-2">
            <p className="border border-dashed border-warn bg-warn-soft px-3 py-2 text-xs text-warn">
              Chế độ giả lập (HOSO_MOCK=1). Chọn một tài khoản mẫu để thử. Không có ở môi trường thật.
            </p>
            {MOCK_ACCOUNTS.map((account) => (
              <form key={account.username} action={mockSignIn}>
                <input type="hidden" name="username" value={account.username} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button type="submit" className="grid w-full gap-0.5 border border-line px-3 py-2 text-left hover:border-primary hover:bg-soft">
                  <span className="text-sm font-semibold">{account.displayName}</span>
                  <span className="text-xs text-muted">{account.hint}</span>
                </button>
              </form>
            ))}
          </div>
        )}

        <p className="text-xs text-muted">
          Quên mật khẩu hoặc chưa có tài khoản: liên hệ quản trị hệ thống của phường. Mọi lần đăng nhập đều được ghi nhật ký.
        </p>
      </div>
    </main>
  );
}
