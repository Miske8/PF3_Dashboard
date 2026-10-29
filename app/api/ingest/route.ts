import { NextRequest } from "next/server";
import { runIngestion } from "@/lib/ingest";
import { cachedJson, errorJson } from "@/lib/http";

/**
 * POST/GET /api/ingest — déclenche l'ingestion des APIs externes vers PostgreSQL.
 * Protégé par INGEST_SECRET si défini (query `?secret=` ou header x-ingest-secret).
 * Conçu pour être appelé par un cron (Vercel Cron / GitHub Actions).
 */
async function handle(req: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (secret) {
    const provided = req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-ingest-secret");
    if (provided !== secret) return errorJson("Unauthorized", 401);
  }
  try {
    const results = await runIngestion();
    const ok = results.every((r) => r.status === "ok");
    return cachedJson({ ok, data: results }, { sMaxAge: 0 });
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : "Ingest failed", 500);
  }
}

export const POST = handle;
export const GET = handle;
