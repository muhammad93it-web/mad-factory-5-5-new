import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SYNC_COMPLETE_EVENT } from "@/lib/sync-queue";

/**
 * Listens for the mf:sync-complete event (fired by flushOutbox after any
 * items are successfully replayed) and invalidates ALL React Query caches so
 * the UI immediately shows the up-to-date server state.
 *
 * Mount this once near the top of the component tree (inside
 * QueryClientProvider) — it has no visible output.
 */
export function useSyncRefresh() {
  const qc = useQueryClient();

  useEffect(() => {
    const handler = () => {
      // Invalidate every query; they will refetch in the background.
      // Active queries refetch immediately; inactive ones refetch on next use.
      void qc.invalidateQueries();
    };

    window.addEventListener(SYNC_COMPLETE_EVENT, handler);
    return () => window.removeEventListener(SYNC_COMPLETE_EVENT, handler);
  }, [qc]);
}
