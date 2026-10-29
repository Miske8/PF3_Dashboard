import { describe, expect, it, vi } from "vitest";
import { withCache, invalidateCache } from "@/lib/cache";

describe("withCache (LRU + TTL)", () => {
  it("ne calcule qu'une fois et sert la valeur cachée ensuite", async () => {
    const key = `test:simple:${vi.fn.name}`;
    const fn = vi.fn(async () => ({ value: 42 }));

    const first = await withCache(key, fn);
    expect(first.cached).toBe(false);
    expect(first.data.value).toBe(42);

    const second = await withCache(key, fn);
    expect(second.cached).toBe(true);
    expect(second.data.value).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);

    invalidateCache(key);
  });

  it("expire après le TTL", async () => {
    vi.useFakeTimers();
    try {
      const key = "test:ttl";
      const fn = vi.fn(async () => ({ n: Math.random() }));

      await withCache(key, fn, 1_000);
      vi.advanceTimersByTime(1_500);
      const after = await withCache(key, fn, 1_000);
      expect(after.cached).toBe(false);
      expect(fn).toHaveBeenCalledTimes(2);

      invalidateCache(key);
    } finally {
      vi.useRealTimers();
    }
  });

  it("invalidateCache() sans argument purge tout", async () => {
    const fn = vi.fn(async () => ({ v: 1 }));
    await withCache("test:a", fn);
    await withCache("test:b", fn);
    invalidateCache();
    const res = await withCache("test:a", fn);
    expect(res.cached).toBe(false);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
