import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { EmptyState, PageBody, PlannedScreen } from "./blocks";
import { PageHeader, type Crumb } from "./page-header";

/**
 * Khung một màn chưa làm: đầu trang đúng chuẩn + trạng thái rỗng mô tả màn sẽ có gì
 * + ghi chú task. Khi làm task, thay phần `children`/EmptyState bằng nội dung thật.
 */
export function ScaffoldPage({
  title,
  description,
  breadcrumbs,
  actions,
  icon,
  emptyTitle,
  emptyText,
  task,
  plan,
  children,
}: {
  title: string;
  description: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  icon?: LucideIcon;
  emptyTitle?: string;
  emptyText?: string;
  task: string;
  plan: string[];
  children?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} actions={actions} />
      <PageBody>
        {children ?? <EmptyState icon={icon} title={emptyTitle ?? title}>{emptyText}</EmptyState>}
        <PlannedScreen task={task} items={plan} />
      </PageBody>
    </>
  );
}
