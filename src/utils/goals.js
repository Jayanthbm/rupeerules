import { projectFireMonths, formatFireYears } from './fireProjection.js';
import { formatMoney } from './formatters.js';

const GOALS_STORAGE_KEY = 'rupeerules_goals_v1';


export const DEFAULT_GOALS_DATA = {
  houseAppreciationRate: 3,
  dreamMilestonePreset: 'standard', // 'lightweight' (5%), 'standard' (15%), 'big-bet' (25%)
  trip: { checked: false, age: '', year: '', country: '' },
  car: { checked: false, name: '', price: '', year: '' },
  houses: [], // max 5: { id, name, price, year, remainingEmi, useManualValue, currentValue }
  secondIncome: { checked: false },
  passiveIncome: { checked: false, monthlyAmount: '' },
  achieved: {
    g1: null, g2: null, g3: null, g4: null, g5: null,
    g6: null, g7: null, g8: null, g9: null, g10: null
  }
};

export function loadGoalsData() {
  try {
    const raw = localStorage.getItem(GOALS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GOALS_DATA };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_GOALS_DATA,
      ...parsed,
      trip: { ...DEFAULT_GOALS_DATA.trip, ...(parsed.trip || {}) },
      car: { ...DEFAULT_GOALS_DATA.car, ...(parsed.car || {}) },
      secondIncome: { ...DEFAULT_GOALS_DATA.secondIncome, ...(parsed.secondIncome || {}) },
      passiveIncome: { ...DEFAULT_GOALS_DATA.passiveIncome, ...(parsed.passiveIncome || {}) },
      achieved: { ...DEFAULT_GOALS_DATA.achieved, ...(parsed.achieved || {}) },
      houses: Array.isArray(parsed.houses) ? parsed.houses : []
    };
  } catch (e) {
    console.error('Failed to load goals data:', e);
    return { ...DEFAULT_GOALS_DATA };
  }
}

export function saveGoalsData(data) {
  try {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save goals data:', e);
  }
}

