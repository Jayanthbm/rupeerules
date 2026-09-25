# Goals Section — Implementation Plan

> Status: **✅ Implemented.**

---

## Architecture

- New view `goals` in `MoneyRulesCalculator.jsx` (alongside `calculator`, `reports`, `canibuy`).
- New nav button in `Header.jsx` (🎯 Goals).
- New files:
  - `src/components/GoalsSection.jsx`
  - `src/utils/goals.js`
  - `src/styles/goals.css`
- Goals stored in **separate localStorage key**: `rupeerules_goals_v1`
  - Lifetime data — NOT per-month.
  - **Clear All WIPES goals too** (since most are auto-calculated and tied to financial data).
- Backup updated to include goals in export/import (version bump to 3).

---

## Data Model

```js
// localStorage: rupeerules_goals_v1
{
  houseAppreciationRate: 3,       // configurable, default 3% p.a.
  dreamMilestonePreset: "standard", // "lightweight"(5%) | "standard"(15%) | "big-bet"(25%)

  trip: { checked: false, age: "", year: "", country: "" },
  car: { checked: false, name: "", price: "", year: "" },
  houses: [
    {
      id: "...",
      name: "",             // e.g. "2BHK Bengaluru"
      price: "",            // purchase price (₹)
      year: "",             // year bought
      remainingEmi: "",     // total remaining EMI amount (₹)
      useManualValue: false,// if true, user overrides current value
      currentValue: "",     // manual current market value (only if useManualValue)
    }
  ],                        // max 5 houses
  secondIncome: { checked: false },
  passiveIncome: { checked: false, monthlyAmount: "" },

  // Achieved timestamps (set once, never cleared unless Clear All)
  achieved: {
    g1: null,  // e.g. "2026-09" — month key when first achieved
    g2: null,
    g3: null,
    g4: null,
    g5: null,
    g6: null,
    g7: null,
    g8: null,
    g9: null,
    g10: null,
  }
}
```

---

## The 10 Goals — Display Order & Weights

> **Display order** follows financial discipline → lifestyle → wealth milestones.

| Display | # (original) | Goal | Type | Default Weight | Progress Tracking |
|---------|-------------|------|------|---------------|-------------------|
| 1st | G1 | ₹1 Lakh in Bank | Auto | **5%** | Yes — `efActual / 1,00,000` |
| 2nd | G10 | Zero EMI Lifestyle | Auto | **10%** | Binary |
| 3rd | G2 | ₹10 Lakh Investment Portfolio | Auto | **10%** | Yes — `investPortfolio / 10,00,000` |
| 4th | G6 | Second Source of Income | Manual checkbox | **10%** | Binary |
| 5th | G7 | Passive Income > Monthly Expenses | Semi-auto | **15%** | Yes — `passiveIncome / avgExpenses` (**independent** — no G6 gate) |
| 6th | G3 | First International Trip | Manual | **5%** | Binary |
| 7th | G4 | Car | Manual | **5%** | Binary |
| 8th | G5 | House | Manual (multi, max 5) | **15%** | Binary (≥1 house with non-zero price) |
| 9th | G8 | ₹1 Crore in Total Assets | Auto | **10%** | Yes — `totalAssets / 1,00,00,000` |
| 10th | G9 | ₹10 Crore Net Worth *(Dream Milestone)* | Auto | **15% (configurable)** | Yes — `netWorth / 10,00,00,000` |

**Total default weight = 100%**

> ⚙️ G9 is labelled **"Dream Milestone"** — users pick from 3 presets (5%/15%/25%). The remaining weight is split equally across the other 9 goals.

---

## Top Progress Bar Logic

Overall score (0–100%) is a **weighted sum**:

```
totalProgress = sum over all goals of:
  weight_i × min(goalProgress_i, 1.0)
```

Where `goalProgress_i` is:
- **Binary goals** (G3, G4, G5, G6, G10): 0 or 1
- **Numeric goals** (G1, G2, G7, G8, G9): `actual / target` capped at 1.0
- **G7 is fully independent** — no gate on G6

Per-goal mini progress bar shown for: G1, G2, G7, G8, G9.

---

## Goal 2 — Investment Portfolio

Includes **EPF** (most common salaried investment):

```js
// G2: investPortfolio
const investPortfolio = sum of:
  w3_epf + w3_stocks + w3_mf + w3_digital_gold + w3_physical_gold
// from breakdownItems[8]
```

---

## Goal 7 — Passive Income (Independent)

No gate on G6. User enters monthly passive income; compared to avg expenses:

