import type { ReactNode } from "react";
import { Hammer, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Vùng nội dung có tiêu đề. Chỉ dùng khung viền khi cần tách hẳn một khối. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-3 border border-line bg-surface p-4", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="grid gap-0.5">
            {title && <h2 className="text-base font-bold">{title}</h2>}
            {description && <p className="text-[13px] text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Trạng thái rỗng: nói rõ sẽ có gì ở đây và cách tạo mục đầu tiên. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-2 border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
      {Icon && <Icon aria-hidden className="size-8 text-muted" />}
      <h2 className="text-base font-bold">{title}</h2>
      {children && <div className="max-w-[60ch] text-sm text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * Ghi chú cho đội phát triển: màn hình này mới là khung, sẽ làm ở task nào và gồm những gì.
 * Xóa khi task hoàn thành.
 */
export function PlannedScreen({ task, items }: { task: string; items: string[] }) {
  return (
    <aside className="grid gap-2 border border-dashed border-primary/40 bg-accent-soft/40 p-4 text-sm" aria-label="Ghi chú phát triển">
      <p className="flex items-center gap-2 font-semibold text-primary">
        <Hammer aria-hidden className="size-4" /> Khung màn hình · làm ở task {task}
      </p>
      <ul className="list-disc space-y-0.5 pl-5 text-ink">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}

/** Lưới nội dung chính của một trang; gutter 16px trên điện thoại, 24px trên màn rộng. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 px-4 py-5 sm:px-6", className)}>{children}</div>;
}
