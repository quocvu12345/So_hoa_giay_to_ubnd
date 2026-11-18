"use client";

import { useEffect, useRef, useState } from "react";
import { findProcedureOptions, loadProcedureSummary, type ProcedureOption, type ProcedureSummary } from "@/app/actions/procedure";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Chip } from "@/components/ui/status-chip";
import { useServerAction } from "@/lib/use-server-action";

export const SEARCH_DELAY_MS = 300;
const MIN_QUERY = 2;

const labelOf = (p: { name: string; code: string | null }) => (p.code ? `${p.name} (mã ${p.code})` : p.name);

/**
 * Chọn thủ tục hành chính khi tạo hồ sơ (FE-27): gõ tên không dấu hoặc mã, chọn rồi thấy ngay hồ sơ cần những giấy tờ nào (thành phần bắt buộc, theo mục).
 * Tìm đợi 300 ms sau lần gõ cuối và bỏ kết quả về muộn của lần gõ cũ. Thủ tục đã bãi bỏ hoặc thay thế không hiện (máy chủ lọc).
 * Chọn thủ tục là tùy chọn: bỏ chọn thì tạo hồ sơ thường.
 */
export function ProcedurePicker({ value, onChange }: { value: ProcedureSummary | null; onChange: (value: ProcedureSummary | null) => void }) {
  const find = useServerAction(findProcedureOptions, { toastErrors: false });
  const summary = useServerAction(loadProcedureSummary, { toastErrors: false });
  const [options, setOptions] = useState<ProcedureOption[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function onQueryChange(text: string) {
    clearTimeout(timer.current);
    const ticket = ++latest.current;
    setQuery(text);
    setError(null);
    if (text.trim().length < MIN_QUERY) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const outcome = await find.run(text);
      if (ticket !== latest.current) return;           // đã gõ tiếp: bỏ kết quả của lần gõ trước
      setLoading(false);
      if (outcome.ok) setOptions(outcome.data);
      else {
        setOptions([]);
        setError(outcome.message);
      }
    }, SEARCH_DELAY_MS);
  }

  async function onSelect(option: ComboOption | null) {
    if (!option) {
      onChange(null);
      return;
    }
    setError(null);
    const outcome = await summary.run(option.value);
    if (outcome.ok) {
      onChange(outcome.data);
      setOptions([]);
    } else setError(outcome.message);
  }

  const comboOptions: ComboOption[] = options.map((p) => ({ value: p.id, label: labelOf(p), hint: [p.domain, p.level, `${p.componentCount} thành phần`].filter(Boolean).join(" · ") }));
  const required = value?.components.filter((c) => c.required).length ?? 0;

  return (
    <div className="grid gap-2">
      <Combobox
        label="Thủ tục hành chính (tùy chọn)"
        hint={value ? undefined : "Chọn khi hồ sơ làm theo một thủ tục: hệ thống kiểm tra đủ thành phần bắt buộc trước khi trình. Bỏ trống thì tạo hồ sơ thường."}
        error={error}
        options={comboOptions}
        selected={value ? { value: value.id, label: labelOf(value) } : null}
        onSelect={(option) => void onSelect(option)}
        onQueryChange={onQueryChange}
        loading={loading || summary.pending}
        placeholder="Gõ tên hoặc mã thủ tục, ví dụ “khai sinh”"
        emptyText={query.trim().length < MIN_QUERY ? "Gõ ít nhất 2 ký tự để tìm" : "Không có thủ tục nào khớp"}
        clearLabel="Bỏ thủ tục"
      />
      {summary.pending && <p role="status" className="text-xs text-muted">Đang tải các thành phần của thủ tục…</p>}
      {value && (
        <details className="border border-line bg-surface p-3 text-sm" open={value.components.length <= 8}>
          <summary className="cursor-pointer font-semibold">
            Hồ sơ theo thủ tục này có {value.components.length} thành phần{required > 0 ? `, ${required} bắt buộc` : ""}
          </summary>
          <ul className="mt-2 grid gap-1">
            {value.components.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-2">
                <span>{c.name}</span>
                {c.required ? <Chip tone="warn">Bắt buộc</Chip> : <span className="text-xs text-muted">Nếu có</span>}
                {c.section && <span className="text-xs text-muted">· {c.section}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Thành phần bắt buộc phải có đủ và đã đối chiếu thì mới trình được. Gán giấy tờ vào thành phần ở tab Giấy tờ của hồ sơ.</p>
        </details>
      )}
    </div>
  );
}
