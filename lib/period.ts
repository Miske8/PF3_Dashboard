import { z } from "zod";

/** Périodes supportées par le dashboard et le filtre UI. */
export const periodSchema = z.enum(["7d", "30d", "90d", "all"]).default("30d");
export type Period = z.infer<typeof periodSchema>;

/** Convertit une période en date de début (null = tout l'historique). */
export function periodToSince(period: Period): Date | null {
  const now = Date.now();
  switch (period) {
    case "7d":
      return new Date(now - 7 * 86_400_000);
    case "30d":
      return new Date(now - 30 * 86_400_000);
    case "90d":
      return new Date(now - 90 * 86_400_000);
    case "all":
      return null;
  }
}

/** Parse la querystring `?period=` avec fallback sûr. */
export function parsePeriod(value: string | null | undefined): Period {
  const parsed = periodSchema.safeParse(value ?? "30d");
  return parsed.success ? parsed.data : "30d";
}
