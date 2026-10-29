import { NextRequest } from "next/server";
import { z } from "zod";
import { getTopEconomies, getPopulationByRegion } from "@/lib/aggregations";
import { withCache } from "@/lib/cache";
import { cachedJson, errorJson } from "@/lib/http";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  groupBy: z.enum(["country", "region"]).default("country")
});

/**
 * GET /api/aggregated/economies?limit=10&groupBy=region
 * - groupBy=country → top pays par population
 * - groupBy=region  → population agrégée par région
 */
export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return errorJson(parsed.error.flatten().toString(), 400);
  const { limit, groupBy } = parsed.data;

  try {
    const result = await withCache(`economies:${groupBy}:${limit}`, async () =>
      groupBy === "region"
        ? { kind: "region" as const, rows: await getPopulationByRegion() }
        : { kind: "country" as const, rows: await getTopEconomies(limit) }
    );
    return cachedJson({ ok: true, data: result.data, meta: { cached: result.cached } });
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : "DB error", 500);
  }
}
