import { useState, useMemo } from "react";
import { formatMoney } from "../utils/formatters";
import { formatMonthLabel } from "../utils/storage";

const WEALTH_METRICS = [
  {
    id: "maxEmi",
    ruleId: 6,
    title: "Total EMI",
    capLabel: "40% Salary Cap",
    color: "#6b21a8",
    targetKey: "targetMaxEmi",
    unit: "monthly",
    desc: "Combined loan EMIs compared against 40% salary threshold and debt trend.",
  },
  {
    id: "emergencyFund",
    ruleId: 7,
    title: "Emergency",
    capLabel: "6 Months Buffer",
    color: "#be185d",
    targetKey: "targetEmergency",
    unit: "total",
    desc: "Liquid reserves runway compared against 6 months living expenses.",
  },
  {
    id: "fireCorpus",
    ruleId: 8,
    title: "FIRE",
    capLabel: "120x Monthly Salary",
    color: "#ca8a04",
    targetKey: "targetFire",
    unit: "total",
    desc: "Total invested net worth compared against retirement milestone.",
  },
];

const SPENDING_TREND_METRICS = [
  {
    id: "salary",
    title: "Salary",
    color: "#0f766e",
    dataKey: "salary",
    targetKey: null,
    benchmarkLabel: null,
    desc: "Monthly take-home pay progression and income trajectory over time.",
  },
  {
    id: "investments",
    title: "Investments",
    color: "#059669",
    dataKey: "wealth",
    targetKey: "targetWealth",
    benchmarkLabel: "15% Target",
    desc: "Long-term monthly wealth contributions (SIPs, stocks, PPF, Gold) against 15% target.",
  },
  {
    id: "goals",
    title: "Goals",
    color: "#d97706",
    dataKey: "goals",
    targetKey: "targetGoals",
    benchmarkLabel: "15% Target",
    desc: "Short-term savings for bike, wedding, gadget, or vacations against 15% target.",
  },
  {
    id: "essentials",
    title: "Essentials",
    color: "#2563eb",
    dataKey: "essentials",
    targetKey: "targetEssentials",
    benchmarkLabel: "55% Max Cap",
    desc: "Rent, groceries, utilities, and transport actuals against 55% target ceiling.",
  },
  {
    id: "guiltFree",
    title: "Guilt Free",
    color: "#7c3aed",
    dataKey: "guiltFree",
    targetKey: "targetGuiltFree",
    benchmarkLabel: "5% Standard Split",
    desc: "Dining, hobbies, and personal discretionary expenses against 5% target.",
  },
];

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

    // Wealth / Obligations actuals
    const maxEmi = Number(act[6]) || 0;
    const emergencyFund = Number(act[7]) || 0;
    const fireCorpus = Number(act[8]) || 0;

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
      maxEmi,
      emergencyFund,
      fireCorpus,
      targetEssentials: sal * 0.55,
      targetGuiltFree: sal * 0.05,
      targetDebt: sal * 0.10,
      targetGoals: sal * 0.15,
      targetWealth: sal * 0.15,
      targetMaxEmi: sal * 0.4,
      targetEmergency: sal * 6,
      targetFire: sal * 120,
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

