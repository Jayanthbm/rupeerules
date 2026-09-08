import NumberTicker from "./NumberTicker";
import { CURRENCY, formatMoney, badgeLabel } from "../utils/formatters";
import { getRuleFeedback } from "../utils/feedback";

export default function RuleCard({ rule, item, onActualChange }) {
  const hasActual = item.actualRaw !== "" && item.actualRaw !== undefined && item.actualRaw !== null;
  const feedback = hasActual ? getRuleFeedback(rule.id, item.status, item.actual, item.recommended) : null;

  const progressStyle = item.progress !== null
    ? {
        width: `${Math.min(item.progress, 100).toFixed(1)}%`,
        backgroundColor: item.status === "over" ? "#dc2626" : "#2563eb",
      }
    : {};

  return (
    <li className="mrc-rule" style={{ "--rule-color": rule.color, "--rule-bg": rule.bg }}>
      <div className="mrc-rule-head">
        <span className="mrc-rule-badge">
          {badgeLabel(rule.id)}
        </span>
        <div className="mrc-rule-title-block">
          <h3 className="mrc-rule-title">{rule.title}</h3>
          <p className="mrc-rule-subtitle">{rule.subtitle}</p>
        </div>
        <div className="mrc-rule-amount-block">
          <div className="mrc-rule-amount">
            <NumberTicker
              value={item.recommended}
              prefix={CURRENCY}
              suffix={rule.suffix || ""}
              duration={200}
            />
          </div>
        </div>
      </div>

      <div className="mrc-rule-note-wrap">
        {feedback ? (
          <p className={`mrc-rule-feedback mrc-feedback-${feedback.type}`}>
            <span className={`mrc-feedback-dot mrc-feedback-dot-${feedback.type}`} />
            {feedback.text}
          </p>
        ) : (
          <p className="mrc-rule-note">{rule.note}</p>
        )}
      </div>

      <div className="mrc-rule-track">
        <div className="mrc-progress">
          <div className="mrc-progress-bg" />
          <div className="mrc-progress-fill" style={progressStyle} />
        </div>

        <div className="mrc-actual-row">
          <label className="mrc-actual-label">
            <span className="mrc-actual-dot" style={{ backgroundColor: rule.color }} />
            {rule.inputLabel || `Actually ${rule.id <= 5 ? "spend / save" : "have / carry"}:`}
          </label>
          <div className="mrc-actual-input-wrap">
            <span className="mrc-actual-prefix">{CURRENCY}</span>
            <input
              className="mrc-actual-input"
              type="text"
              inputMode="decimal"
              value={item.actualRaw === "" ? "" : String(item.actualRaw)}
              onChange={(e) => onActualChange(rule.id, e.target.value)}
              placeholder="0"
              aria-label={`Actual ${rule.title}`}
            />
          </div>

          {item.actualRaw !== "" && item.actualRaw !== undefined && item.actualRaw !== null && (
            <div className={`mrc-diff mrc-diff-${item.status}`}>
              {/* Cumulative target rules: Emergency Fund (7) and Corpus (8) */}
              {(rule.id === 7 || rule.id === 8) ? (
                item.actual >= item.recommended ? (
                  <>
                    <span className="mrc-diff-dot mrc-diff-dot-good" />
                    Fully funded
                  </>
                ) : (
                  <>
                    <span className="mrc-diff-dot mrc-diff-dot-info" />
                    {formatMoney(item.recommended - item.actual)} to go
                  </>
                )
              ) : (
                /* Monthly flow rules (S1-S5, W3 EMI) */
                <>
                  {item.status === "on-target" && (
                    <>
                      <span className="mrc-diff-dot mrc-diff-dot-good" />
                      On target
                    </>
                  )}
                  {item.status === "under" && (
                    <>
                      <span className="mrc-diff-dot mrc-diff-dot-info" />
                      {formatMoney(Math.abs(item.recommended - item.actual))} under target
                    </>
                  )}
                  {item.status === "over" && (
                    <>
                      <span className="mrc-diff-dot mrc-diff-dot-warn" />
                      +{formatMoney(Math.abs(item.recommended - item.actual))} over target
                    </>
                  )}
                  {item.status === "pending" && (
                    <span className="mrc-diff-dot mrc-diff-dot-neutral" />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {rule.note && (
          <div className="mrc-rule-formula">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span>{rule.note}</span>
          </div>
        )}
      </div>
    </li>
  );
}