```js
const avgExpenses = reportsData.avgEmergencyExpense || salary; // fallback to salary
const g7Done = avgExpenses > 0 && passiveIncome >= avgExpenses;
// FIX: guard against division by zero
const g7Progress = avgExpenses > 0 ? Math.min(passiveIncome / avgExpenses, 1) : 0;
```

---

## Goal 9 — Dream Milestone (Configurable Weight)

- Labelled **"Dream Milestone"** in the UI — aspirational, not discouraging.
- Weight is chosen via **3 presets** (avoids confusing proportional rescaling):

| Preset | Weight | When to use |
|--------|--------|-------------|
| Lightweight | 5% | "It's far off, just tracking" |
| Standard | 15% | Default |
| Big Bet | 25% | "This is my main life goal" |

- The remaining weight (95%, 85%, or 75%) is split equally across the other 9 goals.
- Progress shows % of ₹10Cr — even 1% feels meaningful.
- **G9 sub-label when not done**: `"₹X of ₹10Cr · Tip: complete ₹1Cr milestone (Goal 8) first"`
  — prevents G9 feeling frozen while G8 is still in progress.

---

## Goal 10 — Zero EMI (Fixed Logic)

```js
// Only counts as done if: user has data AND actively has no EMI
const hasData = salary > 0 && Object.keys(actuals).length > 0;
const g10Done = hasData && (!actuals[6] || Number(actuals[6]) === 0);
```

---

## House Data Logic

```js
const appreciationRate = goals.houseAppreciationRate / 100; // configurable

function currentHouseValue(house) {
  if (house.useManualValue && house.currentValue) {
    return Number(house.currentValue);
  }
  const years = new Date().getFullYear() - Number(house.year);
  return Math.round(Number(house.price) * Math.pow(1 + appreciationRate, Math.max(years, 0)));
}
```

UI for each house:
- Fields: Name, Purchase Price, Year Bought, Remaining EMI Amount
- Toggle: `[ ] I know the current market value` → shows "Current Value (₹)" input
- If unchecked: auto-calculated shown as read-only: `"Est. current value: ₹X,XX,XXX (at Y%/yr)"`
- **Info note on each house card**: `"This house's current value is included in Goals 8 & 9 (Total Assets / Net Worth)."`

---

## Key Formulas

```js
// G1
const g1Done = efActual >= 100000;
const g1Progress = Math.min(efActual / 100000, 1);

// G2
const investPortfolio = w3_epf + w3_stocks + w3_mf + w3_digital_gold + w3_physical_gold;
const g2Done = investPortfolio >= 1000000;
const g2Progress = Math.min(investPortfolio / 1000000, 1);

// G7 (independent, zero-guard)
const avgExpenses = reportsData.avgEmergencyExpense || salary;
const g7Done = avgExpenses > 0 && passiveIncome >= avgExpenses;
const g7Progress = avgExpenses > 0 ? Math.min(passiveIncome / avgExpenses, 1) : 0;

// G8
function totalAssets(efActual, fireCorpus, houses) {
  return (efActual || 0) + (fireCorpus || 0)
    + houses.reduce((s, h) => s + currentHouseValue(h), 0);
}
const g8Done = totalAssets(...) >= 10000000;
const g8Progress = Math.min(totalAssets(...) / 10000000, 1);

// G9 (Dream Milestone)
function netWorth(efActual, fireCorpus, houses) {
  return totalAssets(efActual, fireCorpus, houses)
    - houses.reduce((s, h) => s + (Number(h.remainingEmi) || 0), 0);
}
const g9Done = netWorth(...) >= 100000000;
const g9Progress = Math.min(netWorth(...) / 100000000, 1);

// G10
const hasData = salary > 0 && Object.keys(actuals).length > 0;
const g10Done = hasData && (!actuals[6] || Number(actuals[6]) === 0);
```

---

## "Date Achieved" Tracking (Suggestion A)

When any goal flips from `false → true` for the first time, store the current month key:

```js
// In computeGoalStatuses(), after computing each gXDone:
if (gXDone && !goals.achieved.gX) {
  goals.achieved.gX = getCurrentMonthKey(); // e.g. "2026-09"
  saveGoalsData(goals);
}
```

UI: completed goals show a **celebration badge**: `🏆 Achieved Sep 2026`

---

## "Estimated Time to Reach" (Suggestion 7)

For auto numeric goals (G1, G2, G8), show a projection line below the mini progress bar:

- **G1**: `"At your current EF savings pace (~₹X/mo), ~Y months to reach ₹1L."`
  - Derive pace from month-over-month EF delta in reports data.
- **G2**: `"Adding ₹X/mo to investments, ~Y months to ₹10L at 12% CAGR."`
  - Use Rule 5 actual (investments/mo) + FIRE projection math already in `fireProjection.js`.
