import { useReducer, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ALL_RULES } from "../rules";
import { formatSalaryInput, stripFormatting, formatMoney } from "../utils/formatters";
import { computeReportsData } from "../utils/reports";
import {
  loadAllData,
  saveAllData,
  getCurrentMonthKey,
  clearSavedState,
  cleanActuals,
  cleanBreakdownItems,
} from "../utils/storage";

/* ---------------------------------------------------------------
   Pure helpers
   --------------------------------------------------------------- */

function sortItemList(list) {
  if (!Array.isArray(list) || list.length <= 1) return list;
  return [...list].sort((a, b) => {
    const valA = (a && a.amount !== "" && a.amount !== undefined && a.amount !== null) ? Number(a.amount) : -1;
    const valB = (b && b.amount !== "" && b.amount !== undefined && b.amount !== null) ? Number(b.amount) : -1;
    return valB - valA;
  });
}

function sortAllBreakdownItems(itemsMap) {
  if (!itemsMap || typeof itemsMap !== "object") return {};
  const sorted = {};
  for (const [ruleId, list] of Object.entries(itemsMap)) {
    sorted[ruleId] = sortItemList(list);
  }
  return sorted;
}

function defaultItemsMap() {
  const items = {};
  for (const rule of ALL_RULES) {
    if (rule.defaultItems) {
      items[rule.id] = rule.defaultItems;
    }
  }
  return items;
}

/** Sum of entered amounts in a breakdown list. */
function sumList(list) {
  let sum = 0;
  let hasAny = false;
  for (const it of list || []) {
    if (it && it.amount !== "" && it.amount !== undefined && it.amount !== null) {
      sum += Number(it.amount) || 0;
      hasAny = true;
    }
  }
  return { sum, hasAny };
}

/** Keep Rule 8's fixed rows (and linked Emergency Fund) intact in items. Pure. */
function syncEmergencyRow(items, efValue) {
  const fireList = items[8] || [];
  const rule8Defaults = ALL_RULES.find((r) => r.id === 8)?.defaultItems || [];

  // Index existing items by ID
  const existingMap = new Map();
  for (const it of fireList) {
    if (it && it.id) existingMap.set(it.id, it);
  }

  // Ensure all fixed defaults exist with isFixed / isLinked preserved
  const mergedFixed = rule8Defaults.map((def) => {
    const existing = existingMap.get(def.id);
    if (def.id === "w3_emergency") {
      return {
        ...def,
        amount: efValue > 0 ? efValue : "",
      };
    }
    return {
      ...def,
      amount: (existing && existing.amount !== "" && existing.amount !== undefined && existing.amount !== null)
        ? existing.amount
        : 0,
    };
  });

  // Preserve any custom user-added items
  const customItems = fireList.filter((it) => it && !rule8Defaults.some((def) => def.id === it.id));

  return {
    ...items,
    8: [...mergedFixed, ...customItems],
  };
}

/* ---------------------------------------------------------------
   State shape
   --------------------------------------------------------------- */

function buildInitialState() {
  const store = loadAllData();
  const activeMonth = store.activeMonth || getCurrentMonthKey();
  const current = store.months?.[activeMonth] || {};
  const salary = current.salary || 0;
  let items = current.items && Object.keys(current.items).length > 0 ? current.items : defaultItemsMap();
  items = syncEmergencyRow(items, Number(current.actuals?.[7]) || 0);

  return {
    store,
    salary,
    actuals: current.actuals || {},
    breakdownItems: sortAllBreakdownItems(items),
  };
}

/* ---------------------------------------------------------------
   Actions & reducer (all updaters pure)
   --------------------------------------------------------------- */

const ACTIONS = {
  SWITCH_MONTH: "SWITCH_MONTH",
  COPY_MONTH: "COPY_MONTH",
  SET_SALARY_COMMIT: "SET_SALARY_COMMIT",
  SET_SALARY_CLEAR: "SET_SALARY_CLEAR",
  UPDATE_ACTUAL: "UPDATE_ACTUAL",
  UPDATE_ITEM: "UPDATE_ITEM",
  ADD_ITEM: "ADD_ITEM",
  REMOVE_ITEM: "REMOVE_ITEM",
  SORT_ITEMS: "SORT_ITEMS",
  RELOAD: "RELOAD",
  CLEAR_ALL: "CLEAR_ALL",
};

