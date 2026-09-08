import { CURRENCY, formatMoney } from "../utils/formatters";
import { HealthScoreCard } from "./CalculatorComponents";

export default function SalaryInput({
  monthlySalary,
  salaryTransition,
  onSalaryChange,
  onSalaryCommit,
  rulesWithAmounts,
}) {
  return (
    <section className="mrc-input-section">
      <label className="mrc-field-label">
        Monthly take-home salary
      </label>
      <div className="mrc-input-row">
        <span className="mrc-input-prefix">{CURRENCY}</span>
        <input
          className="mrc-input"
          type="text"
          inputMode="decimal"
          value={monthlySalary}
          onChange={(e) => onSalaryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSalaryCommit();
            }
          }}
          placeholder="e.g. 50000"
          aria-label="Monthly take-home salary"
        />
        {monthlySalary.trim().length > 0 && (
          <button
            className="mrc-calculate-btn"
            onClick={onSalaryCommit}
            type="button"
          >
            Calculate
          </button>
        )}
      </div>

      {salaryTransition > 0 && (
        <div className="mrc-input-meta">
          <p className="mrc-input-hint">
            Showing rules for <span className="mrc-emphasized">{formatMoney(salaryTransition)}</span>/month
          </p>

          <div className="mrc-health-score">
            <HealthScoreCard rules={rulesWithAmounts} />
          </div>
        </div>
      )}
    </section>
  );
}
