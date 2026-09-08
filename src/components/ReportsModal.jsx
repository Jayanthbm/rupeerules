import { useMemo } from "react";
import { formatMoney } from "../utils/formatters";
import { formatMonthLabel } from "../utils/storage";
import { SPENDING_RULES } from "../rules";

function computeReportsData(months) {
  if (!months || typeof months !== "object") {
    return {
      monthlyBreakdowns: [],
      totalTrackedSpending: 0,
      avgSavingsRate: 0,
      activeMonthCount: 0,
    };
  }

  const monthKeys = Object.keys(months).sort();
  let trackedSalary = 0;
  let trackedSpending = 0;
  let trackedInvested = 0;
  let monthCount = 0;

  const list = monthKeys.map((key) => {
    const data = months[key] || {};
    const sal = data.salary || 0;
    const act = data.actuals || {};

    const essentials = Number(act[1]) || 0;
    const guiltFree = Number(act[2]) || 0;
    const debt = Number(act[3]) || 0;
    const goals = Number(act[4]) || 0;
    const wealth = Number(act[5]) || 0;

    const totalSpending = essentials + guiltFree + debt + goals + wealth;

    if (sal > 0) {
      trackedSalary += sal;
      trackedSpending += totalSpending;
      trackedInvested += (wealth + goals);
      monthCount++;
    }

    const savingsRate = sal > 0 ? Math.round(((goals + wealth) / sal) * 100) : 0;

    return {
      monthKey: key,
      salary: sal,
      essentials,
      guiltFree,
      debt,
      goals,
      wealth,
      totalSpending,
      savingsRate,
      diff: sal - totalSpending,
    };
  });

  const averageRate = monthCount > 0 && trackedSalary > 0
    ? Math.round((trackedInvested / trackedSalary) * 100)
    : 0;

  return {
    monthlyBreakdowns: list,
    totalTrackedSpending: trackedSpending,
    avgSavingsRate: averageRate,
    activeMonthCount: monthCount,
  };
}

export default function ReportsModal({ isOpen, onClose, store }) {
  const reports = useMemo(() => {
    return computeReportsData(store?.months);
  }, [store]);

  if (!isOpen) return null;

  const { monthlyBreakdowns, totalTrackedSpending, avgSavingsRate, activeMonthCount } = reports;

  return (
    <div className="mrc-modal-overlay" onClick={onClose}>
      <div className="mrc-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="mrc-modal-header">
          <div className="mrc-modal-title-group">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <h2>Financial History &amp; Reports</h2>
          </div>
          <button type="button" className="mrc-modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="mrc-modal-body">
          {monthlyBreakdowns.length === 0 || activeMonthCount === 0 ? (
            <div className="mrc-modal-empty">
              <p>No monthly records yet. Enter your take-home pay and allocations in any month to view trends.</p>
            </div>
          ) : (
            <>
              {/* Overall Summary Cards */}
              <div className="mrc-reports-stats-grid">
                <div className="mrc-report-stat-card">
                  <span className="mrc-report-stat-label">Months Recorded</span>
                  <span className="mrc-report-stat-val">{activeMonthCount}</span>
                </div>
                <div className="mrc-report-stat-card">
                  <span className="mrc-report-stat-label">Avg Savings / Wealth Rate</span>
                  <span className="mrc-report-stat-val" style={{ color: "#059669" }}>{avgSavingsRate}%</span>
                </div>
                <div className="mrc-report-stat-card">
                  <span className="mrc-report-stat-label">Total Allocated</span>
                  <span className="mrc-report-stat-val">{formatMoney(totalTrackedSpending)}</span>
                </div>
              </div>

              {/* Monthly Trend List */}
              <div className="mrc-report-section">
                <h3>Monthly Breakdown History</h3>
                <div className="mrc-report-table-wrap">
                  <table className="mrc-report-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Salary</th>
                        <th>Essentials (55%)</th>
                        <th>Guilt-Free (5%)</th>
                        <th>Debt / Invest (10%)</th>
                        <th>Goals (15%)</th>
                        <th>Wealth (15%)</th>
                        <th>Savings Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyBreakdowns.map((row) => (
                        <tr key={row.monthKey}>
                          <td className="mrc-tbl-month"><strong>{formatMonthLabel(row.monthKey)}</strong></td>
                          <td>{formatMoney(row.salary)}</td>
                          <td>{formatMoney(row.essentials)}</td>
                          <td>{formatMoney(row.guiltFree)}</td>
                          <td>{formatMoney(row.debt)}</td>
                          <td>{formatMoney(row.goals)}</td>
                          <td>{formatMoney(row.wealth)}</td>
                          <td>
                            <span className="mrc-rate-badge" style={{ color: row.savingsRate >= 30 ? "#16a34a" : "#ca8a04" }}>
                              {row.savingsRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rules Reference Target vs Real */}
              <div className="mrc-report-section">
                <h3>Standard Target Split vs Adherence</h3>
                <div className="mrc-rules-ref-grid">
                  {SPENDING_RULES.map((rule) => (
                    <div key={rule.id} className="mrc-rules-ref-item" style={{ "--item-color": rule.color }}>
                      <span className="mrc-ref-badge" style={{ backgroundColor: rule.color }}>
                        {rule.multiplier * 100}%
                      </span>
                      <div className="mrc-ref-info">
                        <strong>{rule.title}</strong>
                        <span>{rule.subtitle}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
