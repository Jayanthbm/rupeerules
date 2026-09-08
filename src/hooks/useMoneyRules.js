import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ALL_RULES } from "../rules";
import { formatSalaryInput, stripFormatting, formatMoney } from "../utils/formatters";
import {
  loadAllData,
  saveAllData,
  getCurrentMonthKey,
  clearSavedState,
  cleanActuals,
  cleanBreakdownItems,
} from "../utils/storage";

export function useMoneyRules() {
  const [store, setStore] = useState(() => loadAllData());
  const activeMonth = store.activeMonth || getCurrentMonthKey();
  const currentMonthData = store.months?.[activeMonth] || {};

  const [monthlySalary, setMonthlySalary] = useState(() => {
    return currentMonthData.salary > 0 ? formatSalaryInput(currentMonthData.salary) : "";
  });

  const [salary, setSalary] = useState(() => currentMonthData.salary || 0);
  const [salaryTransition, setSalaryTransition] = useState(() => currentMonthData.salary || 0);
  const [actuals, setActuals] = useState(() => currentMonthData.actuals || {});

  const [breakdownItems, setBreakdownItems] = useState(() => {
    if (currentMonthData.items && Object.keys(currentMonthData.items).length > 0) {
      return currentMonthData.items;
    }
    const initial = {};
    for (const rule of ALL_RULES) {
      if (rule.defaultItems) {
        initial[rule.id] = rule.defaultItems;
      }
    }
    return initial;
  });

  const [activeTab, setActiveTab] = useState("spending");

  // Keep ref to latest state values to avoid stale closures in event sync
  const isInitialMount = useRef(true);

  // Sync state when activeMonth changes
  const switchMonth = useCallback((targetMonth) => {
    const loadedStore = loadAllData();
    const monthData = loadedStore.months?.[targetMonth] || {};
    const newSalary = monthData.salary || 0;
    const newActuals = monthData.actuals || {};

    let newItems = monthData.items;
    if (!newItems || Object.keys(newItems).length === 0) {
      newItems = {};
      for (const rule of ALL_RULES) {
        if (rule.defaultItems) {
          newItems[rule.id] = rule.defaultItems;
        }
      }
    }

    setSalary(newSalary);
    setSalaryTransition(newSalary);
    setMonthlySalary(newSalary > 0 ? formatSalaryInput(newSalary) : "");
    setActuals(newActuals);
    setBreakdownItems(newItems);

    const nextStore = {
      ...loadedStore,
      activeMonth: targetMonth,
    };
    saveAllData(nextStore);
    setStore(nextStore);
  }, []);

  // Copy data from a given source month into activeMonth
  const copyFromMonth = useCallback((sourceMonthKey) => {
    const loadedStore = loadAllData();
    const sourceData = loadedStore.months?.[sourceMonthKey];
    if (!sourceData) return false;

    const copiedSalary = sourceData.salary || 0;
    const copiedActuals = { ...(sourceData.actuals || {}) };
    const copiedItems = JSON.parse(JSON.stringify(sourceData.items || {}));

    setSalary(copiedSalary);
    setSalaryTransition(copiedSalary);
    setMonthlySalary(copiedSalary > 0 ? formatSalaryInput(copiedSalary) : "");
    setActuals(copiedActuals);
    setBreakdownItems(copiedItems);

    const activeM = loadedStore.activeMonth || getCurrentMonthKey();
    const updatedMonths = {
      ...(loadedStore.months || {}),
      [activeM]: {
        salary: copiedSalary,
        actuals: cleanActuals(copiedActuals),
        items: cleanBreakdownItems(copiedItems),
        updatedAt: Date.now(),
      },
    };
    const nextStore = { ...loadedStore, months: updatedMonths };
    saveAllData(nextStore);
    setStore(nextStore);
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
      const nextStore = { ...loaded, months: updatedMonths };
      saveAllData(nextStore);
    }
  }, [salary, actuals, breakdownItems]);

  const handleSalaryChange = useCallback((value) => {
    setMonthlySalary(value);
  }, []);

  const handleSalaryCommit = useCallback(() => {
    const cleaned = stripFormatting(monthlySalary);
    const value = Number(cleaned);

    if (!Number.isNaN(value) && value > 0) {
      if (value !== salary) {
        setSalary(value);
        setActuals({});
      }
      setMonthlySalary(formatSalaryInput(value));
    } else if (monthlySalary.trim() !== "") {
      setMonthlySalary("");
      setSalary(0);
      setActuals({});
    }
  }, [monthlySalary, salary]);

  const updateActual = useCallback((ruleId, rawValue) => {
    const cleaned = stripFormatting(rawValue);
    const value = cleaned === "" ? "" : Number(cleaned);
    setActuals((prev) => ({
      ...prev,
      [ruleId]: value,
    }));
  }, []);

  const updateBreakdownItem = useCallback((ruleId, itemId, field, rawValue) => {
    setBreakdownItems((prev) => {
      const currentList = prev[ruleId] || [];
      const updatedList = currentList.map((item) => {
        if (item.id === itemId) {
          return { ...item, [field]: field === "amount" ? stripFormatting(rawValue) : rawValue };
        }
        return item;
      });

      let sum = 0;
      let hasAnyValue = false;
      for (const it of updatedList) {
        if (it.amount !== "" && it.amount !== undefined) {
          sum += Number(it.amount) || 0;
          hasAnyValue = true;
        }
      }

      setActuals((actPrev) => ({
        ...actPrev,
        [ruleId]: hasAnyValue ? sum : "",
      }));

      return {
        ...prev,
        [ruleId]: updatedList,
      };
    });
  }, []);

  const addBreakdownItem = useCallback((ruleId) => {
    setBreakdownItems((prev) => {
      const currentList = prev[ruleId] || [];
      const newItem = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: "",
        amount: "",
      };
      return {
        ...prev,
        [ruleId]: [...currentList, newItem],
      };
    });
  }, []);

  const removeBreakdownItem = useCallback((ruleId, itemId) => {
    setBreakdownItems((prev) => {
      const currentList = prev[ruleId] || [];
      const updatedList = currentList.filter((item) => item.id !== itemId);

      let sum = 0;
      let hasAnyValue = false;
      for (const it of updatedList) {
        if (it.amount !== "" && it.amount !== undefined) {
          sum += Number(it.amount) || 0;
          hasAnyValue = true;
        }
      }

      setActuals((actPrev) => ({
        ...actPrev,
        [ruleId]: hasAnyValue ? sum : (updatedList.length === 0 ? "" : actPrev[ruleId]),
      }));

      return {
        ...prev,
        [ruleId]: updatedList,
      };
    });
  }, []);

  const reloadFromStore = useCallback(() => {
    const loaded = loadAllData();
    setStore(loaded);
    const activeM = loaded.activeMonth || getCurrentMonthKey();
    const data = loaded.months?.[activeM] || {};
    setSalary(data.salary || 0);
    setSalaryTransition(data.salary || 0);
    setMonthlySalary(data.salary > 0 ? formatSalaryInput(data.salary) : "");
    setActuals(data.actuals || {});
    setBreakdownItems(data.items || {});
  }, []);

  const handleClearAll = useCallback(() => {
    setActuals({});
    setMonthlySalary("");
    setSalary(0);
    setSalaryTransition(0);
    const initial = {};
    for (const rule of ALL_RULES) {
      if (rule.defaultItems) {
        initial[rule.id] = rule.defaultItems;
      }
    }
    setBreakdownItems(initial);
    clearSavedState();
    setStore({ activeMonth: getCurrentMonthKey(), months: {} });
  }, []);

  // Compute rule items
  const rulesWithAmounts = useMemo(() => {
    return ALL_RULES.map((rule) => {
      const recommended = salaryTransition * rule.multiplier;
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
      };
    });
  }, [salaryTransition, actuals]);

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
    handleClearAll,
    rulesWithAmounts,
    ruleMap,
  };
}
