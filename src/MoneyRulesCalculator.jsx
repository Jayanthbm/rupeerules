import { useState, useEffect, useRef } from "react";
import { useDarkMode } from "./hooks/useDarkMode";
import { useMoneyRules } from "./hooks/useMoneyRules";
import { performFullSync } from "./utils/sync/syncEngine";
import Header from "./components/Header";
import CanIBuySection from "./components/CanIBuySection";
import GoalsSection from "./components/GoalsSection";
import MonthPicker from "./components/MonthPicker";
import SalaryInput from "./components/SalaryInput";
import EmptyState from "./components/EmptyState";
import RulesTabSection from "./components/RulesTabSection";
import ReportsPage from "./components/ReportsPage";
import SyncPage from "./components/SyncPage";
import BackupModal from "./components/BackupModal";

export default function MoneyRulesCalculator() {
  const [darkMode, setDarkMode] = useDarkMode();
  const [currentView, setCurrentView] = useState("calculator"); // 'calculator' | 'canibuy' | 'reports' | 'goals' | 'sync'
  const [showBackup, setShowBackup] = useState(false);

  const {
    store,
    activeMonth,
    monthlySalary,
    salaryTransition,
    activeTab,
    setActiveTab,
    switchMonth,
    copyFromMonth,
    reloadFromStore,
    handleSalaryChange,
    handleSalaryCommit,
    updateActual,
    updateBreakdownItem,
    addBreakdownItem,
    removeBreakdownItem,
    sortBreakdownItems,
    handleClearAll,
    rulesWithAmounts,
    ruleMap,
    breakdownItems,
    actuals,
    salary,
    isLocked,
    toggleMonthLock,
  } = useMoneyRules();

  // Manual sync function triggered on demand (e.g. from Sync tab or sync status button)
  const handleManualSync = () => {
    performFullSync(reloadFromStore);
  };

  return (
    <div className="mrc-shell" data-theme={darkMode ? "dark" : "light"}>
      <Header
        darkMode={darkMode}
        currentView={currentView}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        onOpenCalculator={() => setCurrentView("calculator")}
        onOpenReports={() => setCurrentView("reports")}
        onOpenGoals={() => setCurrentView("goals")}
        onOpenCanIBuy={() => setCurrentView("canibuy")}
        onOpenSync={() => setCurrentView("sync")}
        onOpenBackup={() => setShowBackup(true)}
      />

      {currentView === "reports" ? (
        <ReportsPage
          store={store}
          onBackToCalculator={() => setCurrentView("calculator")}
        />
      ) : currentView === "canibuy" ? (
        <CanIBuySection
          salary={salary}
          salaryTransition={salaryTransition}
          actuals={actuals}
          emergencyFundTarget={ruleMap?.[7]?.recommended || 0}
          avgEmiSurplus={salaryTransition * 0.2}
        />
      ) : currentView === "goals" ? (
        <GoalsSection
          salary={salaryTransition}
          actuals={actuals}
          breakdownItems={breakdownItems}
          storeMonths={store?.months || {}}
          onNavigateToCalculator={() => setCurrentView("calculator")}
        />
      ) : currentView === "sync" ? (
        <SyncPage onReloadStore={reloadFromStore} />
      ) : (
        <>
          <MonthPicker
            activeMonth={activeMonth}
            onSwitchMonth={switchMonth}
            onCopyPrevious={copyFromMonth}
            months={store.months}
            isLocked={isLocked}
            onToggleLock={toggleMonthLock}
          />

          <SalaryInput
            monthlySalary={monthlySalary}
            salaryTransition={salaryTransition}
            onSalaryChange={handleSalaryChange}
            onSalaryCommit={handleSalaryCommit}
            rulesWithAmounts={rulesWithAmounts}
            isLocked={isLocked}
          />

          {salaryTransition === 0 ? (
            <EmptyState />
          ) : (
            <RulesTabSection
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              salary={salaryTransition}
              ruleMap={ruleMap}
              breakdownItems={breakdownItems}
              onActualChange={updateActual}
              onUpdateBreakdownItem={updateBreakdownItem}
              onAddBreakdownItem={addBreakdownItem}
              onRemoveBreakdownItem={removeBreakdownItem}
              onSortBreakdownItems={sortBreakdownItems}
              onClearAll={handleClearAll}
              isLocked={isLocked}
            />
          )}
        </>
      )}

      <BackupModal
        isOpen={showBackup}
        onClose={() => setShowBackup(false)}
        onDataImported={reloadFromStore}
      />
    </div>
  );
}


