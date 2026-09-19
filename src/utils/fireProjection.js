/**
 * FIRE corpus projection using compound growth with recurring monthly contributions.
 * Pure math — no React, no storage.
 */

/**
 * Months of compound growth needed for a portfolio to reach a target.
 *
 * Future value after n months at monthly rate r:
 *   FV(n) = P·(1+r)^n + m·((1+r)^n − 1)/r
 * Solving FV(n) = T for (1+r)^n gives n = ln((T·r + m) / (P·r + m)) / ln(1+r).
 *
 * @param {object} params
 * @param {number} params.target            FIRE corpus target (₹)
 * @param {number} params.corpus            Current invested corpus (₹)
 * @param {number} params.monthlyInvestment Monthly contribution (₹)
 * @param {number} [params.annualReturn]    Expected annual return (default 12% CAGR)
 * @returns {number|null} months to reach target; 0 if already there; null if unreachable (no contributions)
 */
export function projectFireMonths({ target, corpus, monthlyInvestment, annualReturn = 0.12 }) {
  const T = Number(target) || 0;
  const P = Math.max(Number(corpus) || 0, 0);
  const m = Math.max(Number(monthlyInvestment) || 0, 0);

  if (T <= 0) return null;
  if (P >= T) return 0;
  if (m <= 0) return null;

  const r = annualReturn / 12;
  if (r <= 0) {
    return Math.ceil((T - P) / m);
  }

  const numerator = T * r + m;
  const denominator = P * r + m;
  if (denominator <= 0) return null;

  const n = Math.log(numerator / denominator) / Math.log(1 + r);
  return Number.isFinite(n) ? Math.max(1, Math.ceil(n)) : null;
}

/** Human-friendly "X years" label (one decimal below 10 years, whole above). */
export function formatFireYears(months) {
  if (months === null || months === undefined) return null;
  if (months <= 0) return "0 months";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = months / 12;
  const label = years < 10 ? (Math.round(years * 10) / 10).toString() : Math.round(years).toString();
  return `~${label} year${years >= 10 || years <= 1 ? (years >= 10 ? "s" : "") : "s"}`;
}
