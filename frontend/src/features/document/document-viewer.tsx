"use client";

import { useState } from "react";
import { PageViewer } from "@/features/review/page-viewer";

/** Trình xem bản gốc của chi tiết giấy tờ; `initialPage` lấy từ ?trang= để mở đúng trang trúng khi đi từ Tra cứu. */
export function DocumentViewer({ fileId, pageCount, initialPage }: { fileId: string; pageCount: number; initialPage: number }) {
  const [page, setPage] = useState(Math.min(Math.max(1, initialPage), Math.max(1, pageCount)));
  return <PageViewer fileId={fileId} pageCount={pageCount} page={page} onPageChange={setPage} />;
}
