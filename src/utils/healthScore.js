/** Calculate an overall financial health score (0-100) based on how well
 *  the user is following their money rules. */
export function calculateHealthScore(rules) {
  if (!rules || rules.length === 0) return 0;

  let totalScore = 0;
  let count = 0;

  for (const rule of rules) {
    if (rule.actualRaw === "" || rule.actualRaw === undefined || rule.actualRaw === null) {
      continue;
    }

    const recommended = rule.recommended;
    const actual = rule.actual;

    if (recommended === 0) continue;

    let ruleScore;

    if (rule.id === 1) {
      // Essential expenses - should be at or under the max
      if (actual <= recommended) {
        ruleScore = 100;
      } else {
        const overPercent = ((actual - recommended) / recommended) * 100;
        ruleScore = Math.max(0, 100 - overPercent * 2);
      }
    } else if (rule.id === 2) {
      // Guilt-free money
      if (actual > 0 && actual <= recommended) {
        ruleScore = 100;
      } else if (actual > recommended) {
        ruleScore = 80;
      } else {
        ruleScore = 50;
      }
    } else if (rule.id === 3 || rule.id === 5) {
      // Investing/debt rules - should meet or exceed
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
        ruleScore = Math.max(0, 100 - overPercent * 2);
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

  return count > 0 ? Math.round(totalScore / count) : 0;
}

/** Get label, color and emoji for a health score. */
export function getHealthStatus(score) {
  if (score >= 90) return { label: "Excellent", color: "#22c55e", emoji: "💎" };
  if (score >= 75) return { label: "Good", color: "#059669", emoji: "💫" };
  if (score >= 50) return { label: "Fair", color: "#d97706", emoji: "👌" };
  if (score >= 25) return { label: "Needs work", color: "#dc2626", emoji: "🔥" };
  return { label: "Starting out", color: "#6b7280", emoji: "🔨" };
}
