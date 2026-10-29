import { NextRequest } from "next/server";
import { z } from "zod";
import { getAirQualitySeries, getLatestAqiByCity } from "@/lib/aggregations";
import { withCache } from "@/lib/cache";
import { cachedJson, errorJson } from "@/lib/http";
import { parsePeriod } from "@/lib/period";

const querySchema = z.object({
  period: z.string().optional()
});

/** GET /api/aggregated/air-quality?period=30d — série temporelle + dernier AQI par ville. */
export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return errorJson("Invalid query", 400);
  const period = parsePeriod(parsed.data.period);

  try {
    const result = await withCache(`air:${period}`, async () => ({
      series: await getAirQualitySeries(period),
      latest: await getLatestAqiByCity()
    }));
    return cachedJson(
      { ok: true, data: result.data, meta: { period, cached: result.cached } },
      { sMaxAge: 120 }
    );
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : "DB error", 500);
  }
}
