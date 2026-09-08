import { formatMoney } from "../utils/formatters";

export default function SpendingAllocationSummary({ salary, ruleMap }) {
  if (salary <= 0) return null;

  // Spending rules are 1..5
  const spendingRules = [1, 2, 3, 4, 5].map((id) => ruleMap[id]).filter(Boolean);

  let totalAllocated = 0;
  let enteredCount = 0;

  for (const item of spendingRules) {
    if (item.actualRaw !== "" && item.actualRaw !== undefined && item.actualRaw !== null) {
      totalAllocated += item.actual;
      enteredCount++;
    }
  }

  if (enteredCount === 0) return null;

  const percentAllocated = Math.min(Math.round((totalAllocated / salary) * 100), 999);
  const diff = salary - totalAllocated;
  const isOverBudget = diff < 0;
  const isExact = diff === 0;

  return (
    <div className={`mrc-allocation-summary ${isOverBudget ? "mrc-alloc-over" : isExact ? "mrc-alloc-exact" : "mrc-alloc-under"}`}>
      <div className="mrc-alloc-header">
        <div className="mrc-alloc-title-group">
          <span className="mrc-alloc-title">Monthly Budget Allocation</span>
          <span className="mrc-alloc-percent">
            {percentAllocated}% allocated
          </span>
        </div>
        <div className="mrc-alloc-diff-pill">
          {isOverBudget ? (
            <span>+{formatMoney(Math.abs(diff))} over monthly salary</span>
          ) : isExact ? (
            <span>100% fully allocated (Zero-based)</span>
          ) : (
            <span>{formatMoney(diff)} unallocated surplus</span>
          )}
        </div>
      </div>

      <div className="mrc-alloc-bar">
        <div
          className="mrc-alloc-bar-fill"
          style={{
            width: `${Math.min(percentAllocated, 100)}%`,
            backgroundColor: isOverBudget ? "var(--mrc-warning, #dc2626)" : "var(--mrc-accent, #2563eb)",
          }}
        />
      </div>

      <div className="mrc-alloc-meta">
        <span>Allocated: {formatMoney(totalAllocated)}</span>
        <span>Monthly salary: {formatMoney(salary)}</span>
      </div>
    </div>
  );
}
