/**
 * fetchJson : helper robuste pour consommer les APIs externes.
 * - Timeout via AbortController (les APIs tierces peuvent hang).
 * - Retry exponentiel simple sur erreurs réseau / 5xx.
 */
export interface FetchJsonOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 10_000, retries = 2, headers } = opts;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "data-aggregator-dashboard/0.1", ...headers },
        // Next.js extended fetch options (revalider en secondes)
        ...( { next: { revalidate: 3600 } } as RequestInit )
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      // backoff exponentiel: 250ms, 500ms, 1s...
      await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
