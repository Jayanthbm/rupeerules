export const STORAGE_KEY = "rupeerules_store_v2";
export const LEGACY_STORAGE_KEY = "mrc_state_v1";

/** Format Date object to YYYY-MM string */
export function getCurrentMonthKey(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Format YYYY-MM to human-friendly string (e.g. Sep 2026) */
export function formatMonthLabel(monthKey) {
  if (!monthKey || !monthKey.includes("-")) return monthKey;
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

/** Clean up empty values in actuals map */
export function cleanActuals(actuals) {
  if (!actuals || typeof actuals !== "object") return {};
  const cleaned = {};
  for (const [id, val] of Object.entries(actuals)) {
    if (val !== 0 && val !== "" && val !== undefined && val !== null) {
      cleaned[id] = val;
    }
  }
  return cleaned;
}

/** Clean up empty breakdown rows */
export function cleanBreakdownItems(items) {
  if (!items || typeof items !== "object") return {};
  const cleaned = {};
  for (const [ruleId, list] of Object.entries(items)) {
    if (Array.isArray(list)) {
      cleaned[ruleId] = list.filter((it) => it && (it.name || it.amount));
    }
  }
  return cleaned;
}

/** Load store supporting multi-month with legacy v1 migration */
export function loadAllData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.months === "object") {
        return parsed;
      }
    }

    // Check legacy v1 data to migrate
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy && (typeof legacy.salary === "number" || typeof legacy.actuals === "object")) {
        const currentMonth = getCurrentMonthKey();
        const migrated = {
          activeMonth: currentMonth,
          months: {
            [currentMonth]: {
              salary: legacy.salary || 0,
              actuals: legacy.actuals || {},
              items: legacy.items || {},
              updatedAt: legacy.updatedAt || Date.now(),
            },
          },
        };
        saveAllData(migrated);
        return migrated;
      }
    }
  } catch {
    // Ignore corrupt store
  }

  const defaultMonth = getCurrentMonthKey();
  return {
    activeMonth: defaultMonth,
    months: {},
  };
}

export function saveAllData(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
}

export function exportBackupJSON() {
  const data = loadAllData();
  const payload = {
    appName: "RupeeRules",
    version: 2,
    exportedAt: new Date().toISOString(),
    data,
  };
  return JSON.stringify(payload, null, 2);
}

export function importBackupJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed) throw new Error("Invalid JSON format");

    let monthsData = null;
    let activeMonth = getCurrentMonthKey();

    if (parsed.data && parsed.data.months) {
      monthsData = parsed.data.months;
      activeMonth = parsed.data.activeMonth || activeMonth;
    } else if (parsed.months) {
      monthsData = parsed.months;
      activeMonth = parsed.activeMonth || activeMonth;
    } else if (typeof parsed.salary === "number") {
      // Single month snapshot
      monthsData = {
        [activeMonth]: {
          salary: parsed.salary,
          actuals: parsed.actuals || {},
          items: parsed.items || {},
          updatedAt: Date.now(),
        },
      };
    }

    if (!monthsData || typeof monthsData !== "object") {
      throw new Error("Missing valid financial records in backup");
    }

    const newStore = {
      activeMonth,
      months: monthsData,
    };

    saveAllData(newStore);
    return { success: true, count: Object.keys(monthsData).length };
  } catch (err) {
    return { success: false, error: err.message || "Failed to parse import file" };
  }
}

export function clearSavedState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem("mrc_darkmode");
  } catch {
    // Ignore errors
  }
}
