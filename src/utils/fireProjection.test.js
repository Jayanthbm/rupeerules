import { describe, it, expect } from "vitest";
import { projectFireMonths, formatFireYears } from "./fireProjection";

describe("projectFireMonths", () => {
  it("returns 0 when the target is already reached", () => {
    expect(projectFireMonths({ target: 1000000, corpus: 1500000, monthlyInvestment: 10000 })).toBe(0);
  });

  it("returns null when there is no corpus and no contributions", () => {
    expect(projectFireMonths({ target: 1000000, corpus: 0, monthlyInvestment: 0 })).toBeNull();
  });

  it("solves simple no-growth arithmetic", () => {
    expect(projectFireMonths({ target: 1200000, corpus: 0, monthlyInvestment: 10000, annualReturn: 0 })).toBe(120);
  });

  it("at 12% CAGR, ₹18k/mo from zero reaches ~₹4.8cr in roughly two decades", () => {
    const months = projectFireMonths({ target: 48000000, corpus: 0, monthlyInvestment: 18000 });
    // Sanity window rather than exact value — compounding math is well-established.
    expect(months).toBeGreaterThan(200);
    expect(months).toBeLessThan(340);
  });

  it("a larger corpus shortens the projection", () => {
    const fromZero = projectFireMonths({ target: 10000000, corpus: 0, monthlyInvestment: 20000 });
    const withCorpus = projectFireMonths({ target: 10000000, corpus: 3000000, monthlyInvestment: 20000 });
    expect(withCorpus).toBeLessThan(fromZero);
  });

  it("a larger contribution shortens the projection", () => {
    const slow = projectFireMonths({ target: 10000000, corpus: 0, monthlyInvestment: 10000 });
    const fast = projectFireMonths({ target: 10000000, corpus: 0, monthlyInvestment: 30000 });
    expect(fast).toBeLessThan(slow);
  });

  it("returns null when target is zero", () => {
    expect(projectFireMonths({ target: 0, corpus: 0, monthlyInvestment: 10000 })).toBeNull();
  });
});

describe("formatFireYears", () => {
  it("formats sub-year values in months", () => {
    expect(formatFireYears(6)).toBe("6 months");
    expect(formatFireYears(1)).toBe("1 month");
  });

  it("formats years with one decimal below ten years", () => {
    expect(formatFireYears(18)).toBe("~1.5 years");
    expect(formatFireYears(90)).toBe("~7.5 years");
  });

  it("rounds to whole years at ten or more", () => {
    expect(formatFireYears(240)).toBe("~20 years");
  });

  it("handles zero and null", () => {
    expect(formatFireYears(0)).toBe("0 months");
    expect(formatFireYears(null)).toBeNull();
  });
});
