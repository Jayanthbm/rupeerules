export const CURRENCY = "₹";

export function formatMoney(amount) {
  return CURRENCY + amount.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

/** Format a number for display in the salary input field (Indian numbering system: lakhs/crores). */
export function formatSalaryInput(value) {
  if (value === 0 || !value) return "";
  return Math.round(value).toLocaleString("en-IN");
}

/** Strip formatting and return raw numeric string. */
export function stripFormatting(str) {
  if (typeof str !== "string") return String(str ?? "");
  return str.replace(/[^0-9.]/g, "");
}

/** Nice label for the rule number badge. */
export function badgeLabel(id) {
  return id <= 5 ? `S${id}` : `W${id - 5}`;
}
