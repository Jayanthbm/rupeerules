import { useDarkMode } from "./hooks/useDarkMode";
import { useMoneyRules } from "./hooks/useMoneyRules";
import Header from "./components/Header";
import SalaryInput from "./components/SalaryInput";
import EmptyState from "./components/EmptyState";
import RulesTabSection from "./components/RulesTabSection";

export default function MoneyRulesCalculator() {
  const [darkMode, setDarkMode] = useDarkMode();
  const {
    monthlySalary,
    salaryTransition,
    activeTab,
    setActiveTab,
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
    </div>
  );
}
