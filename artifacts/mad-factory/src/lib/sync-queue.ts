import {
  addToOutbox,
  getOutbox,
  getOutboxCount,
  removeOutboxItem,
  updateOutboxItem,
  type OutboxItem,
} from "./offline-db";

export const SYNC_EVENT = "mf:sync";
// Fired after a successful flush so React Query can invalidate all caches
export const SYNC_COMPLETE_EVENT = "mf:sync-complete";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SAFE_TO_QUEUE_PATHS = /\/api\//;
// Auth endpoints must NEVER be queued — they need real-time responses
const NEVER_QUEUE = /\/api\/(auth\/login|auth\/logout|auth\/me)/;

export type SyncState = "idle" | "syncing" | "error";

export function emitSyncState(state: SyncState, pending: number) {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { state, pending } }));
}

export async function queueRequest(
  url: string,
  method: OutboxItem["method"],
  body?: unknown,
  headers?: Record<string, string>,
) {
  await addToOutbox({ url, method, body, headers });
  const pending = await getOutboxCount();
  emitSyncState("idle", pending);
}

let flushing = false;

export async function flushOutbox(): Promise<{ ok: number; failed: number }> {
  if (flushing) return { ok: 0, failed: 0 };
  flushing = true;
  let ok = 0;
  let failed = 0;
  try {
    const items = await getOutbox();
    if (items.length === 0) return { ok: 0, failed: 0 };

    emitSyncState("syncing", items.length);

    for (const item of items) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          credentials: "include",
          headers: { "Content-Type": "application/json", ...(item.headers ?? {}) },
          body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
        });

        if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
        // 4xx = permanent failure — drop so it doesn't retry forever
        if (item.id !== undefined) await removeOutboxItem(item.id);
        ok++;
      } catch (err) {
        failed++;
        const updated: OutboxItem = {
          ...item,
          attempts: item.attempts + 1,
          lastError: String(err),
        };
        if (updated.attempts >= 10 && item.id !== undefined) {
          // Give up after 10 attempts
          await removeOutboxItem(item.id);
        } else {
          await updateOutboxItem(updated);
        }
      }
    }

    const remaining = await getOutboxCount();
    emitSyncState(failed > 0 && remaining > 0 ? "error" : "idle", remaining);

    // If any items synced successfully, notify the app to refresh its data
    if (ok > 0) {
      window.dispatchEvent(
        new CustomEvent(SYNC_COMPLETE_EVENT, { detail: { ok, failed, remaining } }),
      );
    }
  } finally {
    flushing = false;
  }
  return { ok, failed };
}

export function installAutoSync() {
  const tryFlush = async () => {
    if (!navigator.onLine) return;
    // Web Locks API prevents duplicate replay across tabs
    const lockApi = (navigator as Navigator & { locks?: LockManager }).locks;
    if (lockApi?.request) {
      await lockApi.request("mf-outbox-flush", { ifAvailable: true }, async (lock) => {
        if (!lock) return;
        await flushOutbox();
      });
    } else {
      void flushOutbox();
    }
  };

  window.addEventListener("online", () => void tryFlush());
  // Periodic retry every 30 s
  setInterval(() => void tryFlush(), 30_000);
  // Initial attempt shortly after boot
  setTimeout(() => void tryFlush(), 2_000);
}

/**
 * Patch window.fetch so write requests to /api/* are transparently
 * captured into the IndexedDB outbox when the device is offline (or the
 * request fails with a network error).  The mutation appears to succeed
 * (HTTP 204) so React Query treats it as success and the UI updates
 * optimistically.  The outbox is replayed automatically when connectivity
 * returns.
 */
export function installFetchOfflineQueue() {
  const original = window.fetch.bind(window);

  window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const method = (
      init?.method ||
      (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const url =
      input instanceof Request
        ? input.url
        : typeof input === "string"
          ? input
          : input.toString();

    const isWrite = WRITE_METHODS.has(method);
    const isApi = SAFE_TO_QUEUE_PATHS.test(url);
    const blocked = NEVER_QUEUE.test(url);

    // Non-write / non-API / auth → always pass through
    if (!isWrite || !isApi || blocked) {
      return original(input as RequestInfo, init);
    }

    const queueIt = async () => {
      let body: unknown = undefined;
      if (init?.body != null) {
        if (typeof init.body === "string") {
          try {
            body = JSON.parse(init.body);
          } catch {
            body = init.body;
          }
        } else {
          body = init.body;
        }
      } else if (input instanceof Request) {
        try {
          body = await input.clone().json();
        } catch {
          /* ignore */
        }
      }
      const headerEntries: Record<string, string> = {};
      const h = new Headers(init?.headers);
      h.forEach((v, k) => {
        if (k.toLowerCase() !== "content-length") headerEntries[k] = v;
      });
      await queueRequest(url, method as OutboxItem["method"], body, headerEntries);
    };

    // ── OFFLINE PATH ─────────────────────────────────────────────────────────
    if (!navigator.onLine) {
      await queueIt();
      // Return a fake-success response so React Query mutation onSuccess fires
      return new Response(
        JSON.stringify({ queued: true, offline: true }),
        {
          status: 200,
          statusText: "Queued (offline)",
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // ── ONLINE PATH (with network-error fallback) ─────────────────────────────
    try {
      const res = await original(input as RequestInfo, init);
      // 5xx → queue for retry
      if (res.status >= 500) {
        await queueIt();
      }
      return res;
    } catch {
      // Network error while nominally online → queue and synthesize success
      await queueIt();
      return new Response(
        JSON.stringify({ queued: true, offline: true }),
        {
          status: 200,
          statusText: "Queued (network error)",
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  };
}
