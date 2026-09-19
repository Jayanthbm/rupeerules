/**
 * "Can I Buy?" decision engine.
 * Pure functions — no React, no storage. Consumes current-month salary, actuals
 * (ruleId → amount) and financial-health context from the main calculator store.
 */

import { formatMoney } from "./formatters";

/** Annual reducing-balance rate assumed for consumer loans/EMI offers. */
export const EMI_ANNUAL_RATE = 0.12;
/** A one-off purchase price above this share of annual income is never "buy now". */
export const MAX_PRICE_SHARE_OF_ANNUAL = 0.5;
/** After the purchase, the budget surplus for the remaining months must stay above this share of salary. */
export const MIN_POST_SURPLUS_SHARE = 0.05;
/** Full-payment EMIs-equivalent should not eat more than this share of monthly surplus. */
export const MAX_EMI_SHARE_OF_SURPLUS = 0.4;
/** Share of the price the buyer is expected to contribute from existing savings. */
export const MIN_DOWN_PAYMENT_SHARE = 0.1;
/** Monthly EMI at which the plan is deemed unaffordable regardless of the share. */
export const EMI_STRESS_ABSOLUTE_CAP = 0.6;

/** Equal monthly instalment for a principal at a reducing-balance annual rate. */
export function computeEmi(principal, annualRate, months) {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  if (!Number.isFinite(months) || months <= 0) return 0;
  if (annualRate <= 0) return Math.ceil(principal / months);
  const r = annualRate / 12;
  const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return Math.ceil(emi);
}

/** Total payable over the full EMI tenure and the interest portion of it. */
export function computeEmiCost(principal, annualRate, months) {
  const emi = computeEmi(principal, annualRate, months);
  if (emi === 0) return { emi: 0, total: 0, interest: 0 };
  const total = emi * months;
  return { emi, total, interest: total - principal };
}

/** Default tenure months for a given price (shorter tenure for cheaper purchases). */
export function defaultEmiMonths(price) {
  if (!Number.isFinite(price) || price <= 0) return 6;
  if (price <= 25000) return 6;
  if (price <= 100000) return 12;
  if (price <= 500000) return 24;
  return 36;
}

/** Allowed tenure choices (in months) for the EMI tab. */
export const EMI_TENURE_OPTIONS = [3, 6, 9, 12, 18, 24, 36, 48, 60];

/**
 * Score the purchase and return a verdict.
 *
 * @param {object} params
 * @param {number} params.price                 Product price (₹)
 * @param {number} params.salary                Current monthly take-home salary
 * @param {number} params.essentialsActual      Rule 1 actual (essentials spent this month)
 * @param {number} params.maxEmiActual          Rule 6 actual (EMIs already committed this month)
 * @param {number} params.emergencyFundActual   Rule 7 actual (liquid reserves)
 * @param {number} params.emergencyFundTarget   Recommended emergency fund (6× salary or adaptive)
 * @returns verdict object
 */
