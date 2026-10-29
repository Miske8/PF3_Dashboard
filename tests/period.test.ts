import { describe, expect, it } from "vitest";
import { parsePeriod, periodToSince, type Period } from "@/lib/period";

describe("parsePeriod", () => {
  it("accepte les périodes valides", () => {
    for (const p of ["7d", "30d", "90d", "all"] as Period[]) {
      expect(parsePeriod(p)).toBe(p);
    }
  });

  it("retombe sur 30d pour une valeur invalide ou absente", () => {
    expect(parsePeriod("banane")).toBe("30d");
    expect(parsePeriod(null)).toBe("30d");
    expect(parsePeriod(undefined)).toBe("30d");
    expect(parsePeriod("")).toBe("30d");
  });
});

describe("periodToSince", () => {
  it("renvoie null pour 'all' (tout l'historique)", () => {
    expect(periodToSince("all")).toBeNull();
  });

  it("calcule la bonne borne temporelle", () => {
    const before = Date.now();
    const since = periodToSince("7d")!.getTime();
    const expected = before - 7 * 86_400_000;
    // tolérance 1s (horloge)
    expect(Math.abs(since - expected)).toBeLessThan(1_000);
  });

  it("ordonne correctement les bornes 7d > 30d > 90d", () => {
    const d7 = periodToSince("7d")!.getTime();
    const d30 = periodToSince("30d")!.getTime();
    const d90 = periodToSince("90d")!.getTime();
    expect(d7).toBeGreaterThan(d30);
    expect(d30).toBeGreaterThan(d90);
  });
});
