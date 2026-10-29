import { prisma } from "./prisma";
import { fetchCountries } from "./sources/rest-countries";
import { fetchGdpGrowth } from "./sources/world-bank";
import { fetchAirQuality, CITIES } from "./sources/open-meteo";
import { invalidateCache } from "./cache";

/**
 * Service d'ingestion : appelle les APIs externes puis upsert en PostgreSQL.
 * Chaque source est isolée (une panne n'arrête pas les autres) et journalisée
 * dans IngestLog pour l'observabilité.
 */
export interface IngestResult {
  source: string;
  status: "ok" | "error" | "partial";
  records: number;
  durationMs: number;
  error?: string;
}

async function ensureSource(key: string, name: string, baseUrl: string) {
  return prisma.source.upsert({
    where: { key },
    update: { name, baseUrl },
    create: { key, name, baseUrl }
  });
}

async function logIngest(
  sourceId: number | null,
  result: Omit<IngestResult, "source"> & { sourceKey: string }
) {
  const { sourceKey, ...rest } = result;
  await prisma.ingestLog.create({
    data: { sourceId, status: rest.status, records: rest.records, durationMs: rest.durationMs, error: rest.error ?? null }
  });
  void sourceKey;
}

/** Source 1+3 : pays (REST Countries) enrichis de la croissance PIB récente (World Bank). */
async function ingestEconomies(): Promise<IngestResult> {
  const started = Date.now();
  const src = await ensureSource("rest-countries", "REST Countries", "https://restcountries.com");
  try {
    const [countries, gdpPoints] = await Promise.all([fetchCountries(), fetchGdpGrowth(10)]);

    // dernière valeur dispo par pays pour le champ typé CountryEconomy
    const latestGdp = new Map<string, { year: number; growth: number }>();
    for (const p of gdpPoints) {
      const cur = latestGdp.get(p.codeIso2);
      if (!cur || p.year > cur.year) latestGdp.set(p.codeIso2, { year: p.year, growth: p.growth });
    }

    let count = 0;
    for (const c of countries.slice(0, 120)) {
      const g = latestGdp.get(c.cca3);
      await prisma.countryEconomy.upsert({
        where: { code: c.cca3 },
        update: {
          name: c.name.common,
          region: c.region ?? null,
          subregion: c.subregion ?? null,
          population: c.population,
          area: c.area ?? null,
          gdpGrowth: g?.growth ?? null,
          gdpYear: g?.year ?? null
        },
        create: {
          code: c.cca3,
          name: c.name.common,
          region: c.region ?? null,
          subregion: c.subregion ?? null,
          population: c.population,
          area: c.area ?? null,
          gdpGrowth: g?.growth ?? null,
          gdpYear: g?.year ?? null
        }
      });
      count++;
    }

    // snapshots bruts → historique générique (MetricSnapshot)
    await prisma.metricSnapshot.createMany({
      data: countries.map((c) => ({
        sourceId: src.id,
        metricKey: "country.demography",
        dimension: c.cca3,
        value: { name: c.name.common, population: c.population, area: c.area ?? null, region: c.region ?? null }
      }))
    });

    await prisma.source.update({ where: { id: src.id }, data: { lastSyncAt: new Date() } });
    const result = { sourceKey: src.key, source: "economies", status: "ok" as const, records: count, durationMs: Date.now() - started };
    await logIngest(src.id, result);
    return result;
  } catch (err) {
    const result = { sourceKey: src.key, source: "economies", status: "error" as const, records: 0, durationMs: Date.now() - started, error: String(err) };
    await logIngest(src.id, result);
    return result;
  }
}

/** Source 2 : qualité de l'air (Open-Meteo) — série temporelle par ville. */
async function ingestAirQuality(): Promise<IngestResult> {
  const started = Date.now();
  const src = await ensureSource("open-meteo", "Open-Meteo Air Quality", "https://air-quality-api.open-meteo.com");
  try {
    const points = await fetchAirQuality();
    if (points.length === 0) throw new Error("no data returned");

    // Agrège horaires -> journalier (moyenne) pour alléger la BDD
    const daily = new Map<string, { sum: number; n: number; pm25: number; pm10: number; date: Date }>();
    for (const p of points) {
      if (p.aqi == null) continue;
      const day = p.measuredAt.toISOString().slice(0, 10);
      const key = `${p.city}|${day}`;
      const cur = daily.get(key) ?? { sum: 0, n: 0, pm25: 0, pm10: 0, date: new Date(day) };
      cur.sum += p.aqi;
      cur.n += 1;
      cur.pm25 += p.pm25 ?? 0;
      cur.pm10 += p.pm10 ?? 0;
      daily.set(key, cur);
    }

    const rows = [...daily.entries()].map(([key, v]) => {
      const [city] = key.split("|");
      const meta = CITIES.find((c) => c.name === city);
      return {
        city,
        country: meta?.country ?? null,
        latitude: meta?.latitude ?? 0,
        longitude: meta?.longitude ?? 0,
        aqi: Math.round(v.sum / v.n),
        pm25: +(v.pm25 / v.n).toFixed(2),
        pm10: +(v.pm10 / v.n).toFixed(2),
        measuredAt: v.date
      };
    });

    await prisma.cityAirQuality.createMany({ data: rows });
    await prisma.metricSnapshot.createMany({
      data: rows.map((r) => ({
        sourceId: src.id,
        metricKey: "air.aqi_daily",
        dimension: r.city,
        value: { aqi: r.aqi, pm25: r.pm25, pm10: r.pm10 }
      }))
    });

    await prisma.source.update({ where: { id: src.id }, data: { lastSyncAt: new Date() } });
    const result = { sourceKey: src.key, source: "air-quality", status: "ok" as const, records: rows.length, durationMs: Date.now() - started };
    await logIngest(src.id, result);
    return result;
  } catch (err) {
    const result = { sourceKey: src.key, source: "air-quality", status: "error" as const, records: 0, durationMs: Date.now() - started, error: String(err) };
    await logIngest(src.id, result);
    return result;
  }
}

/** Orchestration complète ; appelée par /api/ingest et le script CLI. */
export async function runIngestion(): Promise<IngestResult[]> {
  const results = await Promise.all([ingestEconomies(), ingestAirQuality()]);
  invalidateCache(); // purge le cache TTL après une sync
  return results;
}
