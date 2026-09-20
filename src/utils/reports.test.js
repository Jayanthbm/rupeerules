import { describe, it, expect } from "vitest";
import { computeReportsData } from "./reports";

function month(salary, actuals) {
  return { salary, actuals, updatedAt: Date.now() };
}

describe("computeReportsData", () => {
  it("returns an empty report for missing months", () => {
    expect(computeReportsData(null).monthlyBreakdowns).toEqual([]);
    expect(computeReportsData(undefined).activeMonthCount).toBe(0);
    const empty = computeReportsData({});
    expect(empty.monthlyBreakdowns).toEqual([]);
    expect(empty.avgSavingsRate).toBe(0);
  });

  it("aggregates a month's spending, targets and savings rate", () => {
    const report = computeReportsData({
      "2026-09": month(100000, { 1: 50000, 2: 5000, 3: 10000, 4: 15000, 5: 15000 }),
    });
    expect(report.activeMonthCount).toBe(1);
    const row = report.monthlyBreakdowns[0];
    expect(row.salary).toBe(100000);
    expect(row.essentials).toBe(50000);
    expect(row.totalSpending).toBe(95000);
    expect(row.diff).toBe(5000);
    expect(row.savingsRate).toBe(30); // (15000+15000)/100000
    expect(row.targetEssentials).toBeCloseTo(55000, 6);
    expect(row.targetMaxEmi).toBe(40000);
  });

  it("uses salary-based benchmarks until enough months are recorded", () => {
    const report = computeReportsData({
      "2026-01": month(100000, { 1: 50000, 6: 20000 }),
      "2026-02": month(100000, { 1: 52000, 6: 20000 }),
    });
    expect(report.hasEmergencyAvg).toBe(false);
    expect(report.hasFireAvg).toBe(false);
    const row = report.monthlyBreakdowns[0];
    expect(row.targetEmergency).toBe(600000); // 6 × salary
    expect(row.targetFire).toBe(12000000); // 120 × salary
    expect(row.emergencySource).toContain("6× Monthly Salary");
  });

  it("switches to adaptive expense-based benchmarks after 3 months", () => {
    const report = computeReportsData({
      "2026-01": month(100000, { 1: 50000, 6: 20000 }),
      "2026-02": month(100000, { 1: 52000, 6: 20000 }),
      "2026-03": month(100000, { 1: 54000, 6: 20000 }),
    });
    expect(report.hasEmergencyAvg).toBe(true);
    expect(report.hasFireAvg).toBe(false); // needs 6 months
    // avg non-negotiables = (70000 + 72000 + 74000)/3 = 72000
    expect(report.avgEmergencyExpense).toBe(72000);
    const row = report.monthlyBreakdowns[0];
    expect(row.targetEmergency).toBe(432000); // 72000 × 6
    expect(row.emergencySource).toContain("Avg Essentials+EMI");
  });

  it("unlocks the 25× living-expenses FIRE target after 6 months", () => {
    const months = {};
    for (let i = 1; i <= 6; i++) {
      const key = `2026-0${i}`;
      months[key] = month(100000, { 1: 50000, 2: 5000, 6: 20000 });
    }
    const report = computeReportsData(months);
    expect(report.hasFireAvg).toBe(true);
    // avg living expenses = (50000 + 5000 + 20000) = 75000
    expect(report.avgLivingExpense).toBe(75000);
    const row = report.monthlyBreakdowns[0];
    expect(row.targetFire).toBe(75000 * 12 * 25);
    expect(row.fireSource).toContain("25× Annual Expenses");
  });

  it("ignores months without salary in the averages", () => {
    const report = computeReportsData({
      "2026-01": month(100000, { 1: 50000 }),
      "2026-02": month(0, { 1: 999999 }),
    });
    expect(report.activeMonthCount).toBe(1);
    expect(report.totalTrackedSpending).toBe(50000);
  });
});
