import { unstable_noStore as noStore } from "next/cache";
import Dashboard, { type DashboardData } from "@/components/Dashboard";
import {
  getTopEconomies,
  getPopulationByRegion,
  getAirQualitySeries,
  getLatestAqiByCity,
  getSourcesHealth
} from "@/lib/aggregations";

/**
 * Page serveur : charge directement via Prisma (SSR) et passe le payload initial
 * au client. Les changements de période passent par /api/dashboard (cache).
 * Si la BDD est vide/injoignable, on rend l'UI avec des données vides + hint.
 */
export const dynamic = "force-dynamic";

async function loadData(): Promise<DashboardData> {
  noStore();
  try {
    const [topCountries, populationByRegion, airSeries, airLatest, sources] = await Promise.all([
      getTopEconomies(10),
      getPopulationByRegion(),
      getAirQualitySeries("30d"),
      getLatestAqiByCity(),
      getSourcesHealth()
    ]);
    return { topCountries, populationByRegion, airSeries, airLatest, sources };
  } catch {
    return { topCountries: [], populationByRegion: [], airSeries: [], airLatest: [], sources: [] };
  }
}

export default async function Home() {
  const initial = await loadData();
  return <Dashboard initial={initial} />;
}
