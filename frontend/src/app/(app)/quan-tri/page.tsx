import { redirect } from "next/navigation";
import { NoAccess } from "@/components/ui/no-access";
import { NAVIGATION } from "@/config/navigation";
import { pageSession } from "@/lib/auth/page-guard";
import { hasAny } from "@/lib/auth/permissions";

/** /quan-tri mở mục quản trị đầu tiên mà phân công đang dùng được phép. */
export default async function AdminIndex() {
  const { session } = await pageSession();
  const admin = NAVIGATION.find((g) => g.label === "Quản trị");
  const first = admin?.items.find((i) => hasAny(session.permissions, i.permission));
  if (first) redirect(first.href);
  return <NoAccess session={session} what="vào mục quản trị" />;
}
