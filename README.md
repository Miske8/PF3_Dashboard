# 📊 Data Aggregator Dashboard (MVP)

Tableau de bord agrégateur de données : consomme 3 APIs publiques **sans clé API**,
stocke dans PostgreSQL via Prisma, sert des endpoints agrégés **multi-niveaux de cache**,
et affiche des graphiques Recharts filtrables par période.

Stack : **Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma · PostgreSQL · Recharts**

📄 Voir [PLAN_TECHNIQUE.md](./PLAN_TECHNIQUE.md) pour l'architecture détaillée.

## Sources
| Source | Données | Route d'ingestion |
|--------|---------|-------------------|
| REST Countries | Population / superficie / région | `/api/ingest` |
| Open-Meteo Air Quality | AQI + PM2.5/PM10 (5 villes, 7 jours) | `/api/ingest` |
| World Bank | Croissance du PIB (%) sur 10 ans | `/api/ingest` |

## Démarrage rapide

```bash
# 1. PostgreSQL local (Docker)
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=dashboard -p 5432:5432 postgres:16

# 2. Env + schéma
cp .env.example .env
npx prisma db push          # ou npm run db:migrate

# 3. Ingestion initiale (deux options)
npm run ingest              # CLI
curl -X POST localhost:3000/api/ingest   # ou via l'API

# 4. Lancer le dashboard
npm run dev                 # http://localhost:3000
```

## Routes API

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST`/`GET` | `/api/ingest?secret=xxx` | Ingestion complète (cron-safe, protégé par `INGEST_SECRET`) |
| `GET` | `/api/sources` | Santé des sources + dernier sync |
| `GET` | `/api/aggregated/economies?limit=10&groupBy=country\|region` | Économies agrégées |
| `GET` | `/api/aggregated/air-quality?period=7d\|30d\|90d\|all` | Séries AQI par ville |
| `GET` | `/api/dashboard?period=30d` | Payload combiné du dashboard (1 appel) |

Réponses normalisées : `{ ok, data, meta: { cached, fetchedAt } }`.

## Cache — 3 niveaux
1. **LRU in-process TTL 60 s** (`lib/cache.ts`) → évite les requêtes DB répétées.
2. **HTTP `Cache-Control: public, s-maxage=120, stale-while-revalidate=600`** (`lib/http.ts`) → cache CDN/edge.
3. **Snapshots en BDD** (`MetricSnapshot`) → le dashboard reste opérationnel même si une API tierce est en panne.

Invalidation automatique après chaque ingestion (`invalidateCache()`).

## Cron d'ingestion
- Vercel : copier `vercel.json.example` → `vercel.json` (sync quotidienne à 06:00 UTC).
- Ailleurs : GitHub Actions ou crontab appelant `POST /api/ingest` ou `npm run ingest`.

## Structure
```
app/                    # pages + routes API (App Router)
components/Dashboard.tsx# UI client (Recharts, filtre période)
lib/
  prisma.ts             # singleton PrismaClient
  cache.ts              # LRU TTL (niveau 1)
  http.ts               # Cache-Control helper (niveau 2)
  http-client.ts        # fetch + timeout + retry exponentiel
  ingest.ts             # orchestration ingestion + logs
  aggregations.ts       # requêtes agrégées typées
  period.ts             # périodes 7d/30d/90d/all (Zod)
  sources/              # clients par API externe
prisma/schema.prisma    # Source, MetricSnapshot, CountryEconomy, CityAirQuality, IngestLog
scripts/ingest.ts       # CLI npm run ingest
```

## Déploiement portfolio
- Vercel + Vercel Postgres (ou Neon) : `DATABASE_URL` + `INGEST_SECRET` en env vars, activer le cron.
- Le build (`npm run build`) passe sans BDD : la page gère l'absence de données.