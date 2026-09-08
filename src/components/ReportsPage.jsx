import { useState, useMemo } from "react";
import { computeReportsData } from "../utils/reports";
import WealthBenchmarkGraph from "./WealthBenchmarkGraph";
import SpendingTrendsGraph from "./SpendingTrendsGraph";
import MultiMonthLedgerTable from "./MultiMonthLedgerTable";

export default function ReportsPage({ onBackToCalculator, store }) {
  const [selectedMetric, setSelectedMetric] = useState("emergencyFund");
  const [selectedSpendingMetric, setSelectedSpendingMetric] = useState("salary");
  const [selectedYear, setSelectedYear] = useState("ALL");

  const reports = useMemo(() => {
    return computeReportsData(store?.months);
  }, [store]);

  const { monthlyBreakdowns, activeMonthCount } = reports;

  // Extract distinct years in ascending order (2025, 2026, ...)
  const availableYears = useMemo(() => {
    const years = new Set();
    monthlyBreakdowns.forEach((r) => {
      if (r.monthKey && r.monthKey.includes("-")) {
        years.add(r.monthKey.split("-")[0]);
      }
    });
    return Array.from(years).sort((a, b) => Number(a) - Number(b));
  }, [monthlyBreakdowns]);

  // Filter breakdown rows by year
  const filteredBreakdowns = useMemo(() => {
    if (selectedYear === "ALL") return monthlyBreakdowns;
    return monthlyBreakdowns.filter((r) => r.monthKey.startsWith(selectedYear));
  }, [monthlyBreakdowns, selectedYear]);

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
          {/* 1. Wealth & Obligations Milestone Benchmark Graph */}
          <WealthBenchmarkGraph
            selectedMetric={selectedMetric}
            onSelectMetric={setSelectedMetric}
            filteredBreakdowns={filteredBreakdowns}
            selectedYear={selectedYear}
          />

          {/* 2. Income, Spending & Investment Trends Graph */}
          <SpendingTrendsGraph
            selectedSpendingMetric={selectedSpendingMetric}
            onSelectSpendingMetric={setSelectedSpendingMetric}
            filteredBreakdowns={filteredBreakdowns}
            selectedYear={selectedYear}
          />

          {/* 3. Multi-Month Ledger History Table */}
          <MultiMonthLedgerTable
            filteredBreakdowns={filteredBreakdowns}
          />
        </div>
      )}
    </div>
  );
}
