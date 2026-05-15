import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Option = {
  value: string;
  label: string;
  sub?: string;
  haystack?: string;
};

type DropdownPos = {
  top: number;
  left: number;
  width: number;
  openUpward: boolean;
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
 * The dropdown is rendered via a Portal so it is never clipped by
 * ancestor overflow:hidden / overflow:clip containers.
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
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pos, setPos] = useState<DropdownPos | null>(null);

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

  // Compute portal position from the trigger button's bounding rect
  const calcPos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropH = Math.min(288, window.innerHeight * 0.4); // max-h-72 ≈ 288px
    const openUpward = spaceBelow < dropH + 8 && spaceAbove > spaceBelow;
    setPos({
      top: openUpward ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 260),
      openUpward,
    });
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    calcPos();
    setOpen(true);
  }, [disabled, calcPos]);

  useEffect(() => {
    if (!open) return;

    // Recalculate position on scroll / resize
    const onLayout = () => calcPos();
    window.addEventListener("scroll", onLayout, true);
    window.addEventListener("resize", onLayout);

    // Close when clicking outside button or dropdown
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);

    // Focus search input
    const t = setTimeout(() => inputRef.current?.focus(), 30);

    return () => {
      window.removeEventListener("scroll", onLayout, true);
      window.removeEventListener("resize", onLayout);
      document.removeEventListener("mousedown", onMouseDown);
      clearTimeout(t);
    };
  }, [open, calcPos]);

  const pick = (v: string) => {
    onChange(v);
    setQuery("");
    setOpen(false);
  };

  const dropdown = open && pos ? (
    <div
      ref={dropRef}
      style={{
        position: "fixed",
        top: pos.openUpward ? undefined : pos.top,
        bottom: pos.openUpward ? window.innerHeight - pos.top : undefined,
        left: pos.left,
        width: pos.width,
        zIndex: 9999,
      }}
      className="max-h-72 bg-white border border-slate-300 rounded-md shadow-xl overflow-hidden flex flex-col"
      dir="rtl"
    >
      <div className="relative border-b border-slate-200 bg-slate-50 shrink-0">
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
              {o.sub && (
                <span className="font-mono text-[11px] text-slate-500 tabular-nums" dir="ltr">
                  {o.sub}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className={cn("relative", className)}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={openDropdown}
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

      {typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}
