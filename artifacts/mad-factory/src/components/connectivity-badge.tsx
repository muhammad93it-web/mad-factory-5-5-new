import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { flushOutbox } from "@/lib/sync-queue";

export function ConnectivityBadge() {
  const { online, syncState, pending } = useNetworkStatus();

  const handleClick = () => {
    if (online) void flushOutbox();
  };

  let label: string;
  let dotClass: string;
  let title: string;

  if (!online) {
    label = "ئۆفلاین";
    dotClass = "bg-red-500";
    title = pending > 0 ? `${pending} گۆڕانکاری چاوەڕێی هاوکات‌کردنە` : "بێ ئینتەرنێت";
  } else if (syncState === "syncing") {
    label = "هاوکاتکردن...";
    dotClass = "bg-amber-400 animate-pulse";
    title = `هاوکاتکردنی ${pending} داواکاری`;
  } else if (pending > 0) {
    label = `${pending} چاوەڕێ`;
    dotClass = "bg-amber-400";
    title = "گۆڕانکاری ئامادەی هاوکاتکردنە — کلیک بکە بۆ کردنی";
  } else {
    label = "ئۆنلاین";
    dotClass = "bg-emerald-500";
    title = "پەیوەستە";
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary-foreground/10 hover:bg-primary-foreground/20 text-[11px] font-medium transition-colors"
      data-testid="connectivity-badge"
    >
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      {syncState === "syncing" ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : online ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      <span>{label}</span>
    </button>
  );
}
