import { LRUCache } from "lru-cache";

/**
 * Cache in-process à TTL (niveau 1 du cache multi-niveaux).
 * - Évite les requêtes DB répétées sur les agrégats coûteux.
 * - En prod serverless, chaque instance garde son cache ; le niveau 2
 *   (Cache-Control / CDN) et le niveau 3 (snapshots en BDD) complètent.
 */
const DEFAULT_TTL_MS = 60_000; // 1 minute

const cache = new LRUCache<string, object>({
  max: 500,
  ttl: DEFAULT_TTL_MS
});

export interface CachedResult<T> {
  data: T;
  cached: boolean;
  fetchedAt: string;
}

/**
 * Enveloppe `fn` dans un cache TTL clé par clé.
 * @example await withCache("dashboard:30d", () => buildDashboard("30d"))
 */
export async function withCache<T extends object>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<CachedResult<T>> {
  const hit = cache.get(key);
  if (hit !== undefined) {
    return { data: hit as T, cached: true, fetchedAt: "n/a" };
  }
  const data = await fn();
  cache.set(key, data, { ttl: ttlMs });
  return { data, cached: false, fetchedAt: new Date().toISOString() };
}

/** Invalide une clé ou tout le cache (utile après ingestion). */
export function invalidateCache(key?: string) {
  if (key) cache.delete(key);
  else cache.clear();
}
