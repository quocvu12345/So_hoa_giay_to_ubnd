import Link from "next/link";
import type { Route } from "next";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 border font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "border-primary bg-primary text-white hover:bg-primary-hover hover:border-primary-hover",
  secondary: "border-line-strong bg-surface text-ink hover:border-primary hover:text-primary",
  ghost: "border-transparent bg-transparent text-ink hover:bg-soft",
  danger: "border-bad bg-surface text-bad hover:bg-bad-soft",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  row,
}: {
  href: Route;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  /** Đánh dấu là liên kết chính của một dòng danh sách để đi bằng ↑ ↓ (FE-48, `RowNavigation`). */
  row?: boolean;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} data-row={row ? "" : undefined}>
      {children}
    </Link>
  );
}
