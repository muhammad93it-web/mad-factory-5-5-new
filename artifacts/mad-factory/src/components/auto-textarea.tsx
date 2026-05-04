import * as React from "react";
import { cn } from "@/lib/utils";

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> & {
  minRows?: number;
  maxRows?: number;
};

/**
 * Textarea that auto-grows vertically as the user types and never shows a
 * scrollbar until `maxRows` is exceeded. Wraps text on its own.
 */
export const AutoTextarea = React.forwardRef<HTMLTextAreaElement, Props>(
  ({ className, minRows = 2, maxRows = 12, value, onInput, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const resize = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      const cs = window.getComputedStyle(el);
      const lineHeight = parseFloat(cs.lineHeight || "20") || 20;
      const padTop = parseFloat(cs.paddingTop || "0") || 0;
      const padBottom = parseFloat(cs.paddingBottom || "0") || 0;
      const minH = lineHeight * minRows + padTop + padBottom;
      const maxH = lineHeight * maxRows + padTop + padBottom;
      const next = Math.max(minH, Math.min(maxH, el.scrollHeight));
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
    }, [minRows, maxRows]);

    React.useEffect(() => { resize(); }, [resize, value]);

    return (
      <textarea
        {...props}
        ref={innerRef}
        value={value}
        rows={minRows}
        onInput={(e) => { resize(); onInput?.(e); }}
        className={cn(
          "w-full resize-none px-2 py-1.5 bg-transparent border-0 outline-none text-sm leading-6",
          className,
        )}
      />
    );
  },
);
AutoTextarea.displayName = "AutoTextarea";
