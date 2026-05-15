import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { flushOutbox } from "@/lib/sync-queue";
import { useState, useEffect, useRef } from "react";

export function OfflineBanner() {
  const { online, syncState, pending } = useNetworkStatus();
  const [justCameOnline, setJustCameOnline] = useState(false);
  const prevOnline = useRef(online);

  useEffect(() => {
    // Only fire when transitioning from offline → online
    if (!prevOnline.current && online) {
      setJustCameOnline(true);
      const t = setTimeout(() => setJustCameOnline(false), 3000);
      prevOnline.current = online;
      return () => clearTimeout(t);
    }
    prevOnline.current = online;
    return undefined;
  }, [online]);

  if (syncState === "syncing") {
    return (
      <div
        className="bg-amber-500 text-white px-6 py-2 flex items-center justify-center gap-3 text-sm font-medium print:hidden"
        dir="rtl"
      >
        <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
        <span>هاوکاتکردنی {pending} گۆڕانکاری بە سێرڤەر...</span>
      </div>
    );
  }

  if (!online) {
    return (
      <div
        className="bg-red-600 text-white px-6 py-2 flex items-center justify-center gap-3 text-sm font-medium print:hidden"
        dir="rtl"
      >
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>
          ئۆفلاین — ئەپ لە مۆدی ئۆفلاین کار دەکات.{" "}
          {pending > 0 ? (
            <span className="opacity-90">
              {pending} گۆڕانکاری دەمێنێتەوە بۆ هاوکاتکردن کاتێک ئینتەرنێت گەڕایەوە.
            </span>
          ) : (
            <span className="opacity-90">هەموو داتا لە کاشی ناوخۆیەوە بارکراوە.</span>
          )}
        </span>
      </div>
    );
  }

  if (online && pending > 0) {
    return (
      <div
        className="bg-amber-100 dark:bg-amber-900/40 border-b border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 px-6 py-2 flex items-center justify-center gap-3 text-sm print:hidden cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
        dir="rtl"
        onClick={() => void flushOutbox()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") void flushOutbox();
        }}
      >
        <RefreshCw className="h-4 w-4 shrink-0" />
        <span>
          {pending} گۆڕانکاری چاوەڕێی هاوکاتکردنە — کلیک بکە بۆ ئێستا هاوکاتکردن
        </span>
      </div>
    );
  }

  if (justCameOnline) {
    return (
      <div
        className="bg-emerald-500 text-white px-6 py-2 flex items-center justify-center gap-3 text-sm font-medium print:hidden"
        dir="rtl"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>پەیوەست بووەوە — هەمووی هاوکات کرا</span>
      </div>
    );
  }

  return null;
}
