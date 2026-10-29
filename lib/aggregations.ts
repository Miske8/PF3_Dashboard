import { prisma } from "./prisma";
import { periodToSince, type Period } from "./period";

/** Agrégations typées pour le dashboard — requêtes Prisma + transformations. */

export interface EconomyRow {
  code: string;
  name: string;
  region: string | null;
  population: number;
  area: number;
  gdpGrowth: number | null;
}

/** Top pays par population (table typée CountryEconomy). */
export async function getTopEconomies(limit = 10): Promise<EconomyRow[]> {
  const rows = await prisma.countryEconomy.findMany({
    orderBy: { population: "desc" },
    take: limit,
    select: { code: true, name: true, region: true, population: true, area: true, gdpGrowth: true }
  });
  return rows.map((r) => ({ ...r, population: r.population ?? 0, area: r.area ?? 0 }));
}

/** Population totale par région (BarChart). */
export async function getPopulationByRegion(): Promise<{ region: string; population: number; countries: number }[]> {
  const rows = await prisma.countryEconomy.groupBy({
    by: ["region"],
    _sum: { population: true },
    _count: { id: true }
  });
  return rows
    .filter((r) => r.region)
    .map((r) => ({ region: r.region as string, population: r._sum.population ?? 0, countries: r._count.id }))
    .sort((a, b) => b.population - a.population);
}

/** Série temporelle AQI moyen par ville, filtrée sur la période. */
export async function getAirQualitySeries(period: Period) {
  const since = periodToSince(period);
  const rows = await prisma.cityAirQuality.findMany({
    where: since ? { measuredAt: { gte: since } } : {},
    orderBy: { measuredAt: "asc" }
  });

  // pivot -> [{ date: "2026-10-21", Paris: 42, "New York": 35, ... }]
  const byDate = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const day = r.measuredAt.toISOString().slice(0, 10);
    const entry = byDate.get(day) ?? { date: day };
    entry[r.city] = r.aqi ?? 0;
    byDate.set(day, entry);
  }
  return [...byDate.values()];
}

/**AQI moyen actuel par ville (carte KPI radar / bar). */
export async function getLatestAqiByCity() {
  const cities = await prisma.cityAirQuality.groupBy({ by: ["city"] });
  const out: { city: string; aqi: number }[] = [];
  for (const c of cities) {
    const last = await prisma.cityAirQuality.findFirst({
      where: { city: c.city },
      orderBy: { measuredAt: "desc" }
    });
    if (last?.aqi != null) out.push({ city: c.city, aqi: last.aqi });
  }
  return out.sort((a, b) => a.aqi - b.aqi);
}

/** État de santé des sources pour l'UI (badge "données à jour"). */
export async function getSourcesHealth() {
  const sources = await prisma.source.findMany({
    include: { ingestLogs: { orderBy: { startedAt: "desc" }, take: 1 } }
  });
  return sources.map((s) => ({
    key: s.key,
    name: s.name,
    lastSyncAt: s.lastSyncAt ? s.lastSyncAt.toISOString() : null,
    lastStatus: s.ingestLogs[0]?.status ?? "never",
    lastRecords: s.ingestLogs[0]?.records ?? 0
  }));
}
