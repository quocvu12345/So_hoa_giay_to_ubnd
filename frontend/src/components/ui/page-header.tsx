import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: Route };

/**
 * Đầu trang thống nhất: breadcrumb → tiêu đề → mô tả một câu; thao tác ở bên phải,
 * nút chính luôn đứng cuối cùng bên phải ở mọi màn.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="grid gap-3 border-b border-line bg-surface px-4 py-5 sm:px-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-1 text-[13px] text-muted">
          {breadcrumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight aria-hidden className="size-3.5" />}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-primary hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-ink">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="max-w-[72ch] text-muted">{description}</p>}
          {meta && <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
