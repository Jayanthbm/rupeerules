import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  GOLD_PURITIES,
  GOLD_RATE_TTL_MS,
  computeGoldValue,
  isGoldRateStale,
  formatRateDate,
  readCachedGoldRate,
  fetchGoldRatePerGram,
} from "./goldRate";

function mockRateResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, text: async () => body };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("computeGoldValue", () => {
  it("multiplies grams by the rate and rounds to whole rupees", () => {
    expect(computeGoldValue(10, 13590)).toBe(135900);
    expect(computeGoldValue(0.5, 14826)).toBe(7413);
  });

  it("accepts numeric strings", () => {
    expect(computeGoldValue("12.5", "13590")).toBe(169875);
  });

  it("returns 0 for zero / negative / non-numeric input", () => {
    expect(computeGoldValue(0, 13590)).toBe(0);
    expect(computeGoldValue(-5, 13590)).toBe(0);
    expect(computeGoldValue(10, 0)).toBe(0);
    expect(computeGoldValue("", 13590)).toBe(0);
    expect(computeGoldValue("abc", 13590)).toBe(0);
    expect(computeGoldValue(10, null)).toBe(0);
  });
});

describe("isGoldRateStale", () => {
  const now = Date.now();

  it("treats a missing timestamp as stale", () => {
    expect(isGoldRateStale(undefined, { now })).toBe(true);
    expect(isGoldRateStale(0, { now })).toBe(true);
  });

  it("is fresh within 24h and stale after", () => {
    expect(isGoldRateStale(now - GOLD_RATE_TTL_MS + 60_000, { now })).toBe(false);
    expect(isGoldRateStale(now - GOLD_RATE_TTL_MS - 60_000, { now })).toBe(true);
  });
});

describe("formatRateDate", () => {
  it("formats a timestamp as '12 Oct 2026'", () => {
    const ts = new Date(2026, 9, 12).getTime();
    expect(formatRateDate(ts)).toBe("12 Oct 2026");
  });

  it("returns an empty string for invalid input", () => {
    expect(formatRateDate(undefined)).toBe("");
    expect(formatRateDate("nope")).toBe("");
  });
});

describe("fetchGoldRatePerGram", () => {
  it("fetches, parses, and caches the rate for the requested purity", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockRateResponse("14826"));
    vi.stubGlobal("fetch", fetchMock);

    const entry = await fetchGoldRatePerGram(24);

    expect(entry.ratePerGram).toBe(14826);
    expect(entry.rateAt).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("purity=24");
    expect(readCachedGoldRate(24)).toEqual(entry);
  });

  it("reuses the sessionStorage cache instead of re-fetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockRateResponse("13590"));
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchGoldRatePerGram(22);
    const second = await fetchGoldRatePerGram(22);

    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bypasses the cache when forceRefresh is true", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockRateResponse("13590"))
      .mockResolvedValueOnce(mockRateResponse("13650"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchGoldRatePerGram(22);
    const refreshed = await fetchGoldRatePerGram(22, { forceRefresh: true });

    expect(refreshed.ratePerGram).toBe(13650);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("re-fetches when the cached rate is older than 24h", async () => {
    const staleAt = Date.now() - GOLD_RATE_TTL_MS - 1000;
    sessionStorage.setItem("mrc_gold_rate_v1_18", JSON.stringify({ ratePerGram: 11000, rateAt: staleAt }));
    const fetchMock = vi.fn().mockResolvedValue(mockRateResponse("11120"));
    vi.stubGlobal("fetch", fetchMock);

    const entry = await fetchGoldRatePerGram(18);

    expect(entry.ratePerGram).toBe(11120);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches each purity separately", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockRateResponse("14826"))
      .mockResolvedValueOnce(mockRateResponse("13590"));
    vi.stubGlobal("fetch", fetchMock);

    const r24 = await fetchGoldRatePerGram(24);
    const r22 = await fetchGoldRatePerGram(22);

    expect(r24.ratePerGram).toBe(14826);
    expect(r22.ratePerGram).toBe(13590);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported purities without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGoldRatePerGram(20)).rejects.toThrow(/Unsupported gold purity/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on a non-numeric response and does not cache it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockRateResponse("<html>blocked</html>")));

    await expect(fetchGoldRatePerGram(24)).rejects.toThrow(/not a valid number/);
    expect(readCachedGoldRate(24)).toBeNull();
  });

  it("throws on an HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockRateResponse("nope", { ok: false, status: 500 })));

    await expect(fetchGoldRatePerGram(24)).rejects.toThrow(/500/);
  });

  it("propagates network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(fetchGoldRatePerGram(24)).rejects.toThrow("offline");
  });

  it("exposes the purity options the UI offers", () => {
    expect(GOLD_PURITIES).toEqual([24, 22, 18]);
  });
});
