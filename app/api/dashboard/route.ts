import { NextRequest } from "next/server";
import { getTopEconomies, getPopulationByRegion, getAirQualitySeries, getLatestAqiByCity, getSourcesHealth } from "@/lib/aggregations";
import { withCache } from "@/lib/cache";
import { cachedJson, errorJson } from "@/lib/http";
import { parsePeriod } from "@/lib/period";

/**
 * GET /api/dashboard?period=30d
 * Payload combiné : un seul appel pour toute l'UI (cache TTL 60s + HTTP 120s).
 */
export async function GET(req: NextRequest) {
  const period = parsePeriod(req.nextUrl.searchParams.get("period"));

  try {
    const result = await withCache(
      `dashboard:${period}`,
      async () => ({
        topCountries: await getTopEconomies(10),
        populationByRegion: await getPopulationByRegion(),
        airSeries: await getAirQualitySeries(period),
        airLatest: await getLatestAqiByCity(),
        sources: await getSourcesHealth()
      }),
      60_000
    );
    return cachedJson(
      { ok: true, data: result.data, meta: { period, cached: result.cached, fetchedAt: result.fetchedAt } },
      { sMaxAge: 120, staleWhileRevalidate: 600 }
    );
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : "Dashboard build failed", 500);
  }
}
