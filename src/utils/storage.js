export const STORAGE_KEY = "mrc_state_v1";
export const STALE_DAYS = 30;

export function isStale(saved) {
  if (!saved || !saved.updatedAt) return true;
  const ageDays = (Date.now() - saved.updatedAt) / (1000 * 60 * 60 * 24);
  return ageDays > STALE_DAYS;
}

export function cleanActuals(actuals) {
  const cleaned = {};
  for (const [id, val] of Object.entries(actuals)) {
    if (val !== 0 && val !== "" && val !== undefined && val !== null) {
      cleaned[id] = val;
    }
  }
  return cleaned;
}

export function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.salary === "number" && typeof parsed.actuals === "object") {
      return parsed;
    }
  } catch {
    // Ignore corrupt data
  }
  return null;
}

export function saveState(salary, actuals) {
  try {
    const payload = {
      salary,
      actuals: cleanActuals(actuals),
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota errors
  }
}

export function clearSavedState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("mrc_darkmode");
  } catch {
    // Ignore errors
  }
}
