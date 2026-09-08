import { useState, useEffect, useMemo, useCallback } from "react";
import { ALL_RULES } from "../rules";
import { formatSalaryInput, stripFormatting, formatMoney } from "../utils/formatters";
import { loadSavedState, saveState, clearSavedState, isStale } from "../utils/storage";

export function useMoneyRules() {
  const [monthlySalary, setMonthlySalary] = useState(() => {
    const saved = loadSavedState();
    if (saved && !isStale(saved) && saved.salary > 0) {
      return formatSalaryInput(saved.salary);
    }
    return "";
  });

  const [salary, setSalary] = useState(() => {
    const saved = loadSavedState();
    if (saved && !isStale(saved) && saved.salary > 0) {
      return saved.salary;
    }
    return 0;
  });

  const [salaryTransition, setSalaryTransition] = useState(() => {
    const saved = loadSavedState();
    if (saved && !isStale(saved) && saved.salary > 0) {
      return saved.salary;
    }
    return 0;
  });

  const [actuals, setActuals] = useState(() => {
    const saved = loadSavedState();
    if (saved && !isStale(saved) && saved.actuals && typeof saved.actuals === "object") {
      return saved.actuals;
    }
    return {};
  });

  const [activeTab, setActiveTab] = useState("spending");

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

  // Sync to local storage
  useEffect(() => {
    if (salary > 0) {
      saveState(salary, actuals);
    }
  }, [salary, actuals]);

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

  const handleClearAll = useCallback(() => {
    setActuals({});
    setMonthlySalary("");
    setSalary(0);
    setSalaryTransition(0);
    clearSavedState();
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
    salary,
    monthlySalary,
    salaryTransition,
    actuals,
    activeTab,
    setActiveTab,
    handleSalaryChange,
    handleSalaryCommit,
    updateActual,
    handleClearAll,
    rulesWithAmounts,
    ruleMap,
  };
}
