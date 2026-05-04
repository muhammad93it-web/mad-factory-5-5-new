import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Option = {
  value: string;
  label: string;
  sub?: string;
  haystack?: string;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  emptyMessage?: string;
  allowClear?: boolean;
};

/**
 * Compact, accessible searchable single-select / autocomplete combobox.
 * Designed to replace a plain <select> + adjacent search input.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "گەڕان...",
  disabled,
  className,
  buttonClassName,
  emptyMessage = "هیچ ئەنجامێک نییە",
  allowClear = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = (o.haystack ?? `${o.label} ${o.sub ?? ""}`).toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => { setActiveIdx(0); }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => { document.removeEventListener("mousedown", onDoc); clearTimeout(t); };
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "w-full h-full flex items-center justify-between gap-2 px-2 py-1.5 bg-transparent text-sm text-right outline-none disabled:cursor-not-allowed disabled:opacity-60",
          buttonClassName,
        )}
      >
        <span className={cn("truncate flex-1 text-right", !selected && "text-slate-400")}>
          {selected ? selected.label : placeholder}
        </span>
        {selected && allowClear && !disabled ? (
          <X
            className="h-3.5 w-3.5 text-slate-400 hover:text-rose-600 shrink-0"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
          />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        )}
      </button>

      {open && (
        <div
          className="absolute z-50 top-full mt-1 left-0 right-0 min-w-[260px] max-h-72 bg-white border border-slate-300 rounded-md shadow-xl overflow-hidden flex flex-col"
          dir="rtl"
        >
          <div className="relative border-b border-slate-200 bg-slate-50">
            <Search className="h-3.5 w-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const o = filtered[activeIdx];
                  if (o) pick(o.value);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder={placeholder}
              className="w-full pr-7 pl-2 py-2 bg-transparent outline-none text-sm"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">{emptyMessage}</div>
            ) : (
              filtered.map((o, idx) => (
                <button
                  key={o.value}
                  type="button"
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => pick(o.value)}
                  className={cn(
                    "w-full text-right px-3 py-2 text-sm flex items-center justify-between gap-3 border-b border-slate-100 last:border-b-0 transition",
                    o.value === value
                      ? "bg-emerald-50 text-emerald-900 font-bold"
                      : idx === activeIdx
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <span className="truncate flex-1">{o.label}</span>
                  {o.sub && <span className="font-mono text-[11px] text-slate-500 tabular-nums" dir="ltr">{o.sub}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
