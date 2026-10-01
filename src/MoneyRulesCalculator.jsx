import { useState, useEffect, useRef } from "react";
import { useDarkMode } from "./hooks/useDarkMode";
import { useMoneyRules } from "./hooks/useMoneyRules";
import { performFullSync, pushLocalToCloud } from "./utils/sync/syncEngine";
import { getSyncState } from "./utils/sync/storePersistence";
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

const FIFTEEN_MINS_MS = 15 * 60 * 1000;

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

  // 1. Pull from cloud on App Load if last sync was > 15 mins ago
  useEffect(() => {
    const syncState = getSyncState();
    const lastSync = syncState.lastSyncedAt || 0;
    const now = Date.now();

    if (now - lastSync > FIFTEEN_MINS_MS) {
      performFullSync(reloadFromStore);
    }
  }, [reloadFromStore]);

  // 2. Silent background push (Local -> Cloud) on store edit (debounced 2s)
  // Does NOT reload React state, ensuring input focus, item creation, and lock status stay 100% stable
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      pushLocalToCloud();
    }, 2000);

    return () => clearTimeout(timer);
  }, [store]);

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


