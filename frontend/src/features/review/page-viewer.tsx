"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { browserHeaders } from "@/lib/api/client";
import { useAssignmentId } from "@/lib/auth/client-session";
import { isValidRegion, regionStyle, type SourceRegion } from "./source-region";

const WIDTHS = { fit: 900, large: 1500 } as const;

type Zoom = keyof typeof WIDTHS;
type Image = { url?: string; failed?: boolean };

/**
 * Ảnh trang WebP của API (BE-43, `/files/{id}/pages/{n}/preview`) lấy bằng fetch có header phân công rồi hiện qua blob URL,
 * vì thẻ <img> không gửi được X-Assignment-Id (người kiêm nhiệm nhiều phân công sẽ bị tính sai phạm vi).
 * Tải trước trang kế để lật trang không phải chờ; blob được thu hồi khi rời màn.
 */
function usePageImages(fileId: string) {
  const assignmentId = useAssignmentId();
  const [images, setImages] = useState<Record<string, Image>>({});
  const requested = useRef(new Set<string>());
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const created = urls.current;
    return () => {
      for (const url of created) URL.revokeObjectURL(url);
      created.clear();
    };
  }, []);

  const request = useCallback(
    (page: number, zoom: Zoom, retry = false) => {
      const key = `${fileId}:${page}:${WIDTHS[zoom]}`;
      if (!retry && requested.current.has(key)) return key;
      requested.current.add(key);
      void fetch(`/api/v1/files/${fileId}/pages/${page}/preview?w=${WIDTHS[zoom]}`, { headers: browserHeaders(assignmentId), credentials: "same-origin" })
        .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          urls.current.add(url);
          setImages((current) => ({ ...current, [key]: { url } }));
        })
        .catch(() => setImages((current) => ({ ...current, [key]: { failed: true } })));
      return key;
    },
    [fileId, assignmentId],
  );

  return { images, request };
}

export type Highlight = { region: SourceRegion; label: string };

/**
 * Xem bản gốc bằng ảnh trang. Trang hiện tại do màn cha giữ để bấm trường thì nhảy đúng trang.
 * `highlight` (FE-22, BE-114): làm nổi vùng chứa giá trị của một trường bằng khung đặt theo phần trăm của ảnh, nên khớp ở cả hai mức phóng;
 * vùng ở trang khác thì không hiện, và khung tự cuộn vào giữa khung nhìn khi ảnh đã tải.
 */
export function PageViewer({ fileId, pageCount, page, onPageChange, highlight }: { fileId: string; pageCount: number; page: number; onPageChange: (page: number) => void; highlight?: Highlight | null }) {
  const [zoom, setZoom] = useState<Zoom>("fit");
  const { images, request } = usePageImages(fileId);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const region = highlight && isValidRegion(highlight.region) && highlight.region.page === page ? highlight.region : null;

  // Cuộn trong chính khung xem (không cuộn cả trang) để đưa vùng nguồn vào giữa. Chạy lại khi ảnh vừa tải xong hoặc đổi mức phóng.
  const reveal = useCallback(() => {
    const container = scroller.current;
    const target = box.current;
    if (!container || !target) return;
    const top = target.offsetTop - container.clientHeight / 2 + target.offsetHeight / 2;
    const left = target.offsetLeft - container.clientWidth / 2 + target.offsetWidth / 2;
    container.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: "smooth" });
  }, []);

  useEffect(() => {
    request(page, zoom);
    if (page < pageCount) request(page + 1, zoom);
  }, [request, page, pageCount, zoom]);

  const key = `${fileId}:${page}:${WIDTHS[zoom]}`;
  const image = images[key];
  useEffect(() => {
    if (region && image?.url) requestAnimationFrame(reveal);
  }, [region, image?.url, reveal, zoom]);
  const go = (next: number) => onPageChange(Math.min(Math.max(1, next), pageCount));

  return (
    <div
      className="grid min-w-0 gap-2"
      onKeyDown={(event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
        if (event.key === "PageDown" || event.key === "ArrowRight") go(page + 1);
        if (event.key === "PageUp" || event.key === "ArrowLeft") go(page - 1);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Trang trước">
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <label className="flex items-center gap-1 px-1">
            <span className="sr-only">Số trang</span>
            <input
              type="number"
              min={1}
              max={pageCount}
              value={page}
              onChange={(e) => e.target.value !== "" && go(Number(e.target.value))}
              className="h-8 w-14 border border-line-strong bg-surface px-1 text-center tabular-nums"
            />
            <span className="text-muted">/ {pageCount}</span>
          </label>
          <Button size="sm" onClick={() => go(page + 1)} disabled={page >= pageCount} aria-label="Trang sau">
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setZoom(zoom === "fit" ? "large" : "fit")} aria-pressed={zoom === "large"}>
          {zoom === "fit" ? <Maximize2 aria-hidden className="size-4" /> : <Minimize2 aria-hidden className="size-4" />}
          {zoom === "fit" ? "Phóng to" : "Vừa khung"}
        </Button>
      </div>

      <div ref={scroller} tabIndex={0} aria-label={`Bản gốc, trang ${page} trên ${pageCount}. Dùng mũi tên trái phải để đổi trang`} className="relative max-h-[calc(100dvh-14rem)] min-h-64 overflow-auto border border-line bg-surface">
        {image?.failed ? (
          <div className="grid place-items-center gap-2 p-6 text-center text-sm">
            <p className="text-bad">Chưa dựng được ảnh trang {page}. Thử lại sau ít giây.</p>
            <Button size="sm" onClick={() => request(page, zoom, true)}>Thử lại</Button>
          </div>
        ) : image?.url ? (
          <div className={zoom === "fit" ? "relative w-full" : "relative w-[1500px] max-w-none"}>
            {/* eslint-disable-next-line @next/next/no-img-element -- blob URL từ API có phiên đăng nhập, không qua trình tối ưu ảnh của Next */}
            <img src={image.url} alt={`Trang ${page} của bản gốc`} className="block h-auto w-full" />
            {region && highlight && (
              <div
                ref={box}
                role="img"
                aria-label={`Vùng chứa giá trị của trường ${highlight.label}${region.approximate ? " (vị trí ước theo dòng)" : ""}`}
                style={regionStyle(region)}
                className={`pointer-events-none absolute border-2 ${region.approximate ? "border-dashed border-warn bg-warn/15" : "border-solid border-warn bg-warn/25"} shadow-[0_0_0_2px_rgba(255,255,255,0.7)]`}
              />
            )}
          </div>
        ) : (
          <p className="p-6 text-center text-xs text-muted" role="status">Đang tải trang {page}…</p>
        )}
      </div>
      {region && highlight && (
        <p role="status" className="text-xs text-muted">
          Khung vàng: vùng chứa giá trị của “{highlight.label}”{region.approximate ? ". Vị trí chỉ ước theo dòng chữ, kiểm tra lại trên bản gốc." : "."}
        </p>
      )}
    </div>
  );
}
