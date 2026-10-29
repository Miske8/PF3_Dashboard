import { fetchJson } from "../http-client";

/** REST Countries — population/superficie des pays indépendants (sans clé API). */
export interface RestCountry {
  name: { common: string; official?: string };
  cca3: string; // code ISO 3166-1 alpha-3
  region?: string;
  subregion?: string;
  population: number;
  area?: number;
  capital?: string[];
}

const URL =
  "https://restcountries.com/v3.1/independent?status=true&fields=name,cca3,population,area,region,subregion,capital";

export async function fetchCountries(): Promise<RestCountry[]> {
  const data = await fetchJson<RestCountry[]>(URL, { timeoutMs: 15_000 });
  return data.filter((c) => typeof c.population === "number" && !!c.cca3);
}
