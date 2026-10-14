import { useEffect, useRef, useState } from "react";
import { CURRENCY, formatMoney } from "../utils/formatters";
import { getCurrentMonthKey } from "../utils/storage";
import {
  GOLD_PURITIES,
  computeGoldValue,
  fetchGoldRatePerGram,
  isGoldRateStale,
  formatRateDate,
} from "../utils/goldRate";

function purityLabel(purity) {
  return `${purity}K`;
}

/**
 * Gold holding row (Rule 8 breakdown) — used for both Physical Gold and
 * Digital Gold: grams + purity (24K/22K/18K) + "Update value" button.
 *
 * Current month: the ₹ amount changes ONLY on button click (fresh API fetch),
 * or via one silent auto-refresh when the stored snapshot is older than 24h.
 *
 * Any other month: plain editable ₹ input (frozen historical snapshot)
 * plus a read-only derivation line — no API calls, ever.
 */
export default function GoldHoldingRow({
  subItem,
  ruleId,
  isLocked = false,
  activeMonth,
  onUpdateBreakdownItem,
  onSortBreakdownItems,
}) {
  const isCurrentMonth = activeMonth === getCurrentMonthKey();

  const storedGrams = subItem.grams === "" || subItem.grams === undefined || subItem.grams === null
    ? ""
    : String(subItem.grams);
  const storedPurity = GOLD_PURITIES.includes(Number(subItem.purity)) ? Number(subItem.purity) : 24;

  const [gramsText, setGramsText] = useState(storedGrams);
  const [purity, setPurity] = useState(storedPurity);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  // Guards the one-shot 24h auto-refresh against StrictMode's double effect run.
  // (The parent keys this row by month, so it remounts on month switch — local
  // edit state is re-seeded from the stored item on every mount.)
  const autoRefreshedRef = useRef(false);

  /** Push a full gold snapshot (amount + rate metadata) — the only path that changes the ₹ value. */
  const applySnapshot = (grams, snapshotPurity, entry) => {
    const value = computeGoldValue(grams, entry.ratePerGram);
    onUpdateBreakdownItem(ruleId, subItem.id, "amount", String(value));
    onUpdateBreakdownItem(ruleId, subItem.id, "ratePerGram", entry.ratePerGram);
    onUpdateBreakdownItem(ruleId, subItem.id, "rateAt", entry.rateAt);
    onUpdateBreakdownItem(ruleId, subItem.id, "grams", String(grams));
    onUpdateBreakdownItem(ruleId, subItem.id, "purity", snapshotPurity);
    if (typeof onSortBreakdownItems === "function") {
      onSortBreakdownItems(ruleId);
    }
  };

  // 24h auto-refresh: when the current month is opened and the stored value is
  // older than a day (and grams were recorded), refresh once — silently.
  useEffect(() => {
    if (!isCurrentMonth || isLocked) return;
    if (autoRefreshedRef.current) return;
    const grams = Number(subItem.grams);
    if (!Number.isFinite(grams) || grams <= 0) return;
    if (!isGoldRateStale(subItem.rateAt)) return;
    autoRefreshedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const entry = await fetchGoldRatePerGram(storedPurity, { forceRefresh: false });
        if (!cancelled) applySnapshot(grams, storedPurity, entry);
      } catch {
        /* Offline / API down: keep the old value; user can click Update. */
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth, isCurrentMonth, isLocked]);

  const handleUpdateClick = async () => {
    if (isLoading || isLocked) return;
    const grams = Number(gramsText);
    if (!Number.isFinite(grams) || grams <= 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const entry = await fetchGoldRatePerGram(purity, { forceRefresh: true });
      applySnapshot(grams, purity, entry);
    } catch {
      setError("Couldn't fetch the live rate. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const hasSnapshot = Number(subItem.ratePerGram) > 0 && Number(subItem.rateAt) > 0;
  const storedAmount = Number(subItem.amount) || 0;
  const isStale = hasSnapshot && isGoldRateStale(subItem.rateAt);
  const neverUpdated = !hasSnapshot && storedGrams !== "" && Number(storedGrams) > 0 && storedAmount === 0;

  /* ---------------- Past months: plain ₹ input + read-only history ---------------- */
  if (!isCurrentMonth) {
    return (
      <div className="mrc-breakdown-row mrc-gold-row">
        <input
          type="text"
          className="mrc-breakdown-name-input"
          value={subItem.name}
          placeholder="Asset item (e.g. Mutual Funds)"
          disabled={isLocked || subItem.isFixed}
          onChange={(e) => onUpdateBreakdownItem(ruleId, subItem.id, "name", e.target.value)}
        />
        <div className="mrc-breakdown-amount-wrap">
          <span className="mrc-actual-prefix">{CURRENCY}</span>
          <input
            type="text"
            inputMode="decimal"
            className="mrc-breakdown-amount-input"
            value={subItem.amount === "" ? "" : String(subItem.amount)}
            placeholder="0"
            disabled={isLocked}
            onChange={(e) => onUpdateBreakdownItem(ruleId, subItem.id, "amount", e.target.value)}
          />
        </div>
        {hasSnapshot && (
          <span
            className="mrc-gold-history-note"
            title={`Historical snapshot from ${formatRateDate(subItem.rateAt)} — not re-fetched`}
          >
            {storedGrams}g × {purityLabel(subItem.purity || 24)} @ {formatMoney(Number(subItem.ratePerGram))}/g
            {" ("}{formatRateDate(subItem.rateAt)}{")"}
          </span>
        )}
        {neverUpdated && (
          <span className="mrc-gold-hint">⚠ Gold value never updated — enter the amount</span>
        )}
      </div>
    );
  }

  /* ---------------- Current month: name + derivation | grams + purity + refresh ---------------- */
  const gramsNum = Number(gramsText);
  const canUpdate = !isLoading && !isLocked && Number.isFinite(gramsNum) && gramsNum > 0;

  return (
    <div className="mrc-breakdown-row mrc-gold-row">
      <div className="mrc-gold-left">
        <span className="mrc-gold-name">{subItem.name || "Gold"}</span>
        {hasSnapshot ? (
          <span
            className="mrc-gold-derivation"
            title={`${formatMoney(storedAmount)} = ${storedGrams}g × ${purityLabel(subItem.purity || 24)} @ ${formatMoney(Number(subItem.ratePerGram))}/g · as of ${formatRateDate(subItem.rateAt)}`}
          >
            <strong className="mrc-gold-total">{formatMoney(storedAmount)}</strong>
            {" · "}{storedGrams}g × {purityLabel(subItem.purity || 24)} @ {formatMoney(Number(subItem.ratePerGram))}/g
            {" · as of "}{formatRateDate(subItem.rateAt)}
            {isStale && !error ? " · rate may be outdated" : ""}
          </span>
        ) : (
          storedAmount > 0 && (
            <span className="mrc-gold-derivation">
              <strong className="mrc-gold-total">{formatMoney(storedAmount)}</strong>
              {" · manual value — tap refresh to value by weight"}
            </span>
          )
        )}
        {neverUpdated && (
          <span className="mrc-gold-hint">⚠ Gold value never updated — enter grams and refresh</span>
        )}
      </div>
      <div className="mrc-gold-right">
        <span className="mrc-gold-grams-wrap">
          <input
            type="text"
            inputMode="decimal"
            className="mrc-gold-grams-input"
            value={gramsText}
            placeholder="0"
            disabled={isLocked}
            aria-label={`${subItem.name || "Gold"} weight in grams`}
            title={`Weight of your ${subItem.name || "gold"} in grams`}
            onChange={(e) => setGramsText(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <span className="mrc-gold-grams-suffix">g</span>
        </span>
        <select
          className="mrc-gold-purity-select"
          value={purity}
          disabled={isLocked}
          aria-label={`${subItem.name || "Gold"} purity`}
          title={`Purity of your ${subItem.name || "gold"}`}
          onChange={(e) => setPurity(Number(e.target.value))}
        >
          {GOLD_PURITIES.map((p) => (
            <option key={p} value={p}>
              {purityLabel(p)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`mrc-gold-refresh-btn${isLoading ? " mrc-gold-refresh-btn-loading" : ""}`}
          onClick={handleUpdateClick}
          disabled={!canUpdate}
          title="Fetch today's live rate and value your gold"
          aria-label="Update gold value with live rate"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="14"
            height="14"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </button>
      </div>
      {error && <div className="mrc-gold-error">{error}</div>}
    </div>
  );
}
