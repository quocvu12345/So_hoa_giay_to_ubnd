import Link from "next/link";
import { Printer } from "lucide-react";
import { Chip } from "@/components/ui/status-chip";
import { buttonClass } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { FILE_KIND } from "./labels";
import type { FileVersion } from "./document-data";

/** "1,5 MB", "820 KB": hiển thị dung lượng vừa đủ đọc. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Đường dẫn in (BE-113): GET thẳng vào API, mở ở thẻ mới. Không dùng fetch + blob vì CSP của trang (object-src 'none', khung blob: không được phép)
 * không cho trình xem PDF hiện bản blob; phân công đi theo cookie hoso_assignment (BE-118). Mỗi lần mở ghi đúng một dòng nhật ký "in".
 */
export function printHref(fileId: string): string {
  return `/api/v1/files/${fileId}/download?purpose=print`;
}

/** Nút "In": liên kết thường (không cần JavaScript), mở bản PDF ở thẻ mới để in bằng trình duyệt. */
export function PrintLink({ fileId }: { fileId: string }) {
  return (
    <a href={printHref(fileId)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")} title="Mở tệp ở thẻ mới để in. Việc in được ghi vào nhật ký truy cập.">
      <Printer aria-hidden className="size-4" /> In
    </a>
  );
}

type Props = { documentId: string; files: FileVersion[]; viewingId: string | null; canPrint: boolean };

/**
 * Các phiên bản tệp của giấy tờ (FE-33, BE-113): bản gốc, bản thay thế, bản dẫn xuất, bản ký số; cũ nhất trước theo từng thành phần.
 * Bấm "Xem" để mở bản đó ở khung bên trái (?tep=). Bản đã hủy theo đề nghị được duyệt chỉ còn dòng thông tin, không xem, không in được.
 */
export function FileVersions({ documentId, files, viewingId, canPrint }: Props) {
  if (files.length === 0) return <p className="text-sm text-muted">Giấy tờ này chưa có tệp.</p>;
  return (
    <ul className="grid gap-2">
      {files.map((f) => (
        <li key={f.id} className={cn("grid gap-1 border border-line p-2.5 text-sm", f.id === viewingId && "border-primary bg-accent-soft/40")}>
          <span className="flex flex-wrap items-center gap-2">
            <b className="break-all">{f.name}</b>
            <Chip tone="neutral">{FILE_KIND[f.kind] ?? f.kind}</Chip>
            <span className="text-xs text-muted">{f.componentKey === "main" ? "" : `${f.componentKey} · `}phiên bản {f.versionNo}</span>
            {f.isCurrent && <Chip tone="ok">Hiện hành</Chip>}
            {f.disposed && <Chip tone="bad">Đã hủy nội dung</Chip>}
          </span>
          <span className="text-xs text-muted">
            {f.pageCount ?? "?"} trang · {formatBytes(f.byteSize)}
            {f.uploadedAt && <> · {formatDateTime(f.uploadedAt)}</>}
            {f.uploadedByName && <> · {f.uploadedByName}</>}
          </span>
          {f.replacementReason && (
            <span className="text-xs text-muted">
              Thay bản quét{f.replacesFileId ? ` (thay ${files.find((o) => o.id === f.replacesFileId)?.name ?? "bản trước"}, phiên bản ${files.find((o) => o.id === f.replacesFileId)?.versionNo ?? "trước"})` : ""}: {f.replacementReason}
            </span>
          )}
          <span className="font-mono text-[11px] break-all text-muted">SHA-256 {f.sha256}</span>
          {!f.disposed && (
            <span className="flex flex-wrap items-center gap-2">
              {f.id === viewingId ? (
                <span className="text-xs font-semibold text-primary">Đang xem</span>
              ) : (
                <Link href={`${routes.document(documentId)}?tep=${f.id}` as never} className={buttonClass("secondary", "sm")}>Xem</Link>
              )}
              {canPrint && <PrintLink fileId={f.id} />}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