export function evaluatePurchase({
  price,
  salary,
  essentialsActual,
  maxEmiActual,
  emergencyFundActual,
  emergencyFundTarget,
}) {
  const priceNum = Number(price) || 0;
  const salaryNum = Number(salary) || 0;
  const essentials = Number(essentialsActual) || 0;
  const existingEmi = Number(maxEmiActual) || 0;
  const ef = Number(emergencyFundActual) || 0;
  const efTarget = Number(emergencyFundTarget) || 0;

  const reasons = [];
  if (priceNum <= 0) {
    return {
      verdict: "empty",
      score: null,
      reasons: ["Enter a product price to get a recommendation."],
      priceShare: 0,
      remainingSalaryAfterEssentials: salaryNum,
    };
  }
  if (salaryNum <= 0) {
    return {
      verdict: "no-salary",
      score: null,
      reasons: ["Enter your monthly take-home salary in the calculator first."],
      priceShare: 0,
      remainingSalaryAfterEssentials: 0,
    };
  }

  // Full payment affordability: price should fit within a few months of free cash flow
  // (salary minus essentials minus existing EMIs), and existing EMIs should be under the 40% cap.
  const monthlyFreeCash = Math.max(salaryNum - essentials - existingEmi, 0);
  const priceShareOfAnnual = priceNum / (salaryNum * 12);
  const emiLoadShare = (existingEmi + priceNum / 6) / salaryNum; // spread over 6 months as a stress test
  const postBuySurplus = Math.max(salaryNum - essentials - existingEmi - priceNum / 6, 0);
  const postBuySurplusShare = postBuySurplus / salaryNum;
  const efRatio = efTarget > 0 ? ef / efTarget : 0;

  let score = 100;

  // 1. EMI/debt load
  if (emiLoadShare > 0.4) {
    const penalty = Math.min(40, Math.round((emiLoadShare - 0.4) * 100));
    score -= penalty;
    reasons.push(`Your existing EMIs plus this purchase spread over 6 months would cross the 40% salary cap.`);
  } else {
    score += 5;
    reasons.push("Existing EMI load is comfortably under the 40% cap.");
  }

  // 2. Cash-flow headroom
  if (monthlyFreeCash < priceNum / 6) {
    const monthsNeeded = monthlyFreeCash > 0 ? Math.ceil(priceNum / monthlyFreeCash) : null;
    score -= 20;
    reasons.push(
      monthsNeeded
        ? `At your current free cash flow, it takes about ${monthsNeeded} months of saving to afford this outright.`
        : "You currently have no free cash flow after essentials and EMIs."
    );
  } else {
    score += 10;
    reasons.push("You have healthy monthly free cash flow relative to this price.");
  }

  // 3. Safety net
  if (efRatio >= 1) {
    score += 15;
    reasons.push("Your emergency fund is fully funded — a big purchase won't leave you exposed.");
  } else if (efRatio >= 0.5) {
    reasons.push("Emergency fund is partially funded — consider topping it up before large purchases.");
  } else {
    score -= 20;
    reasons.push("Emergency fund is below 50% of its target; avoid big-ticket spending until it's healthier.");
  }

  // 4. Size of the purchase relative to annual income
  if (priceShareOfAnnual > MAX_PRICE_SHARE_OF_ANNUAL) {
    score -= 30;
    reasons.push(`Price is more than ${Math.round(MAX_PRICE_SHARE_OF_ANNUAL * 100)}% of your annual income.`);
  } else if (priceShareOfAnnual <= 0.1) {
    score += 10;
    reasons.push("Price is a small share of your annual income.");
  }

  // 5. Post-purchase monthly surplus
  if (postBuySurplusShare < MIN_POST_SURPLUS_SHARE) {
    score -= 25;
    reasons.push("After this purchase your monthly surplus would fall below 5% of salary.");
  } else if (postBuySurplusShare >= 0.15) {
    score += 10;
    reasons.push("You'd still have a solid monthly surplus left after buying.");
  }

  score = Math.max(0, Math.min(100, score));

  let verdict;
  if (score >= 70) verdict = "buy-now";
  else if (score >= 45) verdict = "buy-later";
  else verdict = "do-not-buy";

  const verdictCopy = {
    "buy-now": {
      label: "Buy now",
      emoji: "✅",
      summary: "Your finances comfortably support this purchase.",
    },
    "buy-later": {
      label: "Buy later",
      emoji: "⏳",
      summary: "You're close, but not quite there. Build up savings first.",
    },
    "do-not-buy": {
      label: "Not advisable",
      emoji: "🛑",
      summary: "This purchase would strain your finances right now.",
    },
    empty: { label: "", emoji: "", summary: "" },
    "no-salary": { label: "", emoji: "", summary: "" },
  };

  return {
    verdict,
    score,
    reasons,
    label: verdictCopy[verdict].label,
    emoji: verdictCopy[verdict].emoji,
    summary: verdictCopy[verdict].summary,
    priceShareOfAnnual,
    emiLoadShare,
    monthlyFreeCash,
    postBuySurplus,
    postBuySurplusShare,
    efRatio,
    remainingSalaryAfterEssentials: monthlyFreeCash,
  };
}

/**
 * Evaluate a specific payment plan (full vs EMI) for the buy verdicts.
 * Returns { feasible, message } — feasible plans get a green light.
 */
export function evaluatePaymentPlan({ price, verdict, salary, monthlyFreeCash, months, rate = EMI_ANNUAL_RATE }) {
  const priceNum = Number(price) || 0;
  const salaryNum = Number(salary) || 0;
  const freeCash = Number(monthlyFreeCash) || 0;
  const monthsNum = Number(months) || 0;

  if (!priceNum || !salaryNum) {
    return { feasible: false, message: "Enter price and salary first." };
  }

  if (verdict === "buy-later") {
    const monthsToSave = freeCash > 0 ? Math.ceil(priceNum / freeCash) : null;
    return {
      feasible: false,
      message: monthsToSave
        ? `Wait and save: you'd need about ${monthsToSave} more month${monthsToSave === 1 ? "" : "s"} of free cash flow (${formatMoney(freeCash)}/mo) to buy this outright.`
        : "Build up free cash flow before committing to this purchase.",
    };
  }

  if (verdict === "do-not-buy") {
    return {
      feasible: false,
      message: "Clear high-interest debt and rebuild your emergency fund before taking on this purchase.",
    };
  }

  // buy-now path: compare full payment vs EMI affordability
  const { emi, total, interest } = computeEmiCost(priceNum, rate, monthsNum);

  if (monthsNum <= 0) {
    return { feasible: false, message: "Select a valid EMI tenure." };
  }

  const postEmiSurplus = freeCash - emi;
  const postEmiSurplusShare = salaryNum > 0 ? postEmiSurplus / salaryNum : 0;
  const emiShareOfFreeCash = freeCash > 0 ? emi / freeCash : Infinity;

  if (emi > freeCash) {
    return {
      feasible: false,
      emi,
      total,
      interest,
      message: `EMI of ${formatMoney(emi)} exceeds your monthly free cash flow of ${formatMoney(freeCash)}. Try a longer tenure.`,
    };
  }

  if (emiShareOfFreeCash > MAX_EMI_SHARE_OF_SURPLUS) {
    return {
      feasible: false,
      emi,
      total,
      interest,
      message: `EMI would take ${Math.round(emiShareOfFreeCash * 100)}% of your free cash flow (cap ${Math.round(MAX_EMI_SHARE_OF_SURPLUS * 100)}%). Try a longer tenure.`,
    };
  }

  if (postEmiSurplusShare < MIN_POST_SURPLUS_SHARE) {
    return {
      feasible: false,
      emi,
      total,
      interest,
      message: `Post-EMI surplus would be only ${Math.round(postEmiSurplusShare * 100)}% of salary (min ${Math.round(MIN_POST_SURPLUS_SHARE * 100)}%). Try a longer tenure.`,
    };
  }

  if (emi > freeCash * EMI_STRESS_ABSOLUTE_CAP) {
    return {
      feasible: false,
      emi,
      total,
      interest,
      message: "This EMI is too stressful relative to your income. Try a longer tenure or a cheaper product.",
    };
  }

  const interestShare = priceNum > 0 ? interest / priceNum : 0;
  const reasons = [];
  if (interestShare > 0.1) {
    reasons.push(`Total interest over ${monthsNum} months: ${formatMoney(interest)} (${Math.round(interestShare * 100)}% of price).`);
  }

  return {
    feasible: true,
    emi,
    total,
    interest,
    message: `EMI of ${formatMoney(emi)}/month for ${monthsNum} months fits within your free cash flow of ${formatMoney(freeCash)}/mo.`,
    notes: reasons,
  };
}

/**
 * Simulate "wait and save" projection for buy-later verdicts.
 * Returns the month-count needed to afford outright with current free cash flow.
 */
export function monthsToAfford(price, monthlyFreeCash) {
  const priceNum = Number(price) || 0;
  const freeCash = Number(monthlyFreeCash) || 0;
  if (priceNum <= 0) return 0;
  if (freeCash <= 0) return null;
  return Math.ceil(priceNum / freeCash);
}

/**
 * Minimum recommended down payment (share of price) to keep an EMI plan healthy.
 */
export function recommendedDownPayment(price, share = MIN_DOWN_PAYMENT_SHARE) {
  const priceNum = Number(price) || 0;
  return Math.ceil((priceNum * share) / 100) * 100;
}
