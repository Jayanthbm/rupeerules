import { describe, it, expect } from "vitest";
import {
  computeEmi,
  computeEmiCost,
  defaultEmiMonths,
  evaluatePurchase,
  evaluatePaymentPlan,
  monthsToAfford,
  recommendedDownPayment,
} from "./canIBuy";

describe("computeEmi", () => {
  it("splits principal equally for a 0% (no-cost) EMI", () => {
    expect(computeEmi(120000, 0, 12)).toBe(10000);
  });

  it("charges more than the interest-free split when rate > 0", () => {
    expect(computeEmi(120000, 0.12, 12)).toBeGreaterThan(10000);
  });

  it("returns 0 for invalid inputs", () => {
    expect(computeEmi(0, 0.12, 12)).toBe(0);
    expect(computeEmi(-1, 0.12, 12)).toBe(0);
    expect(computeEmi(50000, 0.12, 0)).toBe(0);
  });

  it("EMI shrinks as tenure grows", () => {
    expect(computeEmi(300000, 0.12, 24)).toBeLessThan(computeEmi(300000, 0.12, 12));
  });
});

describe("computeEmiCost", () => {
  it("computes total and interest consistently", () => {
    const { emi, total, interest } = computeEmiCost(120000, 0.12, 12);
    expect(total).toBe(emi * 12);
    expect(total).toBeGreaterThan(120000);
    expect(interest).toBe(total - 120000);
  });

  it("has zero interest for no-cost EMI", () => {
    const { emi, total, interest } = computeEmiCost(120000, 0, 12);
    expect(emi).toBe(10000);
    expect(total).toBe(120000);
    expect(interest).toBe(0);
  });

  it("returns zeros for invalid principal", () => {
    expect(computeEmiCost(0, 0.12, 12)).toEqual({ emi: 0, total: 0, interest: 0 });
  });
});

describe("defaultEmiMonths", () => {
  it("scales tenure with price", () => {
    expect(defaultEmiMonths(0)).toBe(6);
    expect(defaultEmiMonths(20000)).toBe(6);
    expect(defaultEmiMonths(60000)).toBe(12);
    expect(defaultEmiMonths(400000)).toBe(24);
    expect(defaultEmiMonths(800000)).toBe(36);
  });
});

describe("evaluatePurchase", () => {
  const healthy = {
    price: 50000,
    salary: 100000,
    essentialsActual: 40000,
    maxEmiActual: 10000,
    emergencyFundActual: 600000,
    emergencyFundTarget: 600000,
  };

  it("returns 'empty' for zero price", () => {
    const d = evaluatePurchase({ ...healthy, price: 0 });
    expect(d.verdict).toBe("empty");
    expect(d.score).toBeNull();
  });

  it("returns 'no-salary' when salary is missing", () => {
    const d = evaluatePurchase({ ...healthy, salary: 0 });
    expect(d.verdict).toBe("no-salary");
  });

  it("green-lights an affordable purchase with full emergency fund", () => {
    const d = evaluatePurchase(healthy);
    expect(d.verdict).toBe("buy-now");
    expect(d.score).toBeGreaterThanOrEqual(70);
    expect(d.monthlyFreeCash).toBe(50000);
  });

  it("rejects an unaffordable purchase", () => {
    const d = evaluatePurchase({
      price: 400000,
      salary: 50000,
      essentialsActual: 45000,
      maxEmiActual: 20000,
      emergencyFundActual: 0,
      emergencyFundTarget: 300000,
    });
    expect(d.verdict).toBe("do-not-buy");
    expect(d.score).toBeLessThan(45);
  });

  it("suggests waiting for a mid-range purchase", () => {
    const d = evaluatePurchase({
      price: 240000,
      salary: 100000,
      essentialsActual: 70000,
      maxEmiActual: 0,
      emergencyFundActual: 300000,
      emergencyFundTarget: 600000,
    });
    expect(d.verdict).toBe("buy-later");
    expect(d.score).toBeGreaterThanOrEqual(45);
    expect(d.score).toBeLessThan(70);
  });
});

describe("evaluatePaymentPlan", () => {
  it("asks for savings when the verdict is buy-later", () => {
    const plan = evaluatePaymentPlan({
      price: 240000,
      verdict: "buy-later",
      salary: 100000,
      monthlyFreeCash: 30000,
      months: 12,
    });
    expect(plan.feasible).toBe(false);
    expect(plan.message).toContain("8 more months");
  });

  it("blocks EMI plans on a do-not-buy verdict", () => {
    const plan = evaluatePaymentPlan({
      price: 400000,
      verdict: "do-not-buy",
      salary: 50000,
      monthlyFreeCash: 0,
      months: 12,
    });
    expect(plan.feasible).toBe(false);
    expect(plan.message).toContain("emergency fund");
  });

  it("approves a feasible EMI plan", () => {
    const plan = evaluatePaymentPlan({
      price: 50000,
      verdict: "buy-now",
      salary: 100000,
      monthlyFreeCash: 50000,
      months: 12,
      rate: 0.12,
    });
    expect(plan.feasible).toBe(true);
    expect(plan.emi).toBe(computeEmi(50000, 0.12, 12));
    expect(plan.interest).toBeGreaterThan(0);
  });

  it("rejects an EMI that exceeds free cash flow", () => {
    const plan = evaluatePaymentPlan({
      price: 50000,
      verdict: "buy-now",
      salary: 100000,
      monthlyFreeCash: 3000,
      months: 6,
      rate: 0.12,
    });
    expect(plan.feasible).toBe(false);
    expect(plan.message).toContain("longer tenure");
  });

  it("handles no-cost EMI cleanly", () => {
    const plan = evaluatePaymentPlan({
      price: 60000,
      verdict: "buy-now",
      salary: 100000,
      monthlyFreeCash: 50000,
      months: 12,
      rate: 0,
    });
    expect(plan.feasible).toBe(true);
    expect(plan.emi).toBe(5000);
    expect(plan.interest).toBe(0);
  });
});

describe("monthsToAfford", () => {
  it("rounds up partial months", () => {
    expect(monthsToAfford(300000, 30000)).toBe(10);
    expect(monthsToAfford(10000, 30000)).toBe(1);
  });

  it("returns null with no cash flow and 0 for no price", () => {
    expect(monthsToAfford(50000, 0)).toBeNull();
    expect(monthsToAfford(0, 50000)).toBe(0);
  });
});

describe("recommendedDownPayment", () => {
  it("rounds to whole hundreds", () => {
    expect(recommendedDownPayment(50000)).toBe(5000);
    expect(recommendedDownPayment(55555)).toBe(5600);
    expect(recommendedDownPayment(0)).toBe(0);
  });
});
