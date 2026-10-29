import { fetchJson } from "../http-client";

/**
 * World Bank API — croissance du PIB (%) par pays et par année (sans clé API).
 * Réponse typée : [meta, records] avec `value` null pour les années manquantes.
 */
interface WbRecord {
  date: string; // "2023"
  countryiso3code: string;
  value: number | null;
}

const indicator = "NY.GDP.MKTP.KD.ZG"; // GDP growth (annual %)
const COUNTRIES = ["FR", "US", "DE", "GB", "JP", "BR", "IN", "CA"];

export interface GdpPoint {
  codeIso2: string;
  year: number;
  growth: number;
}

export async function fetchGdpGrowth(years = 10): Promise<GdpPoint[]> {
  const startYear = new Date().getFullYear() - years;
  const iso2toIso3: Record<string, string> = {
    FR: "FRA", US: "USA", DE: "DEU", GB: "GBR", JP: "JPN", BR: "BRA", IN: "IND", CA: "CAN"
  };

  const results = await Promise.all(
    COUNTRIES.map(async (iso2) => {
      const url =
        `https://api.worldbank.org/v2/country/${iso2}/indicator/${indicator}` +
        `?format=json&date=${startYear}:${new Date().getFullYear()}`;
      try {
        const raw = await fetchJson<[unknown, WbRecord[]]>(url, { timeoutMs: 15_000 });
        const records = Array.isArray(raw?.[1]) ? raw[1] : [];
        return records
          .filter((r) => typeof r.value === "number")
          .map((r) => ({
            codeIso2: iso2,
            year: Number(r.date),
            growth: r.value as number
          }));
      } catch {
        return [] as GdpPoint[];
      }
    })
  );

  // aplati + attache l'ISO3 pour joindre CountryEconomy
  return results.flat().map((p) => ({ ...p, codeIso2: iso2toIso3[p.codeIso2] ?? p.codeIso2 }));
}
