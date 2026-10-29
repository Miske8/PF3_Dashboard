import { fetchJson } from "../http-client";

/**
 * World Bank API — indicateurs par pays, SANS clé API.
 * - NY.GDP.MKTP.KD.ZG : croissance du PIB (%, annuel)
 * - SP.POP.TOTL       : population totale
 * L'API pagine par défaut à 50 lignes/page → on passe `per_page` explicite.
 */
const BASE = "https://api.worldbank.org/v2";

export type WbIndicator = "NY.GDP.MKTP.KD.ZG" | "SP.POP.TOTL";

interface WbRecord {
  date: string; // "2024"
  countryiso3code: string;
  value: number | null;
}

type WbResponse = [{ pages?: number; total?: number }, WbRecord[] | null];

export interface YearlyPoint {
  codeIso3: string;
  year: number;
  value: number;
}

/** Récupère un indicateur pour tous les pays sur une plage d'années. */
export async function fetchWorldBank(
  indicator: WbIndicator,
  startYear: number,
  endYear: number
): Promise<YearlyPoint[]> {
  const url =
    `${BASE}/country/ALL/indicator/${indicator}` +
    `?format=json&date=${startYear}:${endYear}&per_page=20000`;

  const raw = await fetchJson<WbResponse>(url, { timeoutMs: 20_000 });
  const records = Array.isArray(raw?.[1]) ? raw[1] : [];

  return records
    .filter((r) => typeof r.value === "number" && /^[A-Z]{3}$/.test(r.countryiso3code))
    .map((r) => ({
      codeIso3: r.countryiso3code,
      year: Number(r.date),
      value: r.value as number
    }));
}

/** Convenience : croissance du PIB sur `years` années glissantes. */
export async function fetchGdpGrowth(years = 10): Promise<YearlyPoint[]> {
  const end = new Date().getFullYear();
  return fetchWorldBank("NY.GDP.MKTP.KD.ZG", end - years, end);
}

/** Convenience : population totale (dernières valeurs connues). */
export async function fetchPopulation(years = 3): Promise<YearlyPoint[]> {
  const end = new Date().getFullYear();
  return fetchWorldBank("SP.POP.TOTL", end - years, end);
}
