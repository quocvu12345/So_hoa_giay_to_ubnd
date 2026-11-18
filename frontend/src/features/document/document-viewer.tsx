"use client";

import { useState } from "react";
import { PageViewer, type Highlight } from "@/features/review/page-viewer";

/**
 * Trình xem bản gốc của chi tiết giấy tờ. `initialPage` lấy từ ?trang= để mở đúng trang trúng khi đi từ Tra cứu hoặc từ một trường;
 * `highlight` từ ?vung= (vùng nguồn của trường, BE-114) làm nổi đúng chỗ giá trị nằm.
 */
export function DocumentViewer({ fileId, pageCount, initialPage, highlight }: { fileId: string; pageCount: number; initialPage: number; highlight?: Highlight | null }) {
  const [page, setPage] = useState(Math.min(Math.max(1, initialPage), Math.max(1, pageCount)));
  return <PageViewer fileId={fileId} pageCount={pageCount} page={page} onPageChange={setPage} highlight={highlight ?? null} />;
}
