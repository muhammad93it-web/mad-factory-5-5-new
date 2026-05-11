import { useEffect, useState } from "react";
import { SYNC_EVENT, type SyncState } from "@/lib/sync-queue";
import { getOutboxCount } from "@/lib/offline-db";

export function useNetworkStatus() {
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [pending, setPending] = useState<number>(0);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent<{ state: SyncState; pending: number }>).detail;
      if (!detail) return;
      setSyncState(detail.state);
      setPending(detail.pending);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(SYNC_EVENT, onSync);
    // Initial count
    getOutboxCount().then(setPending).catch(() => {});
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(SYNC_EVENT, onSync);
    };
  }, []);

  return { online, syncState, pending };
}
