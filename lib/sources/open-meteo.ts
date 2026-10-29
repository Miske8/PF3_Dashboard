import { fetchJson } from "../http-client";

/**
 * Open-Meteo Air Quality API — AQI horaire sur 7 jours pour des villes fixes
 * (coordonnées hardcodées : pas besoin du géocoding, zéro clé API).
 */
export const CITIES = [
  { name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 },
  { name: "New York", country: "USA", latitude: 40.7128, longitude: -74.006 },
  { name: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503 },
  { name: "Delhi", country: "India", latitude: 28.6139, longitude: 77.209 },
  { name: "São Paulo", country: "Brazil", latitude: -23.5505, longitude: -46.6333 }
] as const;

interface OmAqiResponse {
  hourly?: {
    time: string[];
    us_aqi?: (number | null)[];
    pm2_5?: (number | null)[];
    pm10?: (number | null)[];
  };
}

export interface AirQualityPoint {
  city: string;
  measuredAt: Date;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
}

async function fetchCity(city: (typeof CITIES)[number]): Promise<AirQualityPoint[]> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${city.latitude}&longitude=${city.longitude}` +
    `&hourly=us_aqi,pm2_5,pm10&past_days=7&forecast_days=0`;
  try {
    const raw = await fetchJson<OmAqiResponse>(url, { timeoutMs: 15_000 });
    const h = raw.hourly;
    if (!h?.time) return [];
    return h.time.map((t, i) => ({
      city: city.name,
      measuredAt: new Date(t),
      aqi: h.us_aqi?.[i] ?? null,
      pm25: h.pm2_5?.[i] ?? null,
      pm10: h.pm10?.[i] ?? null
    }));
  } catch {
    return [];
  }
}

export async function fetchAirQuality(): Promise<AirQualityPoint[]> {
  const batches = await Promise.all(CITIES.map(fetchCity));
  return batches.flat();
}
