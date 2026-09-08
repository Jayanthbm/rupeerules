import { formatMoney } from "./formatters";

/**
 * Generate contextual feedback based on the rule type and actual vs recommended amounts.
 */
export function getRuleFeedback(ruleId, status, actual, recommended) {
  const diff = Math.abs(recommended - actual);
  const formattedDiff = formatMoney(diff);

  switch (ruleId) {
    case 1: // Essential expenses (55% max)
      if (status === "on-target") {
        return {
          text: "Right at your 55% ceiling. Living expenses are well balanced.",
          type: "good",
        };
      }
      if (status === "under") {
        return {
          text: `Great job keeping living expenses lean! You have ${formattedDiff} extra for savings & investments.`,
          type: "good",
        };
      }
      return {
        text: `Over by ${formattedDiff}. High fixed costs may compress your savings capacity.`,
        type: "warn",
      };

    case 2: // Guilt-free money (5%)
      if (status === "on-target") {
        return {
          text: "Spot on! Enjoying your earnings guilt-free.",
          type: "good",
        };
      }
      if (status === "under") {
        return {
          text: `You have ${formattedDiff} left for guilt-free fun spending. Treat yourself!`,
          type: "info",
        };
      }
      return {
        text: `Spent ${formattedDiff} above the 5% cap. Keep an eye that fun spending doesn't squeeze investments.`,
        type: "warn",
      };

    case 3: // Debt payoff / investing (10%)
      if (status === "on-target") {
        return {
          text: "On track! Consistent debt payoff and foundation investing.",
          type: "good",
        };
      }
      if (status === "under") {
        return {
          text: `Allocating ${formattedDiff} less than recommended. Target high-interest debt or start a monthly SIP.`,
          type: "warn",
        };
      }
      return {
        text: `Aggressive payoff/investing (+${formattedDiff})! You will reach debt freedom and wealth much faster.`,
        type: "good",
      };

    case 4: // Short-term goals (15%)
      if (status === "on-target") {
        return {
          text: "Steady pace towards your upcoming short-term goals.",
          type: "good",
        };
      }
      if (status === "under") {
        return {
          text: `Saving ${formattedDiff} less than targeted. Milestones may take a bit longer to reach.`,
          type: "info",
        };
      }
      return {
        text: `Fast-tracking your goals (+${formattedDiff})! You'll achieve upcoming milestones early.`,
        type: "good",
      };

    case 5: // Long-term wealth (15%)
      if (status === "on-target") {
        return {
          text: "Consistent wealth builder! Compounding interest is working in your favor.",
          type: "good",
        };
      }
      if (status === "under") {
        return {
          text: `Investing ${formattedDiff} below 15%. Boosting SIPs now significantly multiplies future wealth.`,
          type: "warn",
        };
      }
      return {
        text: `Supercharging your wealth (+${formattedDiff})! Incredible investing discipline.`,
        type: "good",
      };

    case 6: // Max total EMI (40% max)
      if (status === "on-target") {
        return {
          text: "At the recommended EMI ceiling (40%). Avoid taking on additional loan obligations.",
          type: "info",
        };
      }
      if (status === "under") {
        return {
          text: `Safe and low debt burden (${formattedDiff} below the 40% threshold).`,
          type: "good",
        };
      }
      return {
        text: `High debt burden (+${formattedDiff} over 40%). High EMIs increase financial risk.`,
        type: "warn",
      };

    case 7: // Emergency fund (6x)
      if (actual >= recommended) {
        return {
          text: "Fully funded 6-month safety buffer in place. You are protected against surprises!",
          type: "good",
        };
      }
      return {
        text: `${formattedDiff} needed to reach full 6-month emergency protection.`,
        type: "info",
      };

    case 8: // Corpus to replace income / FIRE (120x)
      if (actual >= recommended) {
        return {
          text: "Financial independence target achieved! Working is now completely optional.",
          type: "good",
        };
      }
      return {
        text: `${formattedDiff} remaining to achieve complete financial freedom.`,
        type: "info",
      };

    default:
      return null;
  }
}
