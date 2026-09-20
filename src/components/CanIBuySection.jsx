import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "../utils/formatters";
import {
  evaluatePurchase,
  evaluatePaymentPlan,
  monthsToAfford,
  defaultEmiMonths,
  computeEmiCost,
  EMI_TENURE_OPTIONS,
  EMI_ANNUAL_RATE,
} from "../utils/canIBuy";

const QUICK_PRICES = [10000, 25000, 50000, 100000, 250000, 500000];
const ADVISOR_STATE_KEY = "mrc_canibuy_state_v1";

/** Advisor inputs survive view switches: they live in localStorage, not just component state. */
function loadAdvisorState() {
  try {
    const raw = localStorage.getItem(ADVISOR_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export default function CanIBuySection({ salary, salaryTransition, actuals, emergencyFundTarget }) {
  const [saved] = useState(loadAdvisorState);
  const [productName, setProductName] = useState(() => (typeof saved?.productName === "string" ? saved.productName : ""));
  const [priceStr, setPriceStr] = useState(() => (typeof saved?.priceStr === "string" ? saved.priceStr : ""));
  const [payMode, setPayMode] = useState(() => (saved?.payMode === "emi" ? "emi" : "full"));
  const [rateInput, setRateInput] = useState(() => {
    const r = Number(saved?.annualRate);
    return Number.isFinite(r) && r >= 0 && r <= 36 ? String(r) : String(EMI_ANNUAL_RATE * 100);
  });

  const currentSalary = Number(salary) || 0;
  const salaryForDisplay = Number(salaryTransition) || currentSalary;
  const essentialsActual = Number(actuals?.[1]) || 0;
  const goalsActual = Number(actuals?.[4]) || 0;
  const investmentsActual = Number(actuals?.[5]) || 0;
  const maxEmiActual = Number(actuals?.[6]) || 0;
  const emergencyFundActual = Number(actuals?.[7]) || 0;

  const price = useMemo(() => {
    const cleaned = priceStr.replace(/[^0-9.]/g, "");
    return cleaned === "" ? 0 : Number(cleaned) || 0;
  }, [priceStr]);

  // derived tenure: auto-picks a sensible default per price unless the user overrides it
  const [userTenure, setUserTenure] = useState(() =>
    Number.isFinite(Number(saved?.userTenure)) && saved?.userTenure !== null ? Number(saved.userTenure) : null
  );
  const months = userTenure ?? defaultEmiMonths(price);

  // annual rate as a fraction (0 = no-cost EMI)
  const annualRate = useMemo(() => {
    const cleaned = rateInput.replace(/[^0-9.]/g, "");
    const pct = cleaned === "" ? NaN : Number(cleaned);
    if (!Number.isFinite(pct) || pct < 0) return EMI_ANNUAL_RATE;
    return Math.min(pct, 36) / 100;
  }, [rateInput]);
  const isNoCostEmi = annualRate === 0;

  // keep the advisor state in sync so it survives switching back and forth between views
  useEffect(() => {
    try {
      localStorage.setItem(
        ADVISOR_STATE_KEY,
        JSON.stringify({ productName, priceStr, payMode, userTenure, annualRate: annualRate * 100 })
      );
    } catch {
      // storage unavailable — advisor simply won't persist
    }
  }, [productName, priceStr, payMode, userTenure, annualRate]);

  const decision = useMemo(
    () =>
      evaluatePurchase({
        price,
        salary: currentSalary,
        essentialsActual,
        investmentsActual,
        goalsActual,
        maxEmiActual,
        emergencyFundActual,
        emergencyFundTarget,
      }),
    [price, currentSalary, essentialsActual, investmentsActual, goalsActual, maxEmiActual, emergencyFundActual, emergencyFundTarget]
  );

  const planEval = useMemo(
    () =>
      evaluatePaymentPlan({
        price,
        verdict: decision.verdict,
        salary: currentSalary,
        monthlyFreeCash: decision.monthlyFreeCash || 0,
        existingEmi: maxEmiActual,
        months,
        rate: annualRate,
      }),
    [price, decision.verdict, decision.monthlyFreeCash, currentSalary, maxEmiActual, months, annualRate]
  );

  const { emi, total, interest } = computeEmiCost(price, annualRate, months);
  const monthsToSave = monthsToAfford(price, decision.monthlyFreeCash || 0);
  const waitUntil = useMemo(() => {
    if (!monthsToSave) return null;
    const d = new Date();
    d.setMonth(d.getMonth() + monthsToSave);
    return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
  }, [monthsToSave]);

  const hasDecision = decision.verdict === "buy-now" || decision.verdict === "buy-later" || decision.verdict === "do-not-buy";
  const sliderValue = Math.min(price, 1000000);

  const handleSliderChange = (e) => {
    const v = Number(e.target.value);
    setPriceStr(v > 0 ? v.toLocaleString("en-IN") : "");
  };

  const handlePriceInput = (e) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/[^0-9.]/g, "");
    setPriceStr(cleaned === "" ? "" : Number(cleaned).toLocaleString("en-IN"));
  };

  return (
    <div className="mrc-canibuy">
      <div className="mrc-canibuy-intro">
        <h1 className="mrc-canibuy-title">Can I buy this?</h1>
        <p className="mrc-canibuy-subtitle">
          Name a product and set its price — we'll check it against your salary, spending, EMIs and emergency fund,
          then tell you to <strong>buy now</strong>, <strong>buy later</strong>, or hold off, with a full-payment vs EMI comparison.
        </p>
      </div>

      {/* Product + price */}
      <section className="mrc-canibuy-card">
        <div className="mrc-canibuy-product-row">
          <input
            className="mrc-canibuy-product-input"
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="What are you buying? e.g. iPhone 16, sofa, washing machine"
            aria-label="Product name"
            maxLength={60}
          />
        </div>
        <div className="mrc-canibuy-price-head">
          <span className="mrc-field-label">Product price</span>
          <div className="mrc-canibuy-price-input-wrap">
            <span className="mrc-actual-prefix">₹</span>
            <input
              className="mrc-canibuy-price-input"
              type="text"
              inputMode="decimal"
              value={priceStr}
              onChange={handlePriceInput}
              placeholder="e.g. 60000"
              aria-label="Product price"
            />
          </div>
        </div>
        <input
          className="mrc-canibuy-slider"
          type="range"
          min="0"
          max="1000000"
          step="1000"
          value={sliderValue}
          onChange={handleSliderChange}
          aria-label="Product price slider"
        />
        <div className="mrc-canibuy-slider-scale">
          <span>₹0</span>
          <span>₹10L</span>
        </div>
        <div className="mrc-canibuy-quick-row">
          {QUICK_PRICES.map((p) => (
            <button
              key={p}
              type="button"
              className={`mrc-canibuy-quick-btn ${price === p ? "mrc-canibuy-quick-active" : ""}`}
              onClick={() => setPriceStr(p.toLocaleString("en-IN"))}
            >
              {p >= 100000 ? `₹${p / 100000}L` : `₹${(p / 1000).toFixed(0)}k`}
            </button>
          ))}
        </div>
      </section>

      {/* Verdict */}
      {hasDecision && (
        <section className={`mrc-canibuy-verdict mrc-canibuy-verdict-${decision.verdict}`}>
          <div className="mrc-canibuy-verdict-head">
            <span className="mrc-canibuy-verdict-emoji">{decision.emoji}</span>
            <div>
              <h2 className="mrc-canibuy-verdict-label">
                {decision.label}
                {productName.trim() && <span className="mrc-canibuy-verdict-product"> · {productName.trim()}</span>}
              </h2>
              <p className="mrc-canibuy-verdict-summary">{decision.summary}</p>
            </div>
            <div className="mrc-canibuy-score-ring">
              <svg viewBox="0 0 60 60" width="56" height="56">
                <circle cx="30" cy="30" r="26" fill="none" stroke="var(--mrc-border)" strokeWidth="5" />
                <circle
                  cx="30"
                  cy="30"
                  r="26"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${(decision.score / 100) * 163} 163`}
                  transform="rotate(-90 30 30)"
                  style={{ transition: "stroke-dasharray 0.5s ease" }}
                />
                <text x="30" y="35" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor">
                  {decision.score}
                </text>
              </svg>
            </div>
          </div>
          <ul className="mrc-canibuy-reasons">
            {decision.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          {decision.workingDays > 0 && (
            <div className="mrc-canibuy-stat-badge">
              💼 Costs <strong>{decision.workingDays} working days</strong> of your labor (based on 22 days/mo).
            </div>
          )}
          {decision.verdict === "buy-later" && monthsToSave && (
            <div className="mrc-canibuy-wait-note">
              ⏱️ Buy outright around <strong>{waitUntil}</strong> at your current pace ({formatMoney(decision.monthlyFreeCash)}/mo free cash flow).
            </div>
          )}
          {price > 0 && decision.oppCost5Yr > 0 && (
            <div className="mrc-canibuy-opp-cost">
              <div className="mrc-canibuy-opp-title">📈 SIP Opportunity Cost (at 12% CAGR)</div>
              <div className="mrc-canibuy-opp-desc">
                If this ₹{price.toLocaleString("en-IN")} was invested in an equity index fund instead:
              </div>
              <div className="mrc-canibuy-opp-grid">
                <div className="mrc-canibuy-opp-item">
                  <span>In 5 Years</span>
                  <strong>{formatMoney(decision.oppCost5Yr)}</strong>
                  <span className="mrc-canibuy-opp-gain">+{formatMoney(decision.oppCost5Yr - price)}</span>
                </div>
                <div className="mrc-canibuy-opp-item">
                  <span>In 10 Years</span>
                  <strong>{formatMoney(decision.oppCost10Yr)}</strong>
                  <span className="mrc-canibuy-opp-gain">+{formatMoney(decision.oppCost10Yr - price)}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Payment mode tabs */}
      {hasDecision && (
        <section className="mrc-canibuy-card">
          <div className="mrc-canibuy-tabs">
            <button
              type="button"
              className={`mrc-canibuy-tab ${payMode === "full" ? "mrc-canibuy-tab-active" : ""}`}
              onClick={() => setPayMode("full")}
            >
              💵 Full payment
            </button>
            <button
              type="button"
              className={`mrc-canibuy-tab ${payMode === "emi" ? "mrc-canibuy-tab-active" : ""}`}
              onClick={() => setPayMode("emi")}
            >
              📅 EMI
            </button>
          </div>

          {payMode === "full" ? (
            <div className="mrc-canibuy-plan">
              <div className="mrc-canibuy-plan-row">
                <span>One-time payment</span>
                <strong>{formatMoney(price)}</strong>
              </div>
              <div className="mrc-canibuy-plan-row">
                <span>Monthly free cash flow</span>
                <strong>{formatMoney(decision.monthlyFreeCash)}</strong>
              </div>
              <div className="mrc-canibuy-plan-row">
                <span>Months to save up (if not buying now)</span>
                <strong>{monthsToSave ?? "—"}</strong>
              </div>
              <div className={`mrc-canibuy-plan-note ${decision.verdict === "buy-now" ? "mrc-canibuy-note-ok" : "mrc-canibuy-note-info"}`}>
                {decision.verdict === "buy-now"
                  ? "Paying in full is ideal — no interest, no new obligations."
                  : `Wait and save: ${monthsToSave ? `${monthsToSave} month${monthsToSave === 1 ? "" : "s"} to go` : "build free cash flow first"}.`}
              </div>
            </div>
          ) : (
            <div className="mrc-canibuy-plan">
              <div className="mrc-canibuy-tenure-row">
                <span className="mrc-field-label">EMI duration</span>
                <div className="mrc-canibuy-tenure-options">
                  {EMI_TENURE_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`mrc-canibuy-tenure-btn ${months === m ? "mrc-canibuy-tenure-active" : ""}`}
                      onClick={() => setUserTenure(m)}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
                <div className="mrc-canibuy-custom-months">
                  <label htmlFor="mrc-custom-months">Custom months</label>
                  <input
                    id="mrc-custom-months"
                    type="number"
                    min="1"
                    max="84"
                    value={userTenure ?? ""}
                    onChange={(e) =>
                      setUserTenure(e.target.value === "" ? null : Math.max(1, Math.min(84, Number(e.target.value) || 1)))
                    }
                    placeholder={`${defaultEmiMonths(price)} (auto)`}
                  />
                </div>

                <div className="mrc-canibuy-custom-months">
                  <label htmlFor="mrc-emi-rate">Interest rate (% p.a.)</label>
                  <input
                    id="mrc-emi-rate"
                    className="mrc-canibuy-rate-input"
                    type="text"
                    inputMode="decimal"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    placeholder="e.g. 12"
                    style={{ width: 110 }}
                  />
                  <span className="mrc-canibuy-rate-hint">
                    {isNoCostEmi ? "No-cost EMI — zero interest" : `${formatMoney(interest)} total interest at this rate`}
                  </span>
                </div>
              </div>

              <div className="mrc-canibuy-emi-grid">
                <div className="mrc-canibuy-emi-stat">
                  <span>Monthly EMI</span>
                  <strong>{formatMoney(emi)}</strong>
                </div>
                <div className="mrc-canibuy-emi-stat">
                  <span>Total payable</span>
                  <strong>{formatMoney(total)}</strong>
                </div>
                <div className="mrc-canibuy-emi-stat">
                  <span>Interest cost</span>
                  <strong className={isNoCostEmi ? "mrc-canibuy-zero-interest" : ""}>
                    {isNoCostEmi ? "₹0 🎉" : formatMoney(interest)}
                  </strong>
                </div>
                <div className="mrc-canibuy-emi-stat">
                  <span>Post-EMI surplus</span>
                  <strong>{formatMoney(Math.max((decision.monthlyFreeCash || 0) - emi, 0))}</strong>
                </div>
              </div>

              <div
                className={`mrc-canibuy-plan-note ${
                  planEval.feasible ? "mrc-canibuy-note-ok" : "mrc-canibuy-note-warn"
                }`}
              >
                {planEval.feasible ? "✅ " : "⚠️ "}
                {planEval.message}
              </div>

              {price > 0 && !isNoCostEmi && (
                <div className="mrc-canibuy-compare">
                  <div className="mrc-canibuy-compare-col">
                    <span className="mrc-canibuy-compare-tag">Full payment</span>
                    <strong>{formatMoney(price)}</strong>
                    <span className="mrc-canibuy-compare-sub">₹0 interest</span>
                  </div>
                  <div className="mrc-canibuy-compare-vs">vs</div>
                  <div className={`mrc-canibuy-compare-col ${isNoCostEmi ? "" : "mrc-canibuy-compare-emi"}`}>
                    <span className="mrc-canibuy-compare-tag">EMI ({months}m)</span>
                    <strong>{formatMoney(total)}</strong>
                    <span className="mrc-canibuy-compare-sub">{formatMoney(interest)} interest</span>
                  </div>
                </div>
              )}
              {price > 0 && !isNoCostEmi && (
                <div className="mrc-canibuy-plan-subnote mrc-canibuy-compare-note">
                  💡 Paying in full instead of EMI saves <strong>{formatMoney(interest)}</strong>
                  {decision.monthlyFreeCash > 0 && interest > 0 && (
                    <> — that's {monthsToAfford(interest, decision.monthlyFreeCash)} month{monthsToAfford(interest, decision.monthlyFreeCash) === 1 ? "" : "s"} of free cash flow.</>
                  )}
                </div>
              )}
              {planEval.notes?.map((n, i) => (
                <div key={i} className="mrc-canibuy-plan-subnote">
                  {n}
                </div>
              ))}
              {price > 0 && decision.verdict === "buy-now" && (
                <div className="mrc-canibuy-plan-subnote">
                  💡 Consider a ~10% down payment ({formatMoney(Math.ceil((price * 0.1) / 100) * 100)}) to keep the EMI smaller.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Context strip: what we know about the user */}
      <section className="mrc-canibuy-context">
        <div className="mrc-canibuy-ctx-item">
          <span>Monthly salary</span>
          <strong>{formatMoney(salaryForDisplay)}</strong>
        </div>
        <div className="mrc-canibuy-ctx-item">
          <span>Essentials this month</span>
          <strong>{formatMoney(essentialsActual)}</strong>
        </div>
        <div className="mrc-canibuy-ctx-item">
          <span>Existing EMIs</span>
          <strong>{formatMoney(maxEmiActual)}</strong>
        </div>
        <div className="mrc-canibuy-ctx-item">
          <span>Emergency fund</span>
          <strong>{formatMoney(emergencyFundActual)}</strong>
        </div>
      </section>

      {!currentSalary && (
        <div className="mrc-canibuy-salary-hint">
          Set your monthly take-home salary in the Calculator tab to activate the advisor.
        </div>
      )}
    </div>
  );
}