export default function ReportsPage({ onBackToCalculator, store }) {
  const [selectedMetric, setSelectedMetric] = useState("emergencyFund");
  const [selectedSpendingMetric, setSelectedSpendingMetric] = useState("salary");
  const [selectedYear, setSelectedYear] = useState("ALL");

  const reports = useMemo(() => {
    return computeReportsData(store?.months);
  }, [store]);

  const { monthlyBreakdowns, activeMonthCount } = reports;
  const activeMetricConfig = WEALTH_METRICS.find((m) => m.id === selectedMetric) || WEALTH_METRICS[0];
  const activeSpendingConfig = SPENDING_TREND_METRICS.find((m) => m.id === selectedSpendingMetric) || SPENDING_TREND_METRICS[0];

  // Extract available distinct years from monthlyBreakdowns in chronological order (2025, 2026, ...)
  const availableYears = useMemo(() => {
    const years = new Set();
    monthlyBreakdowns.forEach((r) => {
      if (r.monthKey && r.monthKey.includes("-")) {
        years.add(r.monthKey.split("-")[0]);
      }
    });
    return Array.from(years).sort((a, b) => Number(a) - Number(b));
  }, [monthlyBreakdowns]);

  // Filter breakdown rows based on selectedYear
  const filteredBreakdowns = useMemo(() => {
    if (selectedYear === "ALL") return monthlyBreakdowns;
    return monthlyBreakdowns.filter((r) => r.monthKey.startsWith(selectedYear));
  }, [monthlyBreakdowns, selectedYear]);

  // Max value calculation for proportional chart scaling (Wealth)
  const chartMax = Math.max(
    ...filteredBreakdowns.map((d) => Math.max(d[selectedMetric] || 0, d[activeMetricConfig.targetKey] || 0)),
    1000
  );

  // Max value calculation for proportional chart scaling (Spending & Income)
  const spendingChartMax = Math.max(
    ...filteredBreakdowns.map((d) => {
      const val = d[activeSpendingConfig.dataKey] || 0;
      const target = activeSpendingConfig.targetKey ? (d[activeSpendingConfig.targetKey] || 0) : 0;
      return Math.max(val, target);
    }),
    1000
  );

  // Helper for Salary SVG Line/Area Chart coordinates
  const salaryChartData = useMemo(() => {
    if (selectedSpendingMetric !== "salary" || filteredBreakdowns.length === 0) return null;
    const maxVal = Math.max(...filteredBreakdowns.map((d) => d.salary || 0), 1000);
    const minVal = 0;
    const width = 800;
    const height = 180;
    const paddingX = 40;
    const paddingY = 30;

    const points = filteredBreakdowns.map((row, idx) => {
      const x = filteredBreakdowns.length === 1
        ? width / 2
        : paddingX + (idx / (filteredBreakdowns.length - 1)) * (width - 2 * paddingX);
      const y = height - paddingY - ((row.salary - minVal) / (maxVal - minVal)) * (height - 2 * paddingY);
      return { x, y, row, idx };
    });

    const pathD = points.length > 1
      ? points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "")
      : "";

    const areaD = points.length > 1
      ? `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
      : "";

    return { points, pathD, areaD, width, height, maxVal, minVal };
  }, [selectedSpendingMetric, filteredBreakdowns]);

  return (
    <div className="mrc-reports-page">
      <div className="mrc-page-nav-bar">
        <button
          type="button"
          className="mrc-back-btn"
          onClick={onBackToCalculator}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Calculator
        </button>
        <h1 className="mrc-page-title">Financial Reports &amp; Analytics</h1>

        {availableYears.length > 0 && (
          <div className="mrc-header-year-pills">
            <button
              type="button"
              className={`mrc-year-pill ${selectedYear === "ALL" ? "mrc-year-pill-active" : ""}`}
              onClick={() => setSelectedYear("ALL")}
            >
              All
            </button>
            {availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                className={`mrc-year-pill ${selectedYear === yr ? "mrc-year-pill-active" : ""}`}
                onClick={() => setSelectedYear(yr)}
              >
                {yr}
              </button>
            ))}
          </div>
        )}
      </div>

      {monthlyBreakdowns.length === 0 || activeMonthCount === 0 ? (
        <div className="mrc-reports-empty-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <h3>No Monthly Records Yet</h3>
          <p>Enter your take-home salary and allocation actuals in the calculator to generate multi-month analytics.</p>
          <button type="button" className="mrc-action-btn mrc-btn-primary" onClick={onBackToCalculator}>
            Go to Calculator
          </button>
        </div>
      ) : (
        <div className="mrc-reports-container">
          {/* 1. Wealth & Obligations Comparison Visualizer */}
          <div className="mrc-report-section-card">
            <div className="mrc-wealth-report-head">
              <div>
                <h2>Wealth &amp; Obligations Benchmark Graph</h2>
                <p className="mrc-report-subtext">{activeMetricConfig.desc}</p>
              </div>
              <div className="mrc-wealth-tab-pill-group">
                {WEALTH_METRICS.map((metric) => (
                  <button
                    key={metric.id}
                    type="button"
                    className={`mrc-wealth-pill ${selectedMetric === metric.id ? "mrc-wealth-pill-active" : ""}`}
                    style={{ "--pill-color": metric.color }}
                    onClick={() => setSelectedMetric(metric.id)}
                  >
                    {metric.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="mrc-chart-card">
              <div className="mrc-chart-legend">
                <span className="mrc-legend-item">
                  <span className="mrc-legend-dot" style={{ backgroundColor: activeMetricConfig.color }} />
                  Actual Amount (0 if unrecorded)
                </span>
                <span className="mrc-legend-item">
                  <span className="mrc-legend-line" />
                  Recommended Benchmark ({activeMetricConfig.capLabel})
                </span>
              </div>

              <div className="mrc-chart-bars-wrap">
                {filteredBreakdowns.length === 0 ? (
                  <div className="mrc-chart-empty-text">No records for {selectedYear}</div>
                ) : (
                  filteredBreakdowns.map((row, idx) => {
                    const actualVal = row[selectedMetric] || 0;
                    const targetVal = row[activeMetricConfig.targetKey] || 0;
                    const actualPct = Math.min(100, Math.max(0, (actualVal / chartMax) * 100));
                    const targetPct = Math.min(100, Math.max(0, (targetVal / chartMax) * 100));

                    // MoM calculation for Wealth/Obligations
                    const prevRow = idx > 0 ? filteredBreakdowns[idx - 1] : null;
                    const prevVal = prevRow ? (prevRow[selectedMetric] || 0) : null;

                    let badgeText = "Base";
                    let badgeColor = "var(--mrc-text-muted)";

                    if (selectedMetric === "maxEmi") {
                      // For Total EMI: show MoM delta and warning if over cap
                      if (prevVal !== null) {
                        const mom = prevVal > 0 ? Math.round(((actualVal - prevVal) / prevVal) * 100) : (actualVal > 0 ? 100 : 0);
                        if (mom < 0) {
                          badgeText = `${mom}% (Paid down)`;
                          badgeColor = "#16a34a"; // Reducing EMI is positive
                        } else if (mom > 0) {
                          badgeText = `+${mom}% (Increased)`;
                          badgeColor = actualVal > targetVal ? "#dc2626" : "#ca8a04";
                        } else {
                          badgeText = "0% (Same)";
                          badgeColor = "var(--mrc-text-muted)";
                        }
                      }
                    } else {
                      // For Emergency & FIRE: show % of benchmark reached + remaining %
                      if (targetVal > 0) {
                        const reachedPct = Math.min(999, Math.round((actualVal / targetVal) * 100));
                        const toGoPct = Math.max(0, 100 - reachedPct);
                        if (reachedPct >= 100) {
                          badgeText = "100% (Achieved)";
                          badgeColor = "#16a34a";
                        } else {
                          badgeText = `${reachedPct}% (${toGoPct}% to go)`;
                          badgeColor = reachedPct >= 50 ? "#059669" : "#ca8a04";
                        }
                      }
                    }

                    return (
                      <div key={row.monthKey} className="mrc-chart-col">
                        <div className="mrc-chart-val-bubble">
                          {formatMoney(actualVal)}
                        </div>
                        <div className="mrc-chart-track">
                          {/* Target Benchmark Line */}
                          {targetVal > 0 && (
                            <div
                              className="mrc-chart-benchmark-marker"
                              style={{ bottom: `${targetPct}%` }}
                              title={`Benchmark: ${formatMoney(targetVal)}`}
                            />
                          )}
                          {/* Actual Bar */}
                          <div
                            className="mrc-chart-bar"
                            style={{
                              height: `${Math.max(actualPct, actualVal > 0 ? 6 : 2)}%`,
                              backgroundColor: actualVal > 0 ? activeMetricConfig.color : "var(--mrc-border)",
                              opacity: actualVal > 0 ? 1 : 0.4,
                            }}
                          />
                        </div>
                        <div className="mrc-chart-month-label">
                          <strong>{formatMonthLabel(row.monthKey)}</strong>
                          <span className="mrc-chart-adherence-tag" style={{ color: badgeColor }}>
                            {badgeText}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 2. Spending, Income & Investment Trends Graph */}
          <div className="mrc-report-section-card">
            <div className="mrc-wealth-report-head">
              <div>
                <h2>Income, Spending &amp; Investment Trends</h2>
                <p className="mrc-report-subtext">{activeSpendingConfig.desc}</p>
              </div>
              <div className="mrc-wealth-tab-pill-group">
                {SPENDING_TREND_METRICS.map((metric) => (
                  <button
                    key={metric.id}
                    type="button"
                    className={`mrc-wealth-pill ${selectedSpendingMetric === metric.id ? "mrc-wealth-pill-active" : ""}`}
                    style={{ "--pill-color": metric.color }}
                    onClick={() => setSelectedSpendingMetric(metric.id)}
                  >
                    {metric.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="mrc-chart-card">
              <div className="mrc-chart-legend">
                <span className="mrc-legend-item">
                  <span className="mrc-legend-dot" style={{ backgroundColor: activeSpendingConfig.color }} />
                  {activeSpendingConfig.title} (vs previous month % change)
                </span>
                {activeSpendingConfig.benchmarkLabel && (
                  <span className="mrc-legend-item">
                    <span className="mrc-legend-line" />
                    Target Guideline ({activeSpendingConfig.benchmarkLabel})
                  </span>
                )}
              </div>

              {/* Special Curve Graph for Salary */}
              {selectedSpendingMetric === "salary" && salaryChartData ? (
                <div className="mrc-salary-curve-container">
                  <svg
                    viewBox={`0 0 ${salaryChartData.width} ${salaryChartData.height}`}
                    className="mrc-salary-curve-svg"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="salaryGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f766e" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {/* Area fill */}
                    {salaryChartData.areaD && (
                      <path d={salaryChartData.areaD} fill="url(#salaryGradient)" />
                    )}

                    {/* Trend Line */}
                    {salaryChartData.pathD && (
                      <path
                        d={salaryChartData.pathD}
                        fill="none"
                        stroke="#0f766e"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Data Points */}
                    {salaryChartData.points.map((p) => (
                      <g key={p.row.monthKey}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="5"
                          fill="#0f766e"
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                      </g>
                    ))}
                  </svg>

                  {/* Monthly Labels & MoM Hikes underneath curve */}
                  <div className="mrc-salary-curve-labels">
                    {filteredBreakdowns.map((row, idx) => {
                      const prevRow = idx > 0 ? filteredBreakdowns[idx - 1] : null;
                      const prevVal = prevRow ? (prevRow.salary || 0) : null;
                      let momLabel = "Base";
                      let momColor = "var(--mrc-text-muted)";

                      if (prevVal !== null) {
                        const diff = (row.salary || 0) - prevVal;
                        if (diff > 0) {
                          const pct = Math.round((diff / prevVal) * 100);
                          momLabel = `+${pct}% (Hike)`;
                          momColor = "#16a34a";
                        } else if (diff < 0) {
                          const pct = Math.round((diff / prevVal) * 100);
                          momLabel = `${pct}%`;
                          momColor = "#dc2626";
                        } else {
                          momLabel = "0% (Steady)";
                          momColor = "var(--mrc-text-muted)";
                        }
                      }

                      return (
                        <div key={row.monthKey} className="mrc-salary-node-label">
                          <span className="mrc-salary-node-val">{formatMoney(row.salary)}</span>
                          <strong>{formatMonthLabel(row.monthKey)}</strong>
                          <span className="mrc-chart-adherence-tag" style={{ color: momColor }}>
                            {momLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Bar Visualizer with MoM and Guideline marker for Investments, Goals, Essentials, Guilt Free */
                <div className="mrc-chart-bars-wrap">
                  {filteredBreakdowns.length === 0 ? (
                    <div className="mrc-chart-empty-text">No records for {selectedYear}</div>
                  ) : (
                    filteredBreakdowns.map((row, idx) => {
                      const actualVal = row[activeSpendingConfig.dataKey] || 0;
                      const targetVal = activeSpendingConfig.targetKey ? (row[activeSpendingConfig.targetKey] || 0) : 0;
                      const actualPct = Math.min(100, Math.max(0, (actualVal / spendingChartMax) * 100));
                      const targetPct = targetVal > 0 ? Math.min(100, Math.max(0, (targetVal / spendingChartMax) * 100)) : 0;

                      // Compute Month-over-Month (MoM) change against previous recorded value
                      const prevRow = idx > 0 ? filteredBreakdowns[idx - 1] : null;
                      const prevVal = prevRow ? (prevRow[activeSpendingConfig.dataKey] || 0) : null;

                      let momPctText = "Base";
                      let momColor = "var(--mrc-text-muted)";

                      if (prevVal !== null) {
                        if (prevVal === 0 && actualVal > 0) {
                          momPctText = "+100%";
                          momColor = "#16a34a";
                        } else if (prevVal === 0 && actualVal === 0) {
                          momPctText = "0%";
                          momColor = "var(--mrc-text-muted)";
                        } else {
                          const momChange = ((actualVal - prevVal) / prevVal) * 100;
                          const rounded = Math.round(momChange);
                          if (rounded > 0) {
                            momPctText = `+${rounded}%`;
                            if (activeSpendingConfig.id === "essentials" || activeSpendingConfig.id === "guiltFree") {
                              momColor = rounded > 10 ? "#dc2626" : "#ca8a04";
                            } else {
                              momColor = "#16a34a";
                            }
                          } else if (rounded < 0) {
                            momPctText = `${rounded}%`;
                            if (activeSpendingConfig.id === "essentials" || activeSpendingConfig.id === "guiltFree") {
                              momColor = "#16a34a";
                            } else {
                              momColor = "#dc2626";
                            }
                          } else {
                            momPctText = "0%";
                            momColor = "var(--mrc-text-muted)";
                          }
                        }
                      }

                      return (
                        <div key={row.monthKey} className="mrc-chart-col">
                          <div className="mrc-chart-val-bubble">
                            {formatMoney(actualVal)}
                          </div>
                          <div className="mrc-chart-track">
                            {/* Target Benchmark Line */}
                            {targetVal > 0 && (
                              <div
                                className="mrc-chart-benchmark-marker"
                                style={{ bottom: `${targetPct}%` }}
                                title={`Target: ${formatMoney(targetVal)}`}
                              />
                            )}
                            {/* Actual Bar */}
                            <div
                              className="mrc-chart-bar"
                              style={{
                                height: `${Math.max(actualPct, actualVal > 0 ? 6 : 2)}%`,
                                backgroundColor: actualVal > 0 ? activeSpendingConfig.color : "var(--mrc-border)",
                                opacity: actualVal > 0 ? 1 : 0.4,
                              }}
                            />
                          </div>
                          <div className="mrc-chart-month-label">
                            <strong>{formatMonthLabel(row.monthKey)}</strong>
                            <span className="mrc-chart-adherence-tag" style={{ color: momColor }}>
                              {momPctText}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. Monthly Trend Table */}
          <div className="mrc-report-section-card">
            <div className="mrc-ledger-card-header">
              <h2>Multi-Month Ledger History</h2>
              <span className="mrc-ledger-count">
                Showing {filteredBreakdowns.length} {filteredBreakdowns.length === 1 ? "month" : "months"}
              </span>
            </div>
            <div className="mrc-report-table-wrap">
              <table className="mrc-report-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Salary</th>
                    <th>Essentials (55%)</th>
                    <th>Guilt-Free (5%)</th>
                    <th>Debt (10%)</th>
                    <th>Goals (15%)</th>
                    <th>Investments (15%)</th>
                    <th>Total EMI</th>
                    <th>Emergency</th>
                    <th>FIRE</th>
                    <th>Savings Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBreakdowns.map((row) => (
                    <tr key={row.monthKey}>
                      <td className="mrc-tbl-month"><strong>{formatMonthLabel(row.monthKey)}</strong></td>
                      <td>{formatMoney(row.salary)}</td>
                      <td>{formatMoney(row.essentials)}</td>
                      <td>{formatMoney(row.guiltFree)}</td>
                      <td>{formatMoney(row.debt)}</td>
                      <td>{formatMoney(row.goals)}</td>
                      <td>{formatMoney(row.wealth)}</td>
                      <td>
                        <span style={{ color: row.maxEmi > row.targetMaxEmi && row.targetMaxEmi > 0 ? "#dc2626" : "inherit" }}>
                          {formatMoney(row.maxEmi)}
                        </span>
                      </td>
                      <td>{formatMoney(row.emergencyFund)}</td>
                      <td>{formatMoney(row.fireCorpus)}</td>
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
        </div>
      )}
    </div>
  );
}
