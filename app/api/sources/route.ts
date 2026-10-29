import { getSourcesHealth } from "@/lib/aggregations";
import { withCache } from "@/lib/cache";
import { cachedJson, errorJson } from "@/lib/http";

/** GET /api/sources — santé et dernier sync de chaque source (cache TTL 60s). */
export async function GET() {
  try {
    const result = await withCache("sources:health", () => getSourcesHealth());
    return cachedJson({ ok: true, data: result.data, meta: { cached: result.cached, fetchedAt: result.fetchedAt } });
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : "Failed to load sources", 500);
  }
}
