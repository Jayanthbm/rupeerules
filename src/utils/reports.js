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
      targetEssentials: sal * 0.55,
      targetGuiltFree: sal * 0.05,
      targetDebt: sal * 0.10,
      targetGoals: sal * 0.15,
      targetWealth: sal * 0.15,
      targetMaxEmi: sal * 0.4,
      targetEmergency: sal * 6,
      targetFire: sal * 120,
      totalSpending,
      savingsRate,
      diff: sal - totalSpending,
    };
  });

  const averageRate = monthCount > 0 && trackedSalary > 0
    ? Math.round((trackedInvested / trackedSalary) * 100)
    : 0;

  return {
    monthlyBreakdowns: list,
    totalTrackedSpending: trackedSpending,
    avgSavingsRate: averageRate,
    activeMonthCount: monthCount,
  };
}
