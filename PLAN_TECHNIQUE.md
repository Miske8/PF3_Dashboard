# Plan Technique — Dashboard Agrégateur de Données (MVP)

## 1. Objectif MVP
Consommer 2-3 API externes gratuites et sans clé API (pour un portfolio déployable immédiatement),
stocker les données en PostgreSQL via Prisma, servir des endpoints agrégés avec cache, et afficher
des graphiques filtrables par période avec Recharts.

**Sources retenues (gratuites, sans clé API) :**
| # | API | Données | Endpoint utilisé |
|---|-----|---------|------------------|
| 1 | REST Countries | Population / superficie par pays | `https://restcountries.com/v3.1/independent?status=true&fields=name,population,area,region,capital` |
| 2 | Open-Meteo (air quality + geocoding) | Indice de qualité de l'air (AQI) par ville | `https://air-quality-api.open-meteo.com/v1/air-quality?...` |
| 3 | World Bank API | PIB (% croissance annuelle) par pays | `https://api.worldbank.org/v2/country/{iso}/indicator/NY.GDP.MKTP.KD.ZG?format=json` |

> Alternative possible : CoinGecko (crypto) ou Alpha Vantage si on accepte une clé API gratuite.

## 2. Architecture

```
[APIs externes] --(cron/vercel cron: ingest)--> [Route handler /api/ingest]
                                                        |
                                                        v
                                               [PostgreSQL via Prisma]
                                                        |
                            [Server Components] <-- [Routes /api/aggregated + /api/dashboard]
                                    |                        |
                                    v                        v
                          [UI Next.js + Tailwind]     [Cache multi-niveaux]
                          Recharts, filtres période   1) LRU in-process (TTL)
                                                      2) Cache-Control HTTP (s-maxage)
```

- **Next.js App Router** : pages en Server Components (données injectées côté serveur), routes API pour ingestion/agrégation.
- **Ingestion découplée** : les APIs externes ne sont jamais appelées au rendu ; un job d'ingestion alimente la BDD.
- **Cache 3 niveaux** :
  1. **In-process TTL** (`lib/cache.ts`) : évite les requêtes DB répétées sur les agrégats coûteux.
  2. **HTTP** : en-têtes `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` sur les GET.
  3. **DB = cache persistant** : les snapshots des APIs sont stockés → uptime du dashboard indépendant des pannes d'API tierces.

## 3. Dépendances

```jsonc
{
  "dependencies": {
    "next", "react", "react-dom",
    "@prisma/client",
    "recharts",           // graphiques
    "zod",                // validation query params / payloads API
    "lru-cache"           // cache in-process TTL
  },
  "devDependencies": {
    "prisma", "typescript", "tailwindcss", "postcss", "autoprefixer",
    "@types/node", "@types/react", "@types/recharts"
  }
}
```

## 4. Schéma de données (Prisma)

Tables génériques orientées "agrégateur multi-sources" :

- **Source** : référence une API externe (name, baseUrl, lastSyncAt).
- **MetricSnapshot** : point de donnée brut horodaté (sourceId, metricKey, dimension, value JSONB, capturedAt) → permet d'ajouter une source sans migration.
- **CountryEconomy** (table typée exemple) : population, area, region, gdpGrowth — alimentée par REST Countries + World Bank.
- **CityAirQuality** : ville, lat/lon, AQI, composants pm2_5/pm10, measuredAt.
- **IngestLog** : statut des runs d'ingestion (source, status, records, durationMs, error) pour l'observabilité du portfolio.

Relations : Source 1—N MetricSnapshot / IngestLog. Index sur `(metricKey, capturedAt)` et `(countryCode, year)`.

## 5. Routes API

| Méthode | Route | Rôle | Params |
|---------|-------|------|--------|
| POST/GET | `/api/ingest` | Déclenche l'ingestion des 3 sources (cron-safe) | secret optionnel `INGEST_SECRET` |
| GET | `/api/sources` | Liste les sources + dernier sync + santé | — |
| GET | `/api/aggregated/economies` | Population/superficie agrégées par région/pays | `period`, `groupBy` |
| GET | `/api/aggregated/air-quality` | Historique AQI par ville | `city`, `period` |
| GET | `/api/aggregated/gdp` | Croissance PIB par pays et année | `codes`, `period` |
| GET | `/api/dashboard` | Payload combiné pour le dashboard (1 appel, cache TTL) | `period=7d\|30d\|90d\|all` |

Validation des entrées avec Zod, réponses normalisées `{ ok, data, meta: { cached, fetchedAt } }`.

## 6. Étapes de développement

1. **Scaffold** : Next.js + TS + Tailwind + structure dossiers ✅
2. **Schéma Prisma + migration SQL** ✅
3. **Clients d'API externes** (`lib/sources/*.ts`) avec timeouts + retry ✅
4. **Couche cache TTL + helpers HTTP** ✅
5. **Routes API ingestion + agrégation** ✅
6. **UI dashboard** : cartes KPI, graphiques Recharts, sélecteur de période ✅
7. **Cron d'ingestion** (`vercel.json` / GitHub Actions) ⏳ (fourni en config)
8. **Polish** : loading states, erreurs, README déploiement ⏳
