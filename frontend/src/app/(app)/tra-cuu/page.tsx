import type { Metadata } from "next";
import { FileSearch } from "lucide-react";
import { EmptyState } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Tra cứu văn bản" };

export default async function SearchPage({ searchParams }: PageProps<"/tra-cuu">) {
  const { session, allowed } = await pageSession("document.view");
  if (!allowed) return <NoAccess session={session} what="tra cứu văn bản" />;
  const q = (await searchParams).q;
  const query = typeof q === "string" ? q : "";
  return (
    <ScaffoldPage
      title="Tra cứu văn bản"
      description="Tìm theo số ký hiệu, trích yếu, mã hồ sơ hoặc nội dung đã đọc bằng OCR. Gõ không dấu vẫn tìm được."
      breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Tra cứu" }]}
      icon={FileSearch}
      emptyTitle="Nhập từ khóa để tìm"
      emptyText="Ví dụ: 26/KH-UBND, “kế hoạch công tác”, DEMO-2026-0002. Kết quả chỉ gồm văn bản trong phạm vi của bạn."
      task="FE-34 (API: BE-80)"
      plan={["Bộ lọc: thời gian, cơ quan ban hành, loại giấy tờ, nhóm hồ sơ", "Kết quả có đoạn trích tô đậm và số trang trúng; bấm mở đúng trang", "Từ khóa và bộ lọc nằm trên URL"]}
    >
      <form role="search" className="flex flex-wrap gap-2 border border-line bg-surface p-3">
        <label htmlFor="q" className="sr-only">Từ khóa</label>
        <input id="q" name="q" defaultValue={query} placeholder="Nhập từ khóa…" className="h-10 min-w-[240px] flex-1 border border-line-strong px-3 text-sm focus:border-primary" />
        <button type="submit" className="h-10 border border-primary bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover">Tìm</button>
      </form>
      <EmptyState icon={FileSearch} title={query ? `Kết quả cho “${query}” sẽ hiện ở đây` : "Nhập từ khóa để tìm"}>Ví dụ: 26/KH-UBND, “kế hoạch công tác”, DEMO-2026-0002. Kết quả chỉ gồm văn bản trong phạm vi của bạn.</EmptyState>
    </ScaffoldPage>
  );
}
