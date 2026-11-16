/** Khung chờ giữ nguyên bố cục trang để màn hình không nhảy khi dữ liệu về. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-4">
      <span className="sr-only">Đang tải…</span>
      <div className="grid gap-3 border-b border-line bg-surface px-4 py-5 sm:px-6">
        <div className="h-3 w-40 animate-pulse bg-soft" />
        <div className="h-7 w-72 animate-pulse bg-soft" />
        <div className="h-4 w-96 max-w-full animate-pulse bg-soft" />
      </div>
      <div className="grid gap-2 px-4 sm:px-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse border border-line bg-surface" />
        ))}
      </div>
    </div>
  );
}