export function clearGoalsData() {
  try {
    localStorage.removeItem(GOALS_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear goals data:', e);
  }
}

export function calculateHouseCurrentValue(house, appreciationRate = 3) {
  if (!house || !house.price || Number(house.price) <= 0) return 0;
  if (house.useManualValue && house.currentValue && Number(house.currentValue) > 0) {
    return Number(house.currentValue);
  }
  const purchasePrice = Number(house.price);
  const purchaseYear = Number(house.year);
  const currentYear = new Date().getFullYear();
  if (!purchaseYear || purchaseYear >= currentYear) return purchasePrice;
  const years = currentYear - purchaseYear;
  const rate = Number(appreciationRate) / 100;
  return purchasePrice * Math.pow(1 + rate, years);
}

export function computeGoalWeights(preset = 'standard') {
  let dreamWeight = 0.15;
  if (preset === 'lightweight') dreamWeight = 0.05;
  if (preset === 'big-bet') dreamWeight = 0.25;

  const remaining = 1.0 - dreamWeight;
  const eachOther = remaining / 9;

  return {
    g1: eachOther,
    g10: eachOther,
    g2: eachOther,
    g6: eachOther,
    g7: eachOther,
    g3: eachOther,
    g4: eachOther,
    g5: eachOther,
    g8: eachOther,
    g9: dreamWeight
  };
}

export function computeGoalStatuses(goalsData, actuals, breakdownItems, salary, storeMonths = {}) {
  const currentYear = new Date().getFullYear();
  const currentMonthStr = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  // Actuals extraction
  const efActual = Number(actuals[7]) || 0; // Rule 7: Emergency fund actual
  const fireActual = Number(actuals[8]) || 0; // Rule 8: FIRE corpus actual
  const emiActual = Number(actuals[6]) || 0; // Rule 6: Total EMI actual

  // Investment breakdown for G2 (Rule 8 breakdown items, excluding emergency fund row)
  const rule8Items = breakdownItems[8] || [];
  const investPortfolioFromItems = rule8Items
    .filter(item => item.id !== 'w3_emergency')
    .reduce((sum, item) => sum + (Number(item.amount ?? item.value) || 0), 0);
  
  // Use sum of investment breakdown items if present, otherwise fallback to Rule 8 actual total
  const investPortfolio = investPortfolioFromItems > 0 ? investPortfolioFromItems : fireActual;


  // House values & EMIs
  const rate = goalsData.houseAppreciationRate || 3;
  let totalHouseValue = 0;
  let totalHouseEmi = 0;
  let hasValidHouse = false;

  (goalsData.houses || []).forEach(h => {
    if (h.price && Number(h.price) > 0) {
      hasValidHouse = true;
    }
    totalHouseValue += calculateHouseCurrentValue(h, rate);
    totalHouseEmi += Number(h.remainingEmi) || 0;
  });

  // Calculate Average Emergency Expense across months with salary > 0
  let totalEfExpenses = 0;
  let validMonthsCount = 0;
  Object.values(storeMonths).forEach(m => {
    if (m && Number(m.salary) > 0) {
      const mEf = Number(m.actuals && m.actuals[7]) || 0;
      totalEfExpenses += mEf;
      validMonthsCount++;
    }
  });

  // Fallback to salary if no valid months found or total expense is 0
  let avgEmergencyExpense = validMonthsCount > 0 && totalEfExpenses > 0
    ? totalEfExpenses / validMonthsCount
    : (Number(salary) || 0);

  // Total Assets & Net Worth
  const totalAssets = efActual + fireActual + totalHouseValue;
  const netWorth = totalAssets - totalHouseEmi;

  // G1: ₹1L Emergency Fund
  const g1Done = efActual >= 100000;
  const g1Progress = Math.min(efActual / 100000, 1);

  // G10: Zero EMI
  // Check if user has entered data (salary > 0 and actuals present)
  const hasMonthData = (Number(salary) > 0 && Object.keys(actuals).length > 0) || validMonthsCount > 0;
  const g10Done = hasMonthData && emiActual === 0;
  const g10Progress = g10Done ? 1 : 0;

  // G2: ₹10L Portfolio
  const g2Done = investPortfolio >= 1000000;
  const g2Progress = Math.min(investPortfolio / 1000000, 1);

  // G6: Second Income
  const g6Done = !!goalsData.secondIncome?.checked;
  const g6Progress = g6Done ? 1 : 0;

  // G7: Passive Income > Monthly Expense
  const passiveAmount = goalsData.passiveIncome?.checked ? (Number(goalsData.passiveIncome?.monthlyAmount) || 0) : 0;
  const g7Done = avgEmergencyExpense > 0 && passiveAmount >= avgEmergencyExpense;
  const g7Progress = avgEmergencyExpense > 0 ? Math.min(passiveAmount / avgEmergencyExpense, 1) : 0;

  // G3: International Trip
  const g3Done = !!goalsData.trip?.checked;
  const g3Progress = g3Done ? 1 : 0;

  // G4: Car
  const g4Done = !!goalsData.car?.checked;
  const g4Progress = g4Done ? 1 : 0;

  // G5: House
  const g5Done = hasValidHouse;
  const g5Progress = g5Done ? 1 : 0;

  // G8: ₹1Cr Total Assets
  const g8Done = totalAssets >= 10000000;
  const g8Progress = Math.min(totalAssets / 10000000, 1);

  // G8 Projection using Rule 5 monthly investment + 12% CAGR
  const rule5Item = breakdownItems[5] || [];
  const monthlyInvestmentRule5 = Number(actuals[5]) || 0;
  let g8ProjectionText = null;
  if (!g8Done && totalAssets < 10000000 && monthlyInvestmentRule5 > 0) {
    const monthsNeeded = projectFireMonths({
      target: 10000000,
      corpus: totalAssets,
      monthlyInvestment: monthlyInvestmentRule5,
      annualReturn: 0.12
    });
    const label = formatFireYears(monthsNeeded);
    if (label) {
      g8ProjectionText = `At ${formatMoney(monthlyInvestmentRule5)}/mo investment (Rule 5) & ~12% CAGR, estimated ${label} to reach ₹1Cr.`;
    }
  }


  // G9: ₹10Cr Dream Milestone Net Worth
  const g9Done = netWorth >= 100000000;
  const g9Progress = Math.min(Math.max(netWorth, 0) / 100000000, 1);

  const rawStatuses = {
    g1: { done: g1Done, progress: g1Progress, val: efActual, target: 100000 },
    g10: { done: g10Done, progress: g10Progress, val: emiActual, target: 0 },
    g2: { done: g2Done, progress: g2Progress, val: investPortfolio, target: 1000000 },
    g6: { done: g6Done, progress: g6Progress, val: g6Done ? 1 : 0, target: 1 },
    g7: { done: g7Done, progress: g7Progress, val: passiveAmount, target: avgEmergencyExpense },
    g3: { done: g3Done, progress: g3Progress, val: g3Done ? 1 : 0, target: 1 },
    g4: { done: g4Done, progress: g4Progress, val: g4Done ? 1 : 0, target: 1 },
    g5: { done: g5Done, progress: g5Progress, val: (goalsData.houses || []).length, target: 1 },
    g8: { done: g8Done, progress: g8Progress, val: totalAssets, target: 10000000 },
    g9: { done: g9Done, progress: g9Progress, val: netWorth, target: 100000000 }
  };

  // Check achievements and auto update achieved dates if needed
  let updatedAchieved = { ...goalsData.achieved };
  let achievementsChanged = false;

  Object.keys(rawStatuses).forEach(key => {
    if (rawStatuses[key].done && !updatedAchieved[key]) {
      updatedAchieved[key] = currentMonthStr;
      achievementsChanged = true;
    } else if (!rawStatuses[key].done && updatedAchieved[key]) {
      updatedAchieved[key] = null;
      achievementsChanged = true;
    }
  });

  const weights = computeGoalWeights(goalsData.dreamMilestonePreset);
  let overallProgressScore = 0;
  Object.keys(rawStatuses).forEach(k => {
    overallProgressScore += rawStatuses[k].progress * weights[k];
  });
  const overallPercentage = Math.min(Math.round(overallProgressScore * 100), 100);

  return {
    statuses: rawStatuses,
    achieved: updatedAchieved,
    achievementsChanged,
    overallPercentage,
    weights,
    metrics: {
      investPortfolio,
      totalHouseValue,
      totalHouseEmi,
      totalAssets,
      netWorth,
      avgEmergencyExpense,
      g8ProjectionText
    }
  };
}
