/**
 * Utility to process multi-month raw data into aggregated reports format
 */
export function computeReportsData(months) {
  if (!months || typeof months !== "object") {
    return {
      monthlyBreakdowns: [],
      totalTrackedSpending: 0,
      avgSavingsRate: 0,
      activeMonthCount: 0,
    };
  }

  const monthKeys = Object.keys(months).sort();
  let trackedSalary = 0;
  let trackedSpending = 0;
  let trackedInvested = 0;
  let monthCount = 0;

  const list = monthKeys.map((key) => {
    const data = months[key] || {};
    const sal = data.salary || 0;
    const act = data.actuals || {};

    const essentials = Number(act[1]) || 0;
    const guiltFree = Number(act[2]) || 0;
    const debt = Number(act[3]) || 0;
    const goals = Number(act[4]) || 0;
    const wealth = Number(act[5]) || 0;

    // Wealth / Obligations actuals
    const maxEmi = Number(act[6]) || 0;
    const emergencyFund = Number(act[7]) || 0;
    const fireCorpus = Number(act[8]) || 0;

    const totalSpending = essentials + guiltFree + debt + goals + wealth;
    const livingExpenses = essentials + guiltFree + maxEmi; // actual living costs
    const nonNegotiableCosts = essentials + maxEmi; // survival costs for emergency

    if (sal > 0) {
      trackedSalary += sal;
      trackedSpending += totalSpending;
      trackedInvested += (wealth + goals);
      monthCount++;
    }

    const savingsRate = sal > 0 ? Math.round(((goals + wealth) / sal) * 100) : 0;

    return {
      monthKey: key,
      salary: sal,
      essentials,
      guiltFree,
      debt,
      goals,
      wealth,
      maxEmi,
      emergencyFund,
      fireCorpus,
      livingExpenses,
      nonNegotiableCosts,
      targetEssentials: sal * 0.55,
      targetGuiltFree: sal * 0.05,
      targetDebt: sal * 0.10,
      targetGoals: sal * 0.15,
      targetWealth: sal * 0.15,
      targetMaxEmi: sal * 0.4,
      totalSpending,
      savingsRate,
      diff: sal - totalSpending,
    };
  });

  // Calculate rolling/history averages for months with actual data entered
  const monthsWithEssentials = list.filter((r) => r.essentials > 0 || r.salary > 0);
  const recordedCount = monthsWithEssentials.length;

  // Emergency Fund Benchmark:
  // If >= 3 months recorded: Average non-negotiable expenses (Essentials + EMIs) * 6
  // Otherwise: Salary * 6 fallback
  const hasEmergencyAvg = recordedCount >= 3;
  const avgEmergencyExpense = hasEmergencyAvg
    ? Math.round(
        monthsWithEssentials.reduce((acc, r) => acc + (r.nonNegotiableCosts > 0 ? r.nonNegotiableCosts : r.salary * 0.55), 0) /
          recordedCount
      )
    : 0;

  // FIRE Number Benchmark:
  // If >= 6 months recorded: 25x Annual Living Expenses (Avg Monthly Living Expenses * 12 * 25)
  // Otherwise: Salary * 120 (10x Annual Salary milestone fallback)
  const hasFireAvg = recordedCount >= 6;
  const avgLivingExpense = hasFireAvg
    ? Math.round(
        monthsWithEssentials.reduce((acc, r) => acc + (r.livingExpenses > 0 ? r.livingExpenses : r.salary * 0.60), 0) /
          recordedCount
      )
    : 0;

  // Enhance rows with dynamic/adaptive benchmarks & source metadata
  const listWithTargets = list.map((r) => {
    const targetEmergency = hasEmergencyAvg
      ? avgEmergencyExpense * 6
      : (r.salary > 0 ? r.salary * 6 : 0);

    const targetFire = hasFireAvg
      ? avgLivingExpense * 12 * 25
      : (r.salary > 0 ? r.salary * 120 : 0);

    return {
      ...r,
      targetEmergency,
      targetFire,
      emergencySource: hasEmergencyAvg ? `6× Avg Essentials+EMI (₹${avgEmergencyExpense.toLocaleString("en-IN")}/mo)` : "6× Monthly Salary",
      fireSource: hasFireAvg ? `25× Annual Expenses (₹${avgLivingExpense.toLocaleString("en-IN")}/mo)` : "120× Monthly Salary (10× Annual)",
      isEmergencyAdaptive: hasEmergencyAvg,
      isFireAdaptive: hasFireAvg,
    };
  });

  const averageRate = monthCount > 0 && trackedSalary > 0
    ? Math.round((trackedInvested / trackedSalary) * 100)
    : 0;

  return {
    monthlyBreakdowns: listWithTargets,
    totalTrackedSpending: trackedSpending,
    avgSavingsRate: averageRate,
    activeMonthCount: monthCount,
    hasEmergencyAvg,
    hasFireAvg,
    avgEmergencyExpense,
    avgLivingExpense,
  };
}

