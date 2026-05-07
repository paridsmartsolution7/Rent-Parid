"use client";

// Session-scoped in-memory + sessionStorage cache for JSON API responses.
// Keeps already-fetched data available instantly across client-side navigations.

const memoryCache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

// Hard reload should always show fresh data. The Navigation Timing API tells
// us how the page was loaded — on `reload` we wipe sessionStorage so the very
// next cachedFetch goes to the network. Done at module load (runs once per
// page load) so client-side route changes still hit cache as designed.
if (typeof window !== "undefined") {
  try {
    const entries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (entries.length > 0 && entries[0].type === "reload") {
      sessionStorage.clear();
    }
  } catch {
    /* Navigation Timing unavailable — ignore. */
  }
}

function read<T>(key: string): T | null {
  if (memoryCache.has(key)) return memoryCache.get(key) as T;
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T): void {
  memoryCache.set(key, value);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — ignore */
  }
}

// Per-key TTL in ms (Date.now() < timestamp + ttl → still fresh). Stored
// alongside the value as { value, ts }.
type Wrapped<T> = { value: T; ts: number };

function isFresh<T>(w: Wrapped<T> | null, ttlMs: number | undefined): boolean {
  if (!w) return false;
  if (!ttlMs) return true; // no TTL = forever
  return Date.now() - w.ts < ttlMs;
}

/**
 * Fetches `url` and caches the parsed JSON response for the session.
 * Subsequent calls (including across route changes) return instantly from cache.
 * Deduplicates concurrent in-flight requests for the same key.
 *
 * Pass `ttlMs` to expire the cache after N ms — admin edits to slow-changing
 * resources (config, hero) become visible without a full session reset.
 */
export async function cachedFetch<T = unknown>(
  url: string,
  cacheKey?: string,
  ttlMs?: number
): Promise<T> {
  const key = cacheKey ?? url;
  const cached = read<Wrapped<T>>(key);
  if (cached && typeof cached === 'object' && 'value' in (cached as any) && isFresh(cached, ttlMs)) {
    return (cached as any).value as T;
  }
  // Legacy un-wrapped entries (from before TTL support) are treated as fresh
  // forever to avoid breaking existing callers that don't pass ttlMs.
  if (cached && (!('value' in (cached as any)) || !('ts' in (cached as any))) && !ttlMs) {
    return cached as unknown as T;
  }

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetch(url, { cache: 'no-store' })
    .then((res) => res.json())
    .then((data: T) => {
      // Always wrap with timestamp so future TTL checks work.
      write(key, { value: data, ts: Date.now() } as Wrapped<T>);
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

export function invalidateCache(key: string): void {
  memoryCache.delete(key);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