function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.SWITCH_MONTH: {
      const monthData = action.store.months?.[action.month] || {};
      let items = monthData.items && Object.keys(monthData.items).length > 0 ? monthData.items : defaultItemsMap();
      items = syncEmergencyRow(items, Number(monthData.actuals?.[7]) || 0);
      const salary = monthData.salary || 0;
      return {
        ...state,
        store: { ...action.store, activeMonth: action.month },
        salary,
        actuals: monthData.actuals || {},
        breakdownItems: sortAllBreakdownItems(items),
      };
    }

    case ACTIONS.COPY_MONTH: {
      const source = action.store.months?.[action.sourceMonth];
      if (!source) return state;
      const copiedActuals = { ...(source.actuals || {}) };
      let items = JSON.parse(JSON.stringify(source.items || {}));
      items = syncEmergencyRow(items, Number(copiedActuals[7]) || 0);
      items = sortAllBreakdownItems(items);
      const activeM = action.store.activeMonth || getCurrentMonthKey();
      const updatedMonths = {
        ...(action.store.months || {}),
        [activeM]: {
          salary: source.salary || 0,
          actuals: cleanActuals(copiedActuals),
          items: cleanBreakdownItems(items),
          updatedAt: Date.now(),
        },
      };
      const nextStore = { ...action.store, months: updatedMonths };
      return {
        ...state,
        store: nextStore,
        salary: source.salary || 0,
        actuals: copiedActuals,
        breakdownItems: items,
      };
    }

    case ACTIONS.SET_SALARY_COMMIT: {
      const cleaned = stripFormatting(action.value);
      const value = Number(cleaned);
      if (!Number.isNaN(value) && value > 0) {
        const changed = value !== state.salary;
        return {
          ...state,
          salary: value,
          actuals: changed ? {} : state.actuals,
        };
      }
      if (action.value.trim() !== "") {
        return { ...state, salary: 0, actuals: {} };
      }
      return state;
    }

    case ACTIONS.UPDATE_ACTUAL: {
      const value = action.cleaned === "" ? "" : Number(action.cleaned);
      const nextActuals = { ...state.actuals, [action.ruleId]: value };
      let nextBreakdowns = state.breakdownItems;
      if (action.ruleId === 7) {
        const { updatedFireItems, fireActual } = syncEmergencyToFire(value || 0, state.breakdownItems);
        nextBreakdowns = { ...state.breakdownItems, 8: updatedFireItems };
        nextActuals[8] = fireActual;
      }
      return { ...state, actuals: nextActuals, breakdownItems: nextBreakdowns };
    }

    case ACTIONS.UPDATE_ITEM: {
      const currentList = state.breakdownItems[action.ruleId] || [];
      const updatedList = currentList.map((item) =>
        item.id === action.itemId
          ? { ...item, [action.field]: action.field === "amount" ? stripFormatting(action.rawValue) : action.rawValue }
          : item
      );
      const { sum, hasAny } = sumList(updatedList);
      const nextBreakdowns = { ...state.breakdownItems, [action.ruleId]: updatedList };
      const nextActuals = {
        ...state.actuals,
        [action.ruleId]: hasAny ? sum : "",
      };
      if (action.ruleId === 7) {
        const { updatedFireItems, fireActual } = syncEmergencyToFire(hasAny ? sum : 0, nextBreakdowns);
        nextBreakdowns[8] = updatedFireItems;
        nextActuals[8] = fireActual;
      }
      return { ...state, actuals: nextActuals, breakdownItems: nextBreakdowns };
    }

    case ACTIONS.ADD_ITEM: {
      const currentList = state.breakdownItems[action.ruleId] || [];
      const newItem = {
        id: `custom_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        name: "",
        amount: "",
      };
      return {
        ...state,
        breakdownItems: { ...state.breakdownItems, [action.ruleId]: [...currentList, newItem] },
      };
    }

    case ACTIONS.REMOVE_ITEM: {
      const currentList = state.breakdownItems[action.ruleId] || [];
      const updatedList = currentList.filter((item) => item.id !== action.itemId);
      const { sum, hasAny } = sumList(updatedList);
      const nextBreakdowns = { ...state.breakdownItems, [action.ruleId]: updatedList };
      const nextActuals = {
        ...state.actuals,
        [action.ruleId]: hasAny ? sum : (updatedList.length === 0 ? "" : state.actuals[action.ruleId]),
      };
      if (action.ruleId === 7) {
        const { updatedFireItems, fireActual } = syncEmergencyToFire(hasAny ? sum : 0, nextBreakdowns);
        nextBreakdowns[8] = updatedFireItems;
        nextActuals[8] = fireActual;
      }
      return { ...state, actuals: nextActuals, breakdownItems: nextBreakdowns };
    }

    case ACTIONS.SORT_ITEMS: {
      const currentList = state.breakdownItems[action.ruleId] || [];
      if (currentList.length <= 1) return state;
      return {
        ...state,
        breakdownItems: { ...state.breakdownItems, [action.ruleId]: sortItemList(currentList) },
      };
    }

    case ACTIONS.RELOAD: {
      const loaded = action.store;
      const activeM = loaded.activeMonth || getCurrentMonthKey();
      const data = loaded.months?.[activeM] || {};
      let items = data.items && Object.keys(data.items).length > 0 ? data.items : defaultItemsMap();
      items = syncEmergencyRow(items, Number(data.actuals?.[7]) || 0);
      const salary = data.salary || 0;
      return {
        ...state,
        store: loaded,
        salary,
        actuals: data.actuals || {},
        breakdownItems: sortAllBreakdownItems(items),
      };
    }

    case ACTIONS.CLEAR_ALL:
      return {
        store: { activeMonth: getCurrentMonthKey(), months: {} },
        salary: 0,
        actuals: {},
        breakdownItems: sortAllBreakdownItems(defaultItemsMap()),
      };

    default:
      return state;
  }
}

/** Kept for continuity: sync EF value into FIRE list + compute fire actual. Pure. */
function syncEmergencyToFire(efAmount, breakdowns) {
  const fireItems = breakdowns[8] || [];
  const hasEmergencyRow = fireItems.some((it) => it.id === "w3_emergency");
  const emergencyRow = {
    id: "w3_emergency",
    name: "Emergency Fund (Liquid Reserves)",
    amount: efAmount > 0 ? efAmount : "",
    isLinked: true,
  };
  const updatedFireItems = hasEmergencyRow
    ? fireItems.map((it) => (it.id === "w3_emergency" ? emergencyRow : it))
    : [emergencyRow, ...fireItems];

  const { sum, hasAny } = sumList(updatedFireItems);
  return { updatedFireItems, fireActual: hasAny ? sum : "" };
}

/* ---------------------------------------------------------------
   Hook
   --------------------------------------------------------------- */

export function useMoneyRules() {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  const { store, salary, actuals, breakdownItems } = state;
  const activeMonth = store.activeMonth || getCurrentMonthKey();

  const [salaryTransition, setSalaryTransition] = useState(salary);
  // Salary typing buffer: null means "no typing in progress" → derive display from committed salary.
  // This keeps the input in sync with external salary changes (month switch, reload, clear) without
  // effects or refs — the displayed value simply falls back to the committed amount when not editing.
  const [salaryTextBuffer, setSalaryTextBuffer] = useState(null);
  const [activeTab, setActiveTab] = useState("spending");
  const monthlySalary = salaryTextBuffer !== null ? salaryTextBuffer : (salary > 0 ? formatSalaryInput(salary) : "");

  // Keep ref to skip persistence on the very first render
  const isInitialMount = useRef(true);

  const switchMonth = useCallback((targetMonth) => {
    const loadedStore = loadAllData();
    dispatch({ type: ACTIONS.SWITCH_MONTH, store: loadedStore, month: targetMonth });
    saveAllData({ ...loadedStore, activeMonth: targetMonth });
  }, []);

  const copyFromMonth = useCallback((sourceMonthKey) => {
    const loadedStore = loadAllData();
    if (!loadedStore.months?.[sourceMonthKey]) return false;
    dispatch({ type: ACTIONS.COPY_MONTH, store: loadedStore, sourceMonth: sourceMonthKey });
    return true;
  }, []);

  // Animate salaryTransition towards target salary
  useEffect(() => {
    let frame;
    let startTime = null;
    const start = salaryTransition;
    const diff = salary - start;

    if (diff === 0) return;

    const animate = (now) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / 200, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = start + diff * eased;

      setSalaryTransition(Math.round(current * 100) / 100);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        setSalaryTransition(salary);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [salary, salaryTransition]);

  // Persist current month data to local storage on changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (salary > 0 || Object.keys(actuals).length > 0) {
      const loaded = loadAllData();
      const activeM = loaded.activeMonth || getCurrentMonthKey();
      const updatedMonths = {
        ...(loaded.months || {}),
        [activeM]: {
          salary,
          actuals: cleanActuals(actuals),
          items: cleanBreakdownItems(breakdownItems),
          updatedAt: Date.now(),
        },
      };
      saveAllData({ ...loaded, months: updatedMonths });
    }
  }, [salary, actuals, breakdownItems]);

  const handleSalaryChange = useCallback((value) => {
    setSalaryTextBuffer(value);
  }, []);

  const handleSalaryCommit = useCallback(() => {
    dispatch({ type: ACTIONS.SET_SALARY_COMMIT, value: salaryTextBuffer ?? "" });
    setSalaryTextBuffer(null);
  }, [salaryTextBuffer]);

  const updateActual = useCallback((ruleId, rawValue) => {
    dispatch({ type: ACTIONS.UPDATE_ACTUAL, ruleId, cleaned: stripFormatting(rawValue) });
  }, []);

  const updateBreakdownItem = useCallback((ruleId, itemId, field, rawValue) => {
    dispatch({ type: ACTIONS.UPDATE_ITEM, ruleId, itemId, field, rawValue });
  }, []);

  const addBreakdownItem = useCallback((ruleId) => {
    dispatch({ type: ACTIONS.ADD_ITEM, ruleId });
  }, []);

  const removeBreakdownItem = useCallback((ruleId, itemId) => {
    dispatch({ type: ACTIONS.REMOVE_ITEM, ruleId, itemId });
  }, []);

  const sortBreakdownItems = useCallback((ruleId) => {
    dispatch({ type: ACTIONS.SORT_ITEMS, ruleId });
  }, []);

  const reloadFromStore = useCallback(() => {
    dispatch({ type: ACTIONS.RELOAD, store: loadAllData() });
  }, []);

  const handleClearAll = useCallback(() => {
    clearSavedState();
    dispatch({ type: ACTIONS.CLEAR_ALL });
  }, []);

  // Aggregate store reports to derive multi-month averages for adaptive benchmarks
  const reportsData = useMemo(() => {
    return computeReportsData(store?.months);
  }, [store?.months]);

  // Compute rule items
  const rulesWithAmounts = useMemo(() => {
    const { hasEmergencyAvg, hasFireAvg, avgEmergencyExpense, avgLivingExpense } = reportsData;

    return ALL_RULES.map((rule) => {
      let recommended = salaryTransition * rule.multiplier;
      let dynamicNote = rule.note;
      let adaptiveBadge = null;

      if (rule.id === 7) {
        if (hasEmergencyAvg && avgEmergencyExpense > 0) {
          recommended = avgEmergencyExpense * 6;
          dynamicNote = `Calculated as 6 × Avg Non-Negotiable Expenses (₹${avgEmergencyExpense.toLocaleString("en-IN")}/mo Essentials + EMIs based on ${reportsData.activeMonthCount || 3}+ months recorded data).`;
          adaptiveBadge = {
            icon: "🎯",
            text: "Adaptive: 6-Mo Non-negotiable Expenses",
            subtext: `Based on ₹${avgEmergencyExpense.toLocaleString("en-IN")}/mo average survival costs`,
            color: "#be185d",
            bg: "rgba(190,24,93,0.12)",
          };
        } else {
          dynamicNote = `Calculated as Monthly salary × 6. (Track 3+ months to unlock adaptive benchmark based on real non-negotiable expenses).`;
        }
      } else if (rule.id === 8) {
        if (hasFireAvg && avgLivingExpense > 0) {
          recommended = avgLivingExpense * 12 * 25;
          dynamicNote = `Calculated as 25 × Annual Real Expenses (₹${avgLivingExpense.toLocaleString("en-IN")}/mo avg living costs × 12 × 25 based on 4% safe withdrawal rule).`;
          adaptiveBadge = {
            icon: "🔥",
            text: "Adaptive: 25× Annual Real Spending",
            subtext: `Based on ₹${avgLivingExpense.toLocaleString("en-IN")}/mo average living expenses`,
            color: "#ca8a04",
            bg: "rgba(202,138,4,0.12)",
          };
        } else {
          dynamicNote = `Calculated as Monthly salary × 120 (10× Annual Salary milestone). Track 6+ months to unlock adaptive 25× real living expenses FIRE target.`;
        }
      }

      const actual = actuals[rule.id] ?? 0;
      const actualNum = actual === "" ? 0 : Number(actual);

      let progress;
      let progressLabel;

      if (rule.id === 8) {
        const remain = Math.max(0, recommended - actualNum);
        progress = actualNum > 0 ? (actualNum / recommended) * 100 : 0;
        progressLabel = actualNum > 0
          ? `${formatMoney(actualNum)} invested · ${formatMoney(remain)} to go`
          : `Target: ${formatMoney(recommended)}`;
      } else if (rule.id === 7) {
        const remain = Math.max(0, recommended - actualNum);
        progress = actualNum > 0 ? (actualNum / recommended) * 100 : 0;
        progressLabel = actualNum > 0
          ? `${formatMoney(actualNum)} parked · ${formatMoney(remain)} to go`
          : `Target: ${formatMoney(recommended)}`;
      } else if (actualNum > 0) {
        progress = Math.min((actualNum / recommended) * 100, 100);
        progressLabel = actualNum <= recommended
          ? `${Math.abs(actualNum - recommended).toFixed(2)} under`
          : `+${Math.abs(actualNum - recommended).toFixed(2)} over`;
      } else {
        progress = null;
        progressLabel = "Enter what you actually spend / save";
      }

      let status;
      if (actual === "" || actualNum === 0) {
        status = "pending";
      } else if (Math.abs(actualNum - recommended) < 1) {
        status = "on-target";
      } else if (actualNum < recommended) {
        status = "under";
      } else {
        status = "over";
      }

      return {
        ...rule,
        recommended,
        actual: actualNum,
        actualRaw: actual,
        progress,
        progressLabel,
        status,
        note: dynamicNote,
        adaptiveBadge,
      };
    });
  }, [salaryTransition, actuals, reportsData]);

  const ruleMap = useMemo(() => {
    const map = {};
    for (const r of rulesWithAmounts) {
      map[r.id] = r;
    }
    return map;
  }, [rulesWithAmounts]);

  return {
    store,
    activeMonth,
    salary,
    monthlySalary,
    salaryTransition,
    actuals,
    breakdownItems,
    activeTab,
    setActiveTab,
    switchMonth,
    copyFromMonth,
    reloadFromStore,
    handleSalaryChange,
    handleSalaryCommit,
    updateActual,
    updateBreakdownItem,
    addBreakdownItem,
    removeBreakdownItem,
    sortBreakdownItems,
    handleClearAll,
    rulesWithAmounts,
    ruleMap,
  };
}
