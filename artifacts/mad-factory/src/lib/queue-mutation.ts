import { queueRequest } from "./sync-queue";

/**
 * Wrap a network call so it succeeds optimistically when offline by enqueuing
 * the request in the IndexedDB outbox. The outbox is replayed when connectivity
 * returns. Use for write mutations (POST/PUT/PATCH/DELETE) where eventual
 * consistency is acceptable.
 */
export async function performOrQueue<T>(opts: {
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  optimisticResult?: T;
}): Promise<T | { queued: true }> {
  if (!navigator.onLine) {
    await queueRequest(opts.url, opts.method, opts.body, opts.headers);
    return opts.optimisticResult ?? ({ queued: true } as T | { queued: true });
  }
  try {
    const res = await fetch(opts.url, {
      method: opts.method,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      // Server failures (5xx) get queued for retry; client errors don't
      if (res.status >= 500) {
        await queueRequest(opts.url, opts.method, opts.body, opts.headers);
        return opts.optimisticResult ?? ({ queued: true } as T | { queued: true });
      }
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json().catch(() => ({}))) as T;
  } catch (err) {
    // Network error → queue
    await queueRequest(opts.url, opts.method, opts.body, opts.headers);
    return opts.optimisticResult ?? ({ queued: true } as T | { queued: true });
  }
}
