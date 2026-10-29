import { NextResponse } from "next/server";

/**
 * Niveau 2 du cache : en-têtes HTTP pour CDN/proxy.
 * public + s-maxage → caché au edge ; stale-while-revalidate → sert l'ancien
 * pendant que le nouveau se régénère en arrière-plan.
 */
export function cachedJson(
  body: unknown,
  opts: { sMaxAge?: number; staleWhileRevalidate?: number; init?: ResponseInit } = {}
) {
  const { sMaxAge = 60, staleWhileRevalidate = 300 } = opts;
  const headers = new Headers(opts.init?.headers);
  headers.set(
    "Cache-Control",
    `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`
  );
  return NextResponse.json(body, { ...opts.init, headers });
}

/** Réponse d'erreur normalisée. */
export function errorJson(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
