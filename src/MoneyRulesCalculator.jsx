import { useState } from "react";
import { useDarkMode } from "./hooks/useDarkMode";
import { useMoneyRules } from "./hooks/useMoneyRules";
import Header from "./components/Header";
import MonthPicker from "./components/MonthPicker";
import SalaryInput from "./components/SalaryInput";
import EmptyState from "./components/EmptyState";
import RulesTabSection from "./components/RulesTabSection";
import ReportsModal from "./components/ReportsModal";
import BackupModal from "./components/BackupModal";

export default function MoneyRulesCalculator() {
  const [darkMode, setDarkMode] = useDarkMode();
  const [showReports, setShowReports] = useState(false);
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
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        onOpenReports={() => setShowReports(true)}
        onOpenBackup={() => setShowBackup(true)}
      />

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

      <ReportsModal
        isOpen={showReports}
        onClose={() => setShowReports(false)}
        store={store}
      />

      <BackupModal
        isOpen={showBackup}
        onClose={() => setShowBackup(false)}
        onDataImported={reloadFromStore}
      />
    </div>
  );
}
