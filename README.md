# RupeeRules 💰

Personal finance budgeting ledger and money rules calculator tailored for Indian salary earners (`₹`, `en-IN` lakhs/crores formatting).

---

## Features

- **Multi-Month Budgeting & History**:
  - Track financial records across past and upcoming months (`YYYY-MM`).
  - **Copy from previous month** to pre-fill recurring expenses and SIPs.
- **Spending Breakdown**:
  - **Essential Expenses**: Max 55% (rent, EMI, groceries, transport)
  - **Guilt-Free Money**: 5% for discretionary spending
  - **Debt Payoff / Investing**: 10% towards debt repayment or investments
  - **Short-Term Goals**: 15% for upcoming milestones (travel, wedding, gadgets)
  - **Long-Term Wealth**: 15% recurring monthly investment
- **Wealth Targets & Safety Caps**:
  - **Max Total EMI**: Hard cap at 40% of monthly salary
  - **Emergency Fund**: 6 months salary buffer in liquid assets
  - **Income Replacement Corpus (FIRE number)**: Target 120× monthly salary with timeline estimates
- **Interactive Itemized Breakdowns**:
  - Custom category names, `+ Add item`, `× Remove item`, and real-time subtotal summation.
- **Can I Buy? Purchase Advisor**:
  - Enter or slide a product price and get an instant **Buy now / Buy later / Not advisable** verdict scored against your salary, essentials, existing EMIs, and emergency fund.
  - Choose **Full payment** or **EMI** — for EMI, pick a tenure (3–60 months or custom) and see monthly EMI, total payable, interest cost, and post-EMI surplus with an affordability check.
- **Analytics & Reports Dashboard**:
  - Month-over-month trend table, average wealth/savings rate, and total tracked allocations.
- **Data Backup & Portability**:
  - 100% offline local privacy with JSON export download and backup file restoration.
- **PWA & Offline Support**:
  - Progressive Web App with Service Worker for offline operation.
- **Dark Mode Support**: Seamless toggle between light and dark themes.

---

## Tech Stack

- **React 19**
- **Vite**
- **Vanilla CSS**

---

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

### Installation

```bash
npm install
```

### Development

Run the local development server:

```bash
npm run dev
```

### Build

Create the production build:

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Deploy

Deploy directly to Cloudflare Pages:

```bash
npm run deploy
```
