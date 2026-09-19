import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  getCurrentMonthKey,
  formatMonthLabel,
  cleanActuals,
  cleanBreakdownItems,
  loadAllData,
  saveAllData,
  exportBackupJSON,
  importBackupJSON,
  clearSavedState,
} from "./storage";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("getCurrentMonthKey", () => {
  it("formats a date as YYYY-MM", () => {
    expect(getCurrentMonthKey(new Date(2026, 8, 15))).toBe("2026-09");
    expect(getCurrentMonthKey(new Date(2026, 0, 1))).toBe("2026-01");
  });
});

describe("formatMonthLabel", () => {
  it("formats YYYY-MM keys as short month + year", () => {
    // Node ICU renders September as "Sept" in en-IN while most browsers use "Sep"
    expect(formatMonthLabel("2026-09")).toMatch(/^(Sep|Sept) 2026$/);
    expect(formatMonthLabel("2025-01")).toBe("Jan 2025");
  });

  it("passes through invalid keys", () => {
    expect(formatMonthLabel("bogus")).toBe("bogus");
  });
});

describe("cleanActuals / cleanBreakdownItems", () => {
  it("drops empty actuals", () => {
    expect(cleanActuals({ 1: 500, 2: "", 3: 0, 4: null, 5: undefined })).toEqual({ 1: 500 });
  });

  it("drops empty breakdown rows but keeps named or valued ones", () => {
    const cleaned = cleanBreakdownItems({
      1: [{ id: "a", name: "Rent", amount: 100 }, { id: "b", name: "", amount: "" }],
      2: "not-an-array",
    });
    expect(cleaned[1]).toEqual([{ id: "a", name: "Rent", amount: 100 }]);
    expect(cleaned[2]).toBeUndefined();
  });
});

describe("loadAllData / saveAllData", () => {
  it("returns a default empty store when nothing saved", () => {
    const store = loadAllData();
    expect(store.months).toEqual({});
    expect(store.activeMonth).toBe(getCurrentMonthKey());
  });

  it("persists and reloads a store", () => {
    const store = { activeMonth: "2026-09", months: { "2026-09": { salary: 100000, actuals: {}, items: {} } } };
    saveAllData(store);
    expect(loadAllData()).toEqual(store);
  });

  it("migrates legacy v1 data into the current month", () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({ salary: 90000, actuals: { 1: 40000 }, items: {}, updatedAt: 123 })
    );
    const store = loadAllData();
    const monthData = store.months[store.activeMonth];
    expect(monthData.salary).toBe(90000);
    expect(monthData.actuals).toEqual({ 1: 40000 });
  });

  it("survives corrupt JSON in storage", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadAllData().months).toEqual({});
  });
});

describe("exportBackupJSON / importBackupJSON", () => {
  it("round-trips a store through export and import", () => {
    const store = {
      activeMonth: "2026-09",
      months: {
        "2026-09": { salary: 150000, actuals: { 1: 75000 }, items: { 1: [{ id: "x", name: "Rent", amount: 40000 }] } },
        "2026-08": { salary: 145000, actuals: { 1: 72000 }, items: {} },
      },
    };
    saveAllData(store);
    const json = exportBackupJSON();
    const parsed = JSON.parse(json);
    expect(parsed.appName).toBe("RupeeRules");
    expect(parsed.version).toBe(2);

    localStorage.clear();
    const result = importBackupJSON(json);
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(loadAllData().months).toEqual(store.months);
  });

  it("imports a single-month snapshot format", () => {
    const result = importBackupJSON(JSON.stringify({ salary: 80000, actuals: { 1: 40000 }, items: {} }));
    expect(result.success).toBe(true);
    expect(loadAllData().months[getCurrentMonthKey()].salary).toBe(80000);
  });

  it("rejects invalid JSON and missing data", () => {
    expect(importBackupJSON("not json").success).toBe(false);
    expect(importBackupJSON(JSON.stringify({ foo: 1 })).success).toBe(false);
    expect(importBackupJSON(null).success).toBe(false);
  });
});

describe("clearSavedState", () => {
  it("removes app keys but leaves other data intact", () => {
    localStorage.setItem(STORAGE_KEY, "{}");
    localStorage.setItem(LEGACY_STORAGE_KEY, "{}");
    localStorage.setItem("mrc_darkmode", "true");
    localStorage.setItem("unrelated", "keep-me");

    clearSavedState();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem("mrc_darkmode")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep-me");
  });
});
