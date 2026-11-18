"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "./button";
import { Field } from "./field";
import { controlClass } from "./input";
import { cn } from "@/lib/cn";

export type ComboOption = { value: string; label: string; hint?: string };

/**
 * Ô tìm rồi chọn một mục (FE-03, "Combobox"), theo mẫu combobox + listbox của WAI-ARIA: ↓ ↑ đi trong danh sách, Enter chọn, Esc đóng, Tab rời ô.
 * Danh sách do nơi dùng cấp (`options`) và đổi theo `onQueryChange`, nên dùng được cho cả danh sách có sẵn lẫn tìm qua API (nơi dùng tự đợi, bỏ kết quả về muộn).
 * Đã chọn thì hiện mục đã chọn kèm nút "Bỏ chọn" thay cho ô gõ.
 */
export function Combobox({ label, hint, error, required, options, selected, onSelect, onQueryChange, loading, placeholder, emptyText = "Không có kết quả", disabled, clearLabel = "Bỏ chọn" }: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  options: ComboOption[];
  selected: ComboOption | null;
  onSelect: (option: ComboOption | null) => void;
  onQueryChange?: (query: string) => void;
  loading?: boolean;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearLabel?: string;
}) {
  const list = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const optionId = (index: number) => `${list}-o${index}`;

  const choose = (option: ComboOption) => {
    onSelect(option);
    setOpen(false);
    setQuery("");
  };
  const type = (text: string) => {
    setQuery(text);
    setOpen(true);
    setActive(0);
    onQueryChange?.(text);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && open && options[active]) {
      event.preventDefault();          // đang chọn trong danh sách thì Enter không gửi biểu mẫu
      choose(options[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();         // Esc đóng danh sách, không đóng hộp thoại chứa ô này
      setOpen(false);
    }
  };

  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(control) =>
        selected ? (
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border border-line-strong bg-soft px-2 py-1 text-sm">
            <span id={control.id} aria-describedby={control["aria-describedby"]}>{selected.label}</span>
            <Button size="sm" onClick={() => { onSelect(null); setTimeout(() => input.current?.focus(), 0); }} disabled={disabled} aria-label={`${clearLabel}: ${selected.label}`}>{clearLabel}</Button>
          </div>
        ) : (
          <div className="relative">
            <input
              {...control}
              ref={input}
              role="combobox"
              aria-expanded={open}
              aria-controls={list}
              aria-autocomplete="list"
              aria-activedescendant={open && options[active] ? optionId(active) : undefined}
              autoComplete="off"
              value={query}
              placeholder={placeholder}
              disabled={disabled}
              onChange={(event) => type(event.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={onKeyDown}
              className={cn(controlClass, "h-10")}
            />
            {open && (
              <ul id={list} role="listbox" className="absolute z-20 mt-0.5 max-h-64 w-full overflow-auto border border-line-strong bg-surface text-sm shadow-md">
                {options.length === 0 ? (
                  <li role="presentation" className="px-3 py-2 text-muted">{loading ? "Đang tìm…" : emptyText}</li>
                ) : (
                  options.map((option, index) => (
                    <li
                      key={option.value}
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === active}
                      onMouseDown={(event) => { event.preventDefault(); choose(option); }}     // giữ tiêu điểm ở ô gõ, không kích hoạt onBlur trước khi chọn
                      onMouseEnter={() => setActive(index)}
                      className={cn("cursor-pointer px-3 py-2", index === active && "bg-accent-soft")}
                    >
                      <span>{option.label}</span>
                      {option.hint && <span className="block text-xs text-muted">{option.hint}</span>}
                    </li>
                  ))
                )}
              </ul>
            )}
            <p role="status" className="sr-only">{open ? (options.length === 0 ? (loading ? "Đang tìm" : emptyText) : `${options.length} kết quả. Dùng mũi tên lên xuống để chọn.`) : ""}</p>
          </div>
        )
      }
    </Field>
  );
}
