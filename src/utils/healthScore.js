/** Calculate an overall financial health score (0-100) based on how well
 *  the user is following their money rules and staying within total monthly salary budget. */
export function calculateHealthScore(rules) {
  if (!rules || rules.length === 0) return 0;

  let totalScore = 0;
  let count = 0;

  // Calculate total monthly salary (derived from any rule's recommended amount)
  // Essential rule (id: 1) recommended = 0.55 * salary
  const essentialRule = rules.find((r) => r.id === 1);
  const salary = essentialRule && essentialRule.recommended > 0 ? essentialRule.recommended / 0.55 : 0;

  // Calculate total monthly spending across rules 1 to 5 (Monthly Outflows)
  let totalMonthlyOutflow = 0;
  for (const r of rules) {
    if (r.id >= 1 && r.id <= 5 && r.actual && typeof r.actual === "number") {
      totalMonthlyOutflow += r.actual;
    }
  }

  for (const rule of rules) {
    if (rule.actualRaw === "" || rule.actualRaw === undefined || rule.actualRaw === null) {
      continue;
    }

    const recommended = rule.recommended;
    const actual = rule.actual;

    if (recommended === 0 && rule.id !== 2) continue;

    let ruleScore;

    if (rule.id === 1) {
      // Essential expenses - max ceiling
      if (actual <= recommended) {
        ruleScore = 100;
      } else {
        const overPercent = ((actual - recommended) / recommended) * 100;
        ruleScore = Math.max(0, 100 - overPercent * 2.5);
      }
    } else if (rule.id === 2) {
      // Guilt-free money - ceiling rule with progressive penalty
      if (actual > 0 && actual <= recommended) {
        ruleScore = 100;
      } else if (actual > recommended) {
        const overPercent = recommended > 0 ? ((actual - recommended) / recommended) * 100 : 50;
        ruleScore = Math.max(0, 100 - overPercent * 2);
      } else {
        ruleScore = 50;
      }
    } else if (rule.id === 3 || rule.id === 5) {
      // Debt / Long-term investing rules - should meet or exceed target
      if (actual >= recommended) {
        ruleScore = 100;
      } else {
        ruleScore = Math.round((actual / recommended) * 100);
      }
    } else if (rule.id === 4) {
      // Short-term savings
      if (actual >= recommended) {
        ruleScore = 100;
      } else {
        ruleScore = Math.round((actual / recommended) * 100);
      }
    } else if (rule.id === 6) {
      // Max total EMI - ceiling rule (under or at recommended is best)
      if (actual <= recommended) {
        ruleScore = 100;
      } else {
        const overPercent = ((actual - recommended) / recommended) * 100;
        ruleScore = Math.max(0, 100 - overPercent * 2.5);
      }
    } else {
      // Lump sum targets: Emergency fund (7), Corpus FIRE (8)
      if (actual >= recommended) {
        ruleScore = 100;
      } else {
        ruleScore = Math.round((actual / recommended) * 100);
      }
    }

    totalScore += ruleScore;
    count++;
  }

  let finalScore = count > 0 ? Math.round(totalScore / count) : 0;

  // Apply Net Cashflow Budget Deficit Penalty
  // If Total Monthly Outflow (Rules 1-5) exceeds Take-Home Salary, cap maximum achievable health score
  if (salary > 0 && totalMonthlyOutflow > salary) {
    const overbudgetAmount = totalMonthlyOutflow - salary;
    const overbudgetPercent = (overbudgetAmount / salary) * 100;

    let maxCap = 100;
    if (overbudgetPercent > 15) {
      maxCap = 35; // Severe overbudget deficit (>15% over salary)
    } else if (overbudgetPercent > 5) {
      maxCap = 50; // Moderate overbudget deficit (5-15% over salary)
    } else {
      maxCap = 65; // Mild overbudget deficit (1-5% over salary)
    }

    finalScore = Math.min(finalScore, maxCap);
  }

  return finalScore;
}

/** Get label, color and emoji for a health score. */
export function getHealthStatus(score) {
  if (score >= 90) return { label: "Excellent", color: "#22c55e", emoji: "💎" };
  if (score >= 75) return { label: "Good", color: "#059669", emoji: "💫" };
  if (score >= 50) return { label: "Fair", color: "#d97706", emoji: "👌" };
  if (score >= 25) return { label: "Needs work", color: "#dc2626", emoji: "🔥" };
  return { label: "Starting out", color: "#6b7280", emoji: "🔨" };
}
