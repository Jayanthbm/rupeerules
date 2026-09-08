import { useState } from "react";
import { useDarkMode } from "./hooks/useDarkMode";
import { useMoneyRules } from "./hooks/useMoneyRules";
import Header from "./components/Header";
import MonthPicker from "./components/MonthPicker";
import SalaryInput from "./components/SalaryInput";
import EmptyState from "./components/EmptyState";
import RulesTabSection from "./components/RulesTabSection";
import ReportsPage from "./components/ReportsPage";
import BackupModal from "./components/BackupModal";

export default function MoneyRulesCalculator() {
  const [darkMode, setDarkMode] = useDarkMode();
  const [currentView, setCurrentView] = useState("calculator"); // 'calculator' | 'reports'
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
    handleClearAll,
    rulesWithAmounts,
    ruleMap,
    breakdownItems,
  } = useMoneyRules();

  return (
    <div className="mrc-shell" data-theme={darkMode ? "dark" : "light"}>
      <Header
        darkMode={darkMode}
        currentView={currentView}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        onOpenReports={() => setCurrentView((prev) => (prev === "reports" ? "calculator" : "reports"))}
        onOpenBackup={() => setShowBackup(true)}
      />

      {currentView === "reports" ? (
        <ReportsPage
          store={store}
          onBackToCalculator={() => setCurrentView("calculator")}
        />
      ) : (
        <>
          <MonthPicker
            activeMonth={activeMonth}
            onSwitchMonth={switchMonth}
            onCopyPrevious={copyFromMonth}
            months={store.months}
          />

          <SalaryInput
            monthlySalary={monthlySalary}
            salaryTransition={salaryTransition}
            onSalaryChange={handleSalaryChange}
            onSalaryCommit={handleSalaryCommit}
            rulesWithAmounts={rulesWithAmounts}
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
              onClearAll={handleClearAll}
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