- **G8/G9**: too complex to project accurately — show static progress % only.

---

## Goals View Gate

If no month data (salary = 0 or no months recorded):
> *"Fill in at least one month's salary and expenses to unlock your Goals tracker."*

---

## Per-Goal Action Nudges

Each incomplete goal shows a one-line actionable hint below its progress bar:

| Goal | Nudge (shown when not done) |
|------|-----------------------------|
| G1 | "Add to your Emergency Fund in the Wealth tab → Rule 7" |
| G2 | "Increase Rule 5 (Long-term wealth) investments" |
| G3 | "Check the box above and add your trip details" |
| G4 | "Check the box above and add your car details" |
| G5 | "Add at least one house with a purchase price" |
| G6 | "Check when you earn from a second source" |
| G7 | "Enter your monthly passive income above" |
| G8 | "Grow your Emergency Fund, investments and house portfolio" |
| G9 | "Focus on ₹1Cr milestone (Goal 8) first" |
| G10 | "Pay down loans tracked in Rule 6 (Max EMI)" |

---

## Data Wiring

```jsx
<GoalsSection
  store={store}
  breakdownItems={breakdownItems}
  actuals={actuals}
  reportsData={reportsData}
  salary={salary}
/>
```

Derived inside GoalsSection:
- `efActual` = `actuals[7]`
- `emiActual` = `actuals[6]`
- `fireCorpus` = `actuals[8]`
- `investPortfolio` = sum of `w3_epf + w3_stocks + w3_mf + w3_digital_gold + w3_physical_gold` from `breakdownItems[8]`
- `avgExpenses` = `reportsData.avgEmergencyExpense || salary`

---

## Backup Changes

- version bump: 2 → 3
- export adds: `goals: loadGoalsData()`
- import: if `parsed.goals` → `saveGoalsData(parsed.goals)`
- `clearSavedState()` also clears `rupeerules_goals_v1`

---

## Files to Touch

| File | Change |
|------|--------|
| `src/utils/goals.js` | NEW — loadGoalsData, saveGoalsData, clearGoalsData, computeGoalStatuses |
| `src/components/GoalsSection.jsx` | NEW — full UI |
| `src/styles/goals.css` | NEW — styles |
| `src/components/Header.jsx` | Add Goals nav button |
| `src/MoneyRulesCalculator.jsx` | Add goals view, pass reportsData |
| `src/utils/storage.js` | Goals in export/import, version 3, clear goals in clearSavedState |

---

## Confirmed Decisions

- [x] G7 independent — no G6 gate ✅
- [x] G7 division-by-zero guard: `avgExpenses > 0 ? ... : 0` ✅
- [x] G2 includes EPF (w3_epf) ✅
- [x] G9 = "Dream Milestone", 3 preset weights: Lightweight(5%) / Standard(15%) / Big Bet(25%) ✅
- [x] G9 sub-label: "₹X of ₹10Cr · Tip: complete ₹1Cr milestone (Goal 8) first" ✅
- [x] G10 logic: `actuals[6] === 0 AND salary > 0 AND data exists` ✅
- [x] Estimated time to reach shown for G1, G2 ✅
- [x] Date achieved badge stored + shown on completion ✅
- [x] Display order: G1→G10→G2→G6→G7→G3→G4→G5→G8→G9 ✅
- [x] House UI note: "Included in Goals 8 & 9" ✅
- [x] House fields: name, price, year, remaining EMI + optional manual current value ✅
- [x] House appreciation rate: configurable (default 3%) ✅
- [x] Max houses: 5 ✅
- [x] Clear All: wipes goals ✅
- [x] Goals view gated: needs salary + data, else shows prompt ✅
- [x] G5 done = ≥1 house with non-zero price ✅
- [x] Per-goal action nudges on all incomplete goals ✅

---

## Open Decisions

*(none — all resolved)*

---

## Changelog

| Date | Change |
|------|--------|
| 2026-09-24 | Initial draft |
| 2026-09-24 | House simplified: name, price, year, remainingEmi. Goal 9 formula updated. |
| 2026-09-25 | House: manual value toggle + configurable appreciation. Max 5. Clear All wipes goals. Weighted progress. |
| 2026-09-25 | G5 done = ≥1 house with non-zero price. Goals gate = salary + data required. |
| 2026-09-25 | G7 independent + zero-guard. G2 includes EPF. G9 = Dream Milestone with 3 presets + sub-label. G10 fixed logic. Est. time for G1/G2. Date achieved. Display order. House note. Action nudges per goal. |
