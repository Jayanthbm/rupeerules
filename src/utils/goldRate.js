/**
 * Live gold rate utility for the Physical Gold row (Rule 8).
 *
 * Fetches ₹/gram rates from the gold-rate API which supports a `purity`
 * query param (24 | 22 | 18) and returns a plain-text number, e.g. "14826".
 *
 * Rates are cached in sessionStorage for 24h per purity so repeated UI
 * interactions (month switches, remounts) don't hammer the API.
 */

const GOLD_API_URL = "https://gold-rate-api.jayanthbharadwajm.workers.dev/api/gold";

export const GOLD_PURITIES = [24, 22, 18];
export const GOLD_RATE_TTL_MS = 24 * 60 * 60 * 1000;

/** Item fields that snapshot a successful gold valuation (persisted per month). */
export const GOLD_SNAPSHOT_FIELDS = ["grams", "purity", "ratePerGram", "rateAt"];

const CACHE_PREFIX = "mrc_gold_rate_v1_";

function cacheKey(purity) {
  return `${CACHE_PREFIX}${purity}`;
}

/** Read a cached rate entry, or null if missing/corrupt/older than maxAgeMs. */
export function readCachedGoldRate(purity, { maxAgeMs = GOLD_RATE_TTL_MS, now = Date.now() } = {}) {
  try {
    const raw = sessionStorage.getItem(cacheKey(purity));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ratePerGram = Number(parsed.ratePerGram);
    const rateAt = Number(parsed.rateAt);
    if (!Number.isFinite(ratePerGram) || ratePerGram <= 0 || !Number.isFinite(rateAt) || rateAt <= 0) {
      return null;
    }
    if (now - rateAt > maxAgeMs) return null;
    return { ratePerGram, rateAt };
  } catch {
    return null;
  }
}

function writeCachedGoldRate(purity, entry) {
  try {
    sessionStorage.setItem(cacheKey(purity), JSON.stringify(entry));
  } catch {
    /* storage full / private mode — cache is best-effort */
  }
}

/**
 * Fetch the current ₹/gram rate for a purity.
 * - `forceRefresh: true`  → always hits the API (explicit user action).
 * - `forceRefresh: false` → reuses the sessionStorage cache when <24h old.
 *
 * @returns {Promise<{ratePerGram: number, rateAt: number}>}
 * @throws {Error} on network failure or a non-numeric response.
 */
export async function fetchGoldRatePerGram(purity, { forceRefresh = false, now = Date.now() } = {}) {
  const p = Number(purity);
  if (!GOLD_PURITIES.includes(p)) {
    throw new Error(`Unsupported gold purity: ${purity}`);
  }

  if (!forceRefresh) {
    const cached = readCachedGoldRate(p, { now });
    if (cached) return cached;
  }

  const res = await fetch(`${GOLD_API_URL}?format=raw&purity=${p}`);
  if (!res.ok) {
    throw new Error(`Gold rate request failed (${res.status})`);
  }
  const text = (await res.text()).trim();
  const ratePerGram = Number(text);
  if (!Number.isFinite(ratePerGram) || ratePerGram <= 0) {
    throw new Error("Gold rate response was not a valid number");
  }

  const entry = { ratePerGram, rateAt: now };
  writeCachedGoldRate(p, entry);
  return entry;
}

/** Value of gold in ₹ (rounded to whole rupees). Returns 0 for invalid input. */
export function computeGoldValue(grams, ratePerGram) {
  const g = Number(grams);
  const r = Number(ratePerGram);
  if (!Number.isFinite(g) || g <= 0 || !Number.isFinite(r) || r <= 0) return 0;
  return Math.round(g * r);
}

/** True when a snapshot timestamp is missing or older than 24h. */
export function isGoldRateStale(rateAt, { now = Date.now() } = {}) {
  const at = Number(rateAt);
  if (!Number.isFinite(at) || at <= 0) return true;
  return now - at > GOLD_RATE_TTL_MS;
}

/** "12 Oct 2026" — for the rate "as of" / history lines. */
export function formatRateDate(rateAt) {
  const at = Number(rateAt);
  if (!Number.isFinite(at) || at <= 0) return "";
  return new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
