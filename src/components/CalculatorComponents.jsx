import { calculateHealthScore, getHealthStatus } from "../utils/healthScore";

export function HealthScoreCard({ rules }) {
  const score = calculateHealthScore(rules);
  const status = getHealthStatus(score);

  const rulesWithData = rules.filter(
    (r) => r.actualRaw !== "" && r.actualRaw !== undefined && r.actualRaw !== null
  ).length;
  const totalRules = rules.length;

  return (
    <div className="mrc-health-card">
      <div className="mrc-health-header">
        <span className="mrc-health-emoji">{status.emoji}</span>
        <div className="mrc-health-info">
          <span className="mrc-health-label">Financial Health Score</span>
          <span className="mrc-health-sub">{rulesWithData} of {totalRules} rules tracked</span>
        </div>
      </div>
      <div className="mrc-health-score-wrap">
        <div className="mrc-health-score-ring">
          <svg viewBox="0 0 120 120" width="100" height="100">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="var(--mrc-border)"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={status.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${score * 3.3} 330`}
              transform="rotate(-90 60 60)"
              style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }}
            />
            <text
              x="60"
              y="56"
              textAnchor="middle"
              fill="var(--mrc-text)"
              fontSize="28"
              fontWeight="700"
              fontFamily="Inter, sans-serif"
            >
              {score}
            </text>
            <text
              x="60"
              y="74"
              textAnchor="middle"
              fill="var(--mrc-text-muted)"
              fontSize="10"
              fontWeight="500"
              fontFamily="Inter, sans-serif"
            >
              /100
            </text>
          </svg>
        </div>
        <div className="mrc-health-details">
          <div className="mrc-health-status">
            <span
              className="mrc-health-status-badge"
              style={{ backgroundColor: `${status.color}20`, color: status.color, borderColor: status.color }}
            >
              {status.label}
            </span>
          </div>
          <p className="mrc-health-desc">
            {score >= 90 && "You're crushing your money rules!"}
            {score >= 75 && score < 90 && "You're doing well. Keep it up!"}
            {score >= 50 && score < 75 && "You're on the right track. Some areas need attention."}
            {score >= 25 && score < 50 && "There's room for improvement. Focus on the basics first."}
            {score < 25 && "Start with the essentials and build from there."}
          </p>
          <div className="mrc-health-breakdown">
            <BreakdownBar rules={rules} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BreakdownBar({ rules }) {
  const totalRules = rules.length;
  const onTrack = rules.filter(
    (r) => r.actualRaw !== "" && r.actualRaw !== undefined && r.actualRaw !== null && r.status === "on-target"
  ).length;
  const under = rules.filter(
    (r) => r.actualRaw !== "" && r.actualRaw !== undefined && r.actualRaw !== null && r.status === "under"
  ).length;
  const over = rules.filter(
    (r) => r.actualRaw !== "" && r.actualRaw !== undefined && r.actualRaw !== null && r.status === "over"
  ).length;
  const pending = totalRules - onTrack - under - over;

  const total = onTrack + under + over + pending;

  return (
    <div className="mrc-breakdown">
      <div className="mrc-breakdown-bar">
        {onTrack > 0 && (
          <div
            className="mrc-breakdown-seg mrc-breakdown-good"
            style={{ width: `${(onTrack / total) * 100}%` }}
            title={`${onTrack} on target`}
          />
        )}
        {under > 0 && (
          <div
            className="mrc-breakdown-seg mrc-breakdown-info"
            style={{ width: `${(under / total) * 100}%` }}
            title={`${under} under target`}
          />
        )}
        {over > 0 && (
          <div
            className="mrc-breakdown-seg mrc-breakdown-warn"
            style={{ width: `${(over / total) * 100}%` }}
            title={`${over} over target`}
          />
        )}
        {pending > 0 && (
          <div
            className="mrc-breakdown-seg mrc-breakdown-pending"
            style={{ width: `${(pending / total) * 100}%` }}
            title={`${pending} not yet entered`}
          />
        )}
      </div>
      <div className="mrc-breakdown-legend">
        <span className="mrc-breakdown-item">
          <span className="mrc-breakdown-dot mrc-breakdown-good" />
          On target ({onTrack})
        </span>
        <span className="mrc-breakdown-item">
          <span className="mrc-breakdown-dot mrc-breakdown-info" />
          Under ({under})
        </span>
        <span className="mrc-breakdown-item">
          <span className="mrc-breakdown-dot mrc-breakdown-warn" />
          Over ({over})
        </span>
        <span className="mrc-breakdown-item">
          <span className="mrc-breakdown-dot mrc-breakdown-pending" />
          Pending ({pending})
        </span>
      </div>
    </div>
  );
}
