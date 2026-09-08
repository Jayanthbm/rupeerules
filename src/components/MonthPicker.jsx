import { formatMonthLabel } from "../utils/storage";

export default function MonthPicker({ activeMonth, onSwitchMonth, onCopyPrevious, months }) {
  const [yearStr, monthStr] = activeMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  const prevMonthDate = new Date(year, month - 2, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const nextMonthDate = new Date(year, month, 1);
  const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const hasPreviousMonthData = Boolean(months?.[prevMonthKey]?.salary > 0 || Object.keys(months?.[prevMonthKey]?.actuals || {}).length > 0);
  const isCurrentMonthEmpty = !months?.[activeMonth]?.salary && Object.keys(months?.[activeMonth]?.actuals || {}).length === 0;

  return (
    <div className="mrc-month-picker">
      <div className="mrc-month-nav">
        <button
          type="button"
          className="mrc-month-btn"
          onClick={() => onSwitchMonth(prevMonthKey)}
          title={`Go to ${formatMonthLabel(prevMonthKey)}`}
          aria-label="Previous month"
        >
          ‹
        </button>

        <div className="mrc-month-display">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="mrc-month-name">{formatMonthLabel(activeMonth)}</span>
        </div>

        <button
          type="button"
          className="mrc-month-btn"
          onClick={() => onSwitchMonth(nextMonthKey)}
          title={`Go to ${formatMonthLabel(nextMonthKey)}`}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {hasPreviousMonthData && isCurrentMonthEmpty && (
        <button
          type="button"
          className="mrc-copy-prev-btn"
          onClick={() => onCopyPrevious(prevMonthKey)}
          title={`Copy allocations from ${formatMonthLabel(prevMonthKey)}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy from {formatMonthLabel(prevMonthKey)}
        </button>
      )}
    </div>
  );
}
