import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { ApiError, apiFetch } from "@/lib/api/server";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";
import { AiQueuePanel, type QueueByKind } from "@/features/ops/ai-queue-panel";

export const metadata: Metadata = { title: "Vận hành" };

const MOCK_BY_KIND: QueueByKind = { priority: 1, interactive: 0, background: 7, preempted24h: 3, oldestBackgroundSeconds: 1260, secondsPerPage: 7.4 };

/** Số liệu khay AI: bản thật gọi /admin/ai/status; lỗi gọi API thì hiện thông báo, không làm hỏng cả trang vận hành. */
async function loadByKind(): Promise<{ data: QueueByKind | null; error: string | null }> {
  if (serverEnv().mock) return { data: MOCK_BY_KIND, error: null };
  try {
    const status = await apiFetch<{ byKind: QueueByKind | null }>("/api/v1/admin/ai/status");
    return { data: status.byKind, error: null };
  } catch (error) {
    if (error instanceof ApiError) return { data: null, error: `Chưa đọc được hàng đợi AI (${error.errorId ?? error.code}).` };
    throw error;
  }
}

export default async function AdminOperationsPage() {
  const { session, allowed } = await pageSession(["processing.manage", "admin.settings"]);
  if (!allowed) return <NoAccess session={session} what="xem vận hành" />;
  const { data, error } = await loadByKind();
  return (
    <ScaffoldPage
      title="Vận hành"
      description="Hàng đợi AI, máy đọc PDF, phiên bản mô hình, lần sao lưu gần nhất và cài đặt hệ thống."
      breadcrumbs={[{ label: "Quản trị" }, { label: "Vận hành" }]}
      icon={Settings2}
      emptyTitle="Tình trạng hệ thống"
      emptyText="Độ dài hàng đợi, job lỗi, thời gian đọc trung bình mỗi trang, dung lượng kho tệp, kết quả sao lưu."
      task="FE-44 (API: BE-88, BE-89)"
      plan={["Đọc lại job lỗi, hủy job treo", "Liên kết công cụ thử nghiệm SAM 3 (chỉ quản trị kỹ thuật)"]}
    >
      {data ? <AiQueuePanel data={data} /> : error ? <p role="alert" className="border border-bad bg-bad-soft p-3 text-sm text-bad">{error}</p> : null}
    </ScaffoldPage>
  );
}
