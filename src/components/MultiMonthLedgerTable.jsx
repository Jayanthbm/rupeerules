import { formatMoney } from "../utils/formatters";
import { formatMonthLabel } from "../utils/storage";

export default function MultiMonthLedgerTable({ filteredBreakdowns }) {
  return (
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
  );
}
