import { useMemo } from "react";
import { formatMoney } from "../utils/formatters";
import { formatMonthLabel } from "../utils/storage";

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

export default function SpendingTrendsGraph({
  selectedSpendingMetric,
  onSelectSpendingMetric,
  filteredBreakdowns,
  selectedYear,
}) {
  const activeSpendingConfig = SPENDING_TREND_METRICS.find((m) => m.id === selectedSpendingMetric) || SPENDING_TREND_METRICS[0];

  const spendingChartMax = Math.max(
    ...filteredBreakdowns.map((d) => {
      const val = d[activeSpendingConfig.dataKey] || 0;
      const target = activeSpendingConfig.targetKey ? (d[activeSpendingConfig.targetKey] || 0) : 0;
      return Math.max(val, target);
    }),
    1000
  );

  // SVG Line/Area calculations for Salary
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

    return { points, pathD, areaD, width, height };
  }, [selectedSpendingMetric, filteredBreakdowns]);

  return (
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
              onClick={() => onSelectSpendingMetric(metric.id)}
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

              {salaryChartData.areaD && (
                <path d={salaryChartData.areaD} fill="url(#salaryGradient)" />
              )}

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
          <div className="mrc-chart-bars-wrap">
            {filteredBreakdowns.length === 0 ? (
              <div className="mrc-chart-empty-text">No records for {selectedYear}</div>
            ) : (
              filteredBreakdowns.map((row, idx) => {
                const actualVal = row[activeSpendingConfig.dataKey] || 0;
                const targetVal = activeSpendingConfig.targetKey ? (row[activeSpendingConfig.targetKey] || 0) : 0;
                const actualPct = Math.min(100, Math.max(0, (actualVal / spendingChartMax) * 100));
                const targetPct = targetVal > 0 ? Math.min(100, Math.max(0, (targetVal / spendingChartMax) * 100)) : 0;

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
                      {targetVal > 0 && (
                        <div
                          className="mrc-chart-benchmark-marker"
                          style={{ bottom: `${targetPct}%` }}
                          title={`Target: ${formatMoney(targetVal)}`}
                        />
                      )}
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
  );
}
