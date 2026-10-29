import { fetchJson } from "../http-client";

/**
 * Données pays (nom, ISO3, région, superficie) — source primaire : le jeu de
 * données open-source `mledoze/countries` servi via le CDN jsDelivr (clé JSON
 * compacte, sans CORS ni quota ; ~250 pays).
 *
 * NB : l'API publique restcountries.com v3.1 est dépréciée depuis 2026 et
 * exige désormais une clé payante ; on la garde en fallback si elle redevient
 * accessible. La population n'est pas fournie par ces datasets statiques :
 * elle est ingérée séparément depuis World Bank (SP.POP.TOTL) dans lib/ingest.
 */
export interface RestCountry {
  name: { common: string; official?: string };
  cca3: string; // code ISO 3166-1 alpha-3
  region?: string;
  subregion?: string;
  population: number; // 0 si inconnu à ce stade (complété par World Bank)
  area?: number;
  capital?: string[];
}

interface RawCountry {
  name?: { common?: string };
  cca3?: string;
  region?: string;
  subregion?: string;
  population?: number;
  area?: number;
  capital?: string[];
}

function normalize(raw: unknown[]): RestCountry[] {
  return raw
    .filter((c): c is RawCountry => !!c && typeof c === "object")
    .filter((c) => typeof c.cca3 === "string" && typeof c.name?.common === "string")
    .map((c) => ({
      name: { common: c.name!.common! },
      cca3: c.cca3!,
      region: c.region,
      subregion: c.subregion,
      population: typeof c.population === "number" ? c.population : 0,
      area: c.area,
      capital: c.capital
    }));
}

const SOURCES = [
  "https://cdn.jsdelivr.net/gh/mledoze/countries@master/dist/countries.json",
  "https://raw.githubusercontent.com/mledoze/countries/master/dist/countries.json",
  "https://restcountries.com/v3.1/all?fields=name,cca3,population,area,region,subregion,capital"
];

export async function fetchCountries(): Promise<RestCountry[]> {
  let lastError: unknown;
  for (const url of SOURCES) {
    try {
      const data = await fetchJson<unknown>(url, { timeoutMs: 20_000 });
      if (!Array.isArray(data)) throw new Error("unexpected payload shape");
      const list = normalize(data);
      if (list.length < 100) throw new Error(`too few countries (${list.length})`);
      return list;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
