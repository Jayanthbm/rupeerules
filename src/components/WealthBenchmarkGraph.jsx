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

export default function WealthBenchmarkGraph({
  selectedMetric,
  onSelectMetric,
  filteredBreakdowns,
  selectedYear,
}) {
  const activeMetricConfig = WEALTH_METRICS.find((m) => m.id === selectedMetric) || WEALTH_METRICS[0];

  const chartMax = Math.max(
    ...filteredBreakdowns.map((d) => Math.max(d[selectedMetric] || 0, d[activeMetricConfig.targetKey] || 0)),
    1000
  );

  // Determine current active benchmark note
  const sampleRow = filteredBreakdowns.find((r) => r.salary > 0) || filteredBreakdowns[0] || {};
  const dynamicCapLabel =
    selectedMetric === "emergencyFund"
      ? (sampleRow.emergencySource || "6× Monthly Salary")
      : selectedMetric === "fireCorpus"
      ? (sampleRow.fireSource || "120× Monthly Salary")
      : activeMetricConfig.capLabel;

  return (
    <div className="mrc-report-section-card">
      <div className="mrc-wealth-report-head">
        <div>
          <h2>Wealth &amp; Obligations Benchmark Graph</h2>
          <p className="mrc-report-subtext">
            {activeMetricConfig.desc}
            {selectedMetric === "emergencyFund" && sampleRow.isEmergencyAdaptive && (
              <span className="mrc-calc-mode-badge" style={{ marginLeft: "8px", background: "rgba(190,24,93,0.12)", color: "#be185d" }}>
                🎯 Adaptive: 6-Mo Non-negotiable Expenses
              </span>
            )}
            {selectedMetric === "fireCorpus" && sampleRow.isFireAdaptive && (
              <span className="mrc-calc-mode-badge" style={{ marginLeft: "8px", background: "rgba(202,138,4,0.12)", color: "#ca8a04" }}>
                🔥 Adaptive: 25× Annual Real Spending
              </span>
            )}
          </p>
        </div>
        <div className="mrc-wealth-tab-pill-group">
          {WEALTH_METRICS.map((metric) => (
            <button
              key={metric.id}
              type="button"
              className={`mrc-wealth-pill ${selectedMetric === metric.id ? "mrc-wealth-pill-active" : ""}`}
              style={{ "--pill-color": metric.color }}
              onClick={() => onSelectMetric(metric.id)}
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
            Recommended Benchmark: <strong>{dynamicCapLabel}</strong>
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
                if (prevVal !== null) {
                  const mom = prevVal > 0 ? Math.round(((actualVal - prevVal) / prevVal) * 100) : (actualVal > 0 ? 100 : 0);
                  if (mom < 0) {
                    badgeText = `${mom}% (Paid down)`;
                    badgeColor = "#16a34a";
                  } else if (mom > 0) {
                    badgeText = `+${mom}% (Increased)`;
                    badgeColor = actualVal > targetVal ? "#dc2626" : "#ca8a04";
                  } else {
                    badgeText = "0% (Same)";
                    badgeColor = "var(--mrc-text-muted)";
                  }
                }
              } else if (targetVal > 0) {
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
                        title={`Benchmark: ${formatMoney(targetVal)}`}
                      />
                    )}
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
  );
}
