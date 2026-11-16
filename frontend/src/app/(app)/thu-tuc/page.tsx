import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/blocks";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Thủ tục hành chính" };

export default async function ProceduresPage({ searchParams }: PageProps<"/thu-tuc">) {
  await pageSession();
  const q = (await searchParams).q;
  const query = typeof q === "string" ? q : "";
  return (
    <ScaffoldPage
      title="Thủ tục hành chính"
      description="425 thủ tục theo danh mục Hà Nội và các thủ tục cấp xã trên Cổng DVC: thành phần hồ sơ, mẫu biểu, tình trạng hiệu lực."
      breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Thủ tục hành chính" }]}
      icon={BookOpen}
      emptyTitle="Tìm thủ tục theo tên hoặc mã"
      emptyText="Ví dụ: “khai sinh”, 1.000894. Thủ tục đã bãi bỏ hoặc thay thế có cảnh báo, không dùng mẫu cũ làm mẫu hiện hành."
      task="FE-35 (API: BE-33)"
      plan={["Lọc: lĩnh vực, cấp thực hiện, tình trạng hiệu lực", "Thay cho data/official-forms/index.html của bản thí điểm"]}
    >
      <form role="search" className="flex flex-wrap gap-2 border border-line bg-surface p-3">
        <label htmlFor="q" className="sr-only">Từ khóa</label>
        <input id="q" name="q" defaultValue={query} placeholder="Nhập từ khóa…" className="h-10 min-w-[240px] flex-1 border border-line-strong px-3 text-sm focus:border-primary" />
        <button type="submit" className="h-10 border border-primary bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover">Tìm</button>
      </form>
      <EmptyState icon={BookOpen} title={query ? `Kết quả cho “${query}” sẽ hiện ở đây` : "Tìm thủ tục theo tên hoặc mã"}>Ví dụ: “khai sinh”, 1.000894. Thủ tục đã bãi bỏ hoặc thay thế có cảnh báo, không dùng mẫu cũ làm mẫu hiện hành.</EmptyState>
    </ScaffoldPage>
  );
}
