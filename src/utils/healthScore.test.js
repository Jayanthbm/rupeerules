import { describe, it, expect } from "vitest";
import { calculateHealthScore, getHealthStatus } from "./healthScore";

function rule(id, actualRaw, actual, recommended, status = "on-target") {
  return { id, actualRaw, actual, recommended, status };
}

describe("calculateHealthScore", () => {
  it("returns 0 for empty input", () => {
    expect(calculateHealthScore([])).toBe(0);
    expect(calculateHealthScore(null)).toBe(0);
  });

  it("skips rules without an entered actual", () => {
    const score = calculateHealthScore([rule(1, "", 0, 55000)]);
    expect(score).toBe(0);
  });

  it("scores a fully on-target month at 100", () => {
    const rules = [
      rule(1, "50000", 50000, 55000),
      rule(2, "5000", 5000, 5000),
      rule(3, "10000", 10000, 10000),
      rule(4, "15000", 15000, 15000),
      rule(5, "15000", 15000, 15000),
      rule(6, "20000", 20000, 40000),
      rule(7, "600000", 600000, 600000),
      rule(8, "4800000", 4800000, 4800000),
    ];
    expect(calculateHealthScore(rules)).toBe(100);
  });

  it("penalizes going over a ceiling rule (essentials)", () => {
    const score = calculateHealthScore([rule(1, "110000", 110000, 55000)]);
    expect(score).toBe(0); // 100% over the cap → 100 − 200 = 0
  });

  it("partial partial-progress on corpus rules scores proportionally", () => {
    const score = calculateHealthScore([rule(8, "1200000", 1200000, 4800000)]);
    expect(score).toBe(25);
  });

  it("rewards staying under EMI ceiling", () => {
    const score = calculateHealthScore([rule(6, "10000", 10000, 40000)]);
    expect(score).toBe(100);
  });

  it("penalizes overspending guilt-free money mildly", () => {
    const score = calculateHealthScore([rule(2, "6000", 6000, 5000)]);
    expect(score).toBe(80);
  });
});

describe("getHealthStatus", () => {
  it("maps score bands to labels and colors", () => {
    expect(getHealthStatus(95).label).toBe("Excellent");
    expect(getHealthStatus(80).label).toBe("Good");
    expect(getHealthStatus(60).label).toBe("Fair");
    expect(getHealthStatus(30).label).toBe("Needs work");
    expect(getHealthStatus(10).label).toBe("Starting out");
  });

  it("labels are mutually exclusive at boundaries", () => {
    expect(getHealthStatus(90).label).toBe("Excellent");
    expect(getHealthStatus(89).label).toBe("Good");
    expect(getHealthStatus(75).label).toBe("Good");
    expect(getHealthStatus(74).label).toBe("Fair");
  });
});
