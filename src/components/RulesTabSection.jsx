import RuleCard from "./RuleCard";
import SpendingAllocationSummary from "./SpendingAllocationSummary";
import { SPENDING_RULES, WEALTH_RULES } from "../rules";

export default function RulesTabSection({
  activeTab,
  setActiveTab,
  salary,
  ruleMap,
  breakdownItems,
  onActualChange,
  onUpdateBreakdownItem,
  onAddBreakdownItem,
  onRemoveBreakdownItem,
  onClearAll,
}) {
  return (
    <div className="mrc-rules">
      <div className="mrc-tabs">
        <button
          className={`mrc-tab ${activeTab === "spending" ? "mrc-tab-active" : ""}`}
          onClick={() => setActiveTab("spending")}
        >
          <span className="mrc-tab-dot mrc-dot-s" />
          Spending &amp; Savings
          <span className="mrc-tab-count">5 rules</span>
        </button>
        <button
          className={`mrc-tab ${activeTab === "wealth" ? "mrc-tab-active" : ""}`}
          onClick={() => setActiveTab("wealth")}
        >
          <span className="mrc-tab-dot mrc-dot-w" />
          Wealth &amp; Obligations
          <span className="mrc-tab-count">3 rules</span>
        </button>
      </div>

      {activeTab === "spending" && (
        <section className="mrc-section">
          <SpendingAllocationSummary salary={salary} ruleMap={ruleMap} />
          <ol className="mrc-rules-list">
            {SPENDING_RULES.map((rule) => {
              const item = ruleMap[rule.id];
              if (!item) return null;
              return (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  item={item}
                  ruleMap={ruleMap}
                  breakdownList={breakdownItems ? breakdownItems[rule.id] : null}
                  onActualChange={onActualChange}
                  onUpdateBreakdownItem={onUpdateBreakdownItem}
                  onAddBreakdownItem={onAddBreakdownItem}
                  onRemoveBreakdownItem={onRemoveBreakdownItem}
                />
              );
            })}
          </ol>
        </section>
      )}

      {activeTab === "wealth" && (
        <section className="mrc-section">
          <ol className="mrc-rules-list">
            {WEALTH_RULES.map((rule) => {
              const item = ruleMap[rule.id];
              if (!item) return null;
              return (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  item={item}
                  ruleMap={ruleMap}
                  breakdownList={breakdownItems ? breakdownItems[rule.id] : null}
                  onActualChange={onActualChange}
                  onUpdateBreakdownItem={onUpdateBreakdownItem}
                  onAddBreakdownItem={onAddBreakdownItem}
                  onRemoveBreakdownItem={onRemoveBreakdownItem}
                />
              );
            })}
          </ol>
        </section>
      )}

      <p className="mrc-footnote">
        Recommended numbers are based on your salary. Enter what you actually spend or save
        against each rule to see how you're tracking.
      </p>

      <button className="mrc-clear-btn" onClick={onClearAll}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
        </svg>
        Clear all data
      </button>
    </div>
  );
}
