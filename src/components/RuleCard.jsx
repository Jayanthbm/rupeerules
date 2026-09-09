import { useState } from "react";
import NumberTicker from "./NumberTicker";
import { CURRENCY, formatMoney, badgeLabel } from "../utils/formatters";
import { getRuleFeedback } from "../utils/feedback";

export default function RuleCard({
  rule,
  item,
  onActualChange,
  ruleMap,
  breakdownList,
  onUpdateBreakdownItem,
  onAddBreakdownItem,
  onRemoveBreakdownItem,
}) {
  const hasBreakdownOption = Boolean(rule.defaultItems);
  const [showBreakdown, setShowBreakdown] = useState(() => hasBreakdownOption);
  const [isBreakdownCollapsed, setIsBreakdownCollapsed] = useState(false);

  const hasActual = item.actualRaw !== "" && item.actualRaw !== undefined && item.actualRaw !== null;
  const feedback = hasActual ? getRuleFeedback(rule.id, item.status, item.actual, item.recommended) : null;

  const progressStyle = item.progress !== null
    ? {
        width: `${Math.min(item.progress, 100).toFixed(1)}%`,
        backgroundColor: item.status === "over" ? "#dc2626" : "#2563eb",
      }
    : {};

  const currentBreakdownList = breakdownList && breakdownList.length > 0
    ? breakdownList
    : (rule.defaultItems || []);

  return (
    <li className="mrc-rule" style={{ "--rule-color": rule.color, "--rule-bg": rule.bg }}>
      <div className="mrc-rule-head">
        <span className="mrc-rule-badge">
          {badgeLabel(rule.id)}
        </span>
        <div className="mrc-rule-title-block">
          <div className="mrc-rule-title-row">
            <h3 className="mrc-rule-title">{rule.title}</h3>
            {item.adaptiveBadge && (
              <span
                className="mrc-rule-adaptive-pill"
                style={{
                  backgroundColor: item.adaptiveBadge.bg,
                  color: item.adaptiveBadge.color,
                  borderColor: item.adaptiveBadge.color,
                }}
                title={item.adaptiveBadge.subtext}
              >
                {item.adaptiveBadge.icon} {item.adaptiveBadge.text}
              </span>
            )}
            {hasBreakdownOption && (
              <button
                type="button"
                className="mrc-breakdown-toggle-btn"
                onClick={() => setShowBreakdown((prev) => !prev)}
              >
                {showBreakdown ? "Switch to single total" : "Itemize breakdown"}
              </button>
            )}
          </div>
          <p className="mrc-rule-subtitle">
            {item.adaptiveBadge ? item.adaptiveBadge.subtext : rule.subtitle}
          </p>
        </div>
        <div className="mrc-rule-amount-block">
          <div className="mrc-rule-amount">
            <NumberTicker
              value={item.recommended}
              prefix={CURRENCY}
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

        {/* Itemized breakdown if enabled */}
        {hasBreakdownOption && showBreakdown ? (
          <div className="mrc-breakdown-container">
            <div
              className="mrc-breakdown-subtotal-header"
              onClick={() => setIsBreakdownCollapsed((prev) => !prev)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setIsBreakdownCollapsed((prev) => !prev);
                }
              }}
              title={isBreakdownCollapsed ? "Expand breakdown items" : "Collapse breakdown items"}
            >
              <div className="mrc-breakdown-header-left">
                <svg
                  className={`mrc-collapse-chevron ${isBreakdownCollapsed ? "mrc-chevron-collapsed" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="14"
                  height="14"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span className="mrc-breakdown-header-label">
                  Itemized Subtotal ({currentBreakdownList.length} items):
                </span>
              </div>
              <div className="mrc-breakdown-header-val">
                <strong>{item.actual > 0 ? formatMoney(item.actual) : "₹0"}</strong>
                <span className="mrc-collapse-pill">
                  {isBreakdownCollapsed ? "Expand" : "Collapse"}
                </span>
              </div>
            </div>

            {!isBreakdownCollapsed && (
              <>
                <div className="mrc-breakdown-list">
                  {currentBreakdownList.map((subItem) => (
                    <div key={subItem.id} className="mrc-breakdown-row">
                      <input
                        type="text"
                        className="mrc-breakdown-name-input"
                        value={subItem.name}
                        placeholder="Expense item (e.g. Rent, EMI)"
                        onChange={(e) => onUpdateBreakdownItem(rule.id, subItem.id, "name", e.target.value)}
                      />
                      <div className="mrc-breakdown-amount-wrap">
                        <span className="mrc-actual-prefix">{CURRENCY}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="mrc-breakdown-amount-input"
                          value={subItem.amount === "" ? "" : String(subItem.amount)}
                          placeholder="0"
                          onChange={(e) => onUpdateBreakdownItem(rule.id, subItem.id, "amount", e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="mrc-breakdown-del-btn"
                        onClick={() => onRemoveBreakdownItem(rule.id, subItem.id)}
                        title="Remove item"
                        aria-label="Remove item"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mrc-breakdown-footer">
                  <button
                    type="button"
                    className="mrc-breakdown-add-btn"
                    onClick={() => onAddBreakdownItem(rule.id)}
                  >
                    + Add item
                  </button>

                  <div className="mrc-breakdown-total">
                    <span>Subtotal:</span>
                    <strong>{item.actual > 0 ? formatMoney(item.actual) : "₹0"}</strong>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Single Total input */
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
        )}

        {/* Status difference badge for breakdown mode */}
        {hasBreakdownOption && showBreakdown && item.actualRaw !== "" && item.actualRaw !== undefined && item.actualRaw !== null && (
          <div className="mrc-breakdown-diff-row">
            <div className={`mrc-diff mrc-diff-${item.status}`}>
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
                </>
              )}
            </div>
          </div>
        )}

        {rule.id === 8 && item.recommended > 0 && (
          <div className="mrc-fire-estimate">
            <div className="mrc-fire-badge">🔥 FIRE Projection</div>
            <div className="mrc-fire-text">
              At standard 15% monthly investing (<strong>{formatMoney(ruleMap ? (ruleMap[5]?.actual || ruleMap[5]?.recommended || 0) : 0)}/mo</strong> at ~12% CAGR), target is reached in approximately <strong>17–19 years</strong> from scratch.
            </div>
          </div>
        )}

        {(item.note || rule.note) && (
          <div className="mrc-rule-formula">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span>{item.note || rule.note}</span>
          </div>
        )}
      </div>
    </li>
  );
}
