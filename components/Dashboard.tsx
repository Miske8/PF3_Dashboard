"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { Period } from "@/lib/period";

export interface DashboardData {
  topCountries: { code: string; name: string; region: string | null; population: number; area: number; gdpGrowth: number | null }[];
  populationByRegion: { region: string; population: number; countries: number }[];
  airSeries: Record<string, string | number>[];
  airLatest: { city: string; aqi: number }[];
  sources: { key: string; name: string; lastSyncAt: string | null; lastStatus: string; lastRecords: number }[];
}

const PERIODS: Period[] = ["7d", "30d", "90d", "all"];
const CITIES = ["Paris", "New York", "Tokyo", "Delhi", "São Paulo"];
const LINE_COLORS: Record<string, string> = {
  Paris: "#60a5fa",
  "New York": "#34d399",
  Tokyo: "#f472b6",
  Delhi: "#fbbf24",
  "São Paulo": "#a78bfa"
};
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316"];

const fmt = (n: number) =>
  n >= 1e9 ? (n / 1e9).toFixed(2) + " Md" : n >= 1e6 ? (n / 1e6).toFixed(1) + " M" : n.toLocaleString("fr-FR");

export default function Dashboard({ initial }: { initial: DashboardData }) {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<DashboardData>(initial);
  const [loading, setLoading] = useState(false);

  // Rechargement via l'API agrégée quand la période change (démontre cache + filtre)
  async function changePeriod(p: Period) {
    setPeriod(p);
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?period=${p}`);
      const json = await res.json();
      if (json.ok) setData(json.data);
    } finally {
      setLoading(false);
    }
  }

  const totalPop = useMemo(() => data.topCountries.reduce((s, c) => s + c.population, 0), [data]);
  const avgAqi = useMemo(() => {
    const v = data.airLatest.map((c) => c.aqi);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
  }, [data]);

  const pieData = data.populationByRegion.slice(0, 6).map((r) => ({ name: r.region, value: r.population }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">📊 Data Aggregator Dashboard</h1>
          <p className="text-sm text-slate-400">REST Countries · Open-Meteo · World Bank — stockées via Prisma/PostgreSQL</p>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => changePeriod(p)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                period === p
                  ? "border-brand-500 bg-brand-600 text-white"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
              }`}
            >
              {p === "all" ? "Tout" : p}
            </button>
          ))}
          {loading && <span className="animate-pulse text-xs text-slate-400">chargement…</span>}
        </div>
      </header>

      {/* KPI cards */}
      <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Population (top 10)</p>
          <p className="mt-1 text-2xl font-semibold">{fmt(totalPop)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">AQI moyen villes</p>
          <p className="mt-1 text-2xl font-semibold">{avgAqi}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Pays stockés</p>
          <p className="mt-1 text-2xl font-semibold">{data.topCountries.length}+</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Sources actives</p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {data.sources.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${s.lastStatus === "ok" ? "bg-emerald-400" : "bg-red-400"}`} />
                {s.name}
              </li>
            ))}
            {data.sources.length === 0 && <li className="text-slate-500">Aucune sync — lancez /api/ingest</li>}
          </ul>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* AQI temps réel par ville, filtré par période */}
        <div className="card lg:col-span-2">
          <h2 className="mb-3 font-medium">Qualité de l&apos;air (AQI US) — période : {period}</h2>
          {data.airSeries.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Pas de données — exécutez POST /api/ingest.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.airSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                <Legend />
                {CITIES.map((city) => (
                  <Area
                    key={city}
                    type="monotone"
                    dataKey={city}
                    stroke={LINE_COLORS[city]}
                    fill={LINE_COLORS[city]}
                    fillOpacity={0.15}
                    connectNulls
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top pays par population */}
        <div className="card">
          <h2 className="mb-3 font-medium">Top 10 pays — population</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.topCountries} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" tickFormatter={(v) => fmt(v)} stroke="#64748b" fontSize={12} />
              <YAxis type="category" dataKey="name" width={90} stroke="#64748b" fontSize={12} />
              <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Bar dataKey="population" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Population par région */}
        <div className="card">
          <h2 className="mb-3 font-medium">Population par région</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-500">
        Données ingérées depuis des APIs publiques · cache TTL 60 s côté serveur · Cache-Control CDN 120 s ·{" "}
        <a className="underline" href="/api/sources">
          /api/sources
        </a>
      </footer>
    </main>
  );
}
