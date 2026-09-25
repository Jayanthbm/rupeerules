import React, { useState, useEffect } from 'react';
import { formatMoney } from '../utils/formatters.js';
import {
  loadGoalsData,
  saveGoalsData,
  computeGoalStatuses,
  calculateHouseCurrentValue
} from '../utils/goals.js';
import '../styles/goals.css';


export default function GoalsSection({ salary, actuals, breakdownItems, storeMonths, onNavigateToCalculator }) {
  const [goalsData, setGoalsData] = useState(() => loadGoalsData());
  const [editingAchievedGoal, setEditingAchievedGoal] = useState(null); // goal id being edited (e.g. 'g1')


  // Save changes to localStorage whenever goalsData changes
  useEffect(() => {
    saveGoalsData(goalsData);
  }, [goalsData]);

  const hasSalaryOrMonthData = (Number(salary) > 0) || (storeMonths && Object.keys(storeMonths).length > 0);

  const {
    statuses,
    achieved,
    achievementsChanged,
    overallPercentage,
    weights,
    metrics
  } = computeGoalStatuses(goalsData, actuals, breakdownItems, salary, storeMonths);

  // Sync auto-detected achievements back to goalsData state if changed
  useEffect(() => {
    if (achievementsChanged) {
      setGoalsData(prev => ({
        ...prev,
        achieved
      }));
    }
  }, [achievementsChanged, achieved]);

  // Handler helpers for nested state updates
  const updateField = (path, value) => {
    setGoalsData(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let current = copy;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      return copy;
    });
  };

  const handleAddHouse = () => {
    if ((goalsData.houses || []).length >= 5) return;
    const newHouse = {
      id: Date.now().toString(),
      name: `House ${(goalsData.houses || []).length + 1}`,
      price: '',
      year: new Date().getFullYear().toString(),
      remainingEmi: '',
      useManualValue: false,
      currentValue: ''
    };
    setGoalsData(prev => ({
      ...prev,
      houses: [...(prev.houses || []), newHouse]
    }));
  };

  const handleUpdateHouse = (id, key, val) => {
    setGoalsData(prev => ({
      ...prev,
      houses: (prev.houses || []).map(h => h.id === id ? { ...h, [key]: val } : h)
    }));
  };

  const handleRemoveHouse = (id) => {
    setGoalsData(prev => ({
      ...prev,
      houses: (prev.houses || []).filter(h => h.id !== id)
    }));
  };

  if (!hasSalaryOrMonthData) {
    return (
      <div className="goals-container">
        <div className="goals-gate-card">
          <div className="goals-gate-icon">🎯</div>
          <h3>Goals View Locked</h3>
          <p>
            To see your Financial Goals progress and calculations, please fill in at least one month's salary and actuals in the calculator.
          </p>
          <button className="btn-primary" onClick={onNavigateToCalculator}>
            Go to Calculator
          </button>
        </div>
      </div>
    );
  }

  // Define display goal list sequentially G1 to G10
  const goalDefinitions = [
    {
      id: 'g1',
      code: 'G1',
      title: '₹1L in Account',
      weight: weights.g1,
      isProgress: true,
      renderDetails: (isDone) => isDone ? null : (
        <div>
          <div>Current Emergency Savings: <strong>{formatMoney(actuals[7] || 0)}</strong> / {formatMoney(100000)}</div>
        </div>
      ),
      nudge: 'Set aside money in high-yield savings / liquid MF (Rule 7)'
    },
    {
      id: 'g2',
      code: 'G2',
      title: '₹10 Lakh Investment Portfolio',
      weight: weights.g2,
      isProgress: true,
      renderDetails: () => (
        <div>
          <div>Includes EPF, Stocks, Mutual Funds, and Gold (Rule 8 breakdown)</div>
          <div>Current Portfolio Value: <strong>{formatMoney(metrics.investPortfolio)}</strong> / {formatMoney(1000000)}</div>
        </div>
      ),
      nudge: 'Increase monthly SIPs in index funds & EPF contributions (Rule 8)'
    },
    {
      id: 'g3',
      code: 'G3',
      title: 'International Trip',
      weight: weights.g3,
      isProgress: false,
      renderDetails: () => (
        <div className="goal-input-group">
          <label className="goal-inline-row">
            <input
              type="checkbox"
              checked={!!goalsData.trip?.checked}
              onChange={e => updateField('trip.checked', e.target.checked)}
            />
            <span>Achieved / Planned International Trip</span>
          </label>
          {goalsData.trip?.checked && (
            <div className="goal-inline-row">
              <div className="goal-field-unit">
                <span className="goal-field-label">Target/Achieved Age</span>
                <input
                  type="number"
                  className="house-input"
                  style={{ width: 100 }}
                  placeholder="e.g. 28"
                  value={goalsData.trip?.age || ''}
                  onChange={e => updateField('trip.age', e.target.value)}
                />
              </div>
              <div className="goal-field-unit">
                <span className="goal-field-label">Year</span>
                <input
                  type="number"
                  className="house-input"
                  style={{ width: 100 }}
                  placeholder="e.g. 2026"
                  value={goalsData.trip?.year || ''}
                  onChange={e => updateField('trip.year', e.target.value)}
                />
              </div>
              <div className="goal-field-unit">
                <span className="goal-field-label">Country</span>
                <input
                  type="text"
                  className="house-input"
                  placeholder="e.g. Japan"
                  value={goalsData.trip?.country || ''}
                  onChange={e => updateField('trip.country', e.target.value)}
                />
              </div>
              <div className="goal-field-unit">
                <span className="goal-field-label">Total Spent (₹)</span>
                <input
                  type="number"
                  className="house-input"
                  placeholder="e.g. 150000"
                  value={goalsData.trip?.totalSpent || ''}
                  onChange={e => updateField('trip.totalSpent', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      ),
      nudge: 'Create a dedicated sinking fund for travel'
    },
    {
      id: 'g4',
      code: 'G4',
      title: 'Buy a Car',
      weight: weights.g4,
      isProgress: false,
      renderDetails: () => (
        <div className="goal-input-group">
          <label className="goal-inline-row">
            <input
              type="checkbox"
              checked={!!goalsData.car?.checked}
              onChange={e => updateField('car.checked', e.target.checked)}
            />
            <span>I have bought a car</span>
          </label>
          {goalsData.car?.checked && (
            <div className="goal-inline-row">
              <div className="goal-field-unit">
                <span className="goal-field-label">Car Model</span>
                <input
                  type="text"
                  className="house-input"
                  placeholder="e.g. Nexon EV"
                  value={goalsData.car?.name || ''}
                  onChange={e => updateField('car.name', e.target.value)}
                />
              </div>
              <div className="goal-field-unit">
                <span className="goal-field-label">Price (₹)</span>
                <input
                  type="number"
                  className="house-input"
                  placeholder="Price"
                  value={goalsData.car?.price || ''}
                  onChange={e => updateField('car.price', e.target.value)}
                />
              </div>
              <div className="goal-field-unit">
                <span className="goal-field-label">Year</span>
                <input
                  type="number"
                  className="house-input"
                  style={{ width: 100 }}
                  placeholder="Year"
                  value={goalsData.car?.year || ''}
                  onChange={e => updateField('car.year', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      ),
      nudge: 'Save 100% upfront or follow 20/4/10 car buying rule'
    },
    {
      id: 'g5',
      code: 'G5',
      title: 'Own a House',
      weight: weights.g5,
      isProgress: false,
      renderDetails: () => (
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Add up to 5 properties. Values & remaining EMIs automatically feed into Goal 8 (Total Assets) and Goal 9 (Net Worth).
          </div>
          <div className="house-cards-grid">
            {(goalsData.houses || []).map((h, idx) => {
              const estVal = calculateHouseCurrentValue(h, goalsData.houseAppreciationRate || 3);
              return (
                <div key={h.id} className="house-item-card">
                  <div className="house-item-header">
                    <span className="house-item-title">🏠 {h.name || `Property #${idx + 1}`}</span>
                    <button type="button" className="house-remove-btn" onClick={() => handleRemoveHouse(h.id)}>Remove</button>
                  </div>
                  <div className="house-card-fields">
                    <input
                      type="text"
                      className="house-input"
                      placeholder="Property Name (e.g. 2BHK Flat)"
                      value={h.name || ''}
                      onChange={e => handleUpdateHouse(h.id, 'name', e.target.value)}
                    />
                    <div className="house-input-row">
                      <input
                        type="number"
                        className="house-input house-input-price"
                        placeholder="Purchase Price (₹)"
                        value={h.price || ''}
                        onChange={e => handleUpdateHouse(h.id, 'price', e.target.value)}
                      />
                      <input
                        type="number"
                        className="house-input house-input-year"
                        placeholder="Year"
                        value={h.year || ''}
                        onChange={e => handleUpdateHouse(h.id, 'year', e.target.value)}
                      />
                    </div>
                    <input
                      type="number"
                      className="house-input"
                      placeholder="Remaining EMI Loan (₹)"
                      value={h.remainingEmi || ''}
                      onChange={e => handleUpdateHouse(h.id, 'remainingEmi', e.target.value)}
                    />
                    <label className="house-manual-toggle">
                      <input
                        type="checkbox"
                        checked={!!h.useManualValue}
                        onChange={e => handleUpdateHouse(h.id, 'useManualValue', e.target.checked)}
                      />
                      <span>Set Manual Current Value</span>
                    </label>
                    {h.useManualValue ? (
                      <input
                        type="number"
                        className="house-input"
                        placeholder="Manual Valuation (₹)"
                        value={h.currentValue || ''}
                        onChange={e => handleUpdateHouse(h.id, 'currentValue', e.target.value)}
                      />
                    ) : (
                      <div className="house-est-valuation">
                        Est. Current Value: <strong>{formatMoney(estVal)}</strong> ({goalsData.houseAppreciationRate || 3}%/yr)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {(goalsData.houses || []).length < 5 && (
            <button
              type="button"
              className="house-add-btn"
              onClick={handleAddHouse}
            >
              + Add Property
            </button>
          )}
        </div>
      ),
      nudge: 'Ensure home loan EMI does not exceed 30% of net monthly income'
    },
    {
      id: 'g6',
      code: 'G6',
      title: 'Second Income Stream',
      weight: weights.g6,
      isProgress: false,
      renderDetails: () => (
        <div className="goal-input-group">
          <label className="goal-inline-row">
            <input
              type="checkbox"
              checked={!!goalsData.secondIncome?.checked}
              onChange={e => updateField('secondIncome.checked', e.target.checked)}
            />
            <span>I have set up at least one active side-income or secondary earning source</span>
          </label>
        </div>
      ),
      nudge: 'Monetize a skill, freelance, or build a side project'
    },
    {
      id: 'g7',
      code: 'G7',
      title: 'Passive Income > Monthly Expense',
      weight: weights.g7,
      isProgress: true,
      renderDetails: () => (
        <div>
          <div style={{ marginBottom: 8 }}>
            Est. Monthly Emergency Expense ({metrics.expenseSource || '3-mo avg or salary'}): <strong>{formatMoney(metrics.avgEmergencyExpense)}</strong>
          </div>
          <div className="goal-input-group">
            <label className="goal-inline-row">
              <input
                type="checkbox"
                checked={!!goalsData.passiveIncome?.checked}
                onChange={e => updateField('passiveIncome.checked', e.target.checked)}
              />
              <span>Generate Passive Income</span>
            </label>
            {goalsData.passiveIncome?.checked && (
              <div className="goal-inline-row" style={{ marginTop: 6 }}>
                <div className="goal-field-unit">
                  <span className="goal-field-label">Monthly Passive Amount (₹)</span>
                  <input
                    type="number"
                    className="house-input"
                    placeholder="e.g. 25000"
                    value={goalsData.passiveIncome?.monthlyAmount || ''}
                    onChange={e => updateField('passiveIncome.monthlyAmount', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ),
      nudge: 'Build dividend, rental, or royalty assets to cover basic living expenses'
    },
    {
      id: 'g8',
      code: 'G8',
      title: '₹1 Crore Total Assets',
      weight: weights.g8,
      isProgress: true,
      renderDetails: () => (
        <div>
          <div>Total Assets: <strong>{formatMoney(metrics.totalAssets)}</strong> / {formatMoney(10000000)}</div>
          
          <div className="goal-breakdown-box" style={{ marginTop: 8, padding: '8px 12px', background: 'var(--mrc-bg-tertiary)', borderRadius: 8, border: '1px solid var(--mrc-border)', fontSize: '0.825rem' }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--mrc-text)' }}>Asset Breakdown:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, color: 'var(--mrc-text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>• Emergency Fund (Rule 7):</span>
                <strong>{formatMoney(metrics.efActual)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>• Investment Corpus (Rule 8):</span>
                <strong>{formatMoney(metrics.fireActual)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>• Real Estate Est. Value ({goalsData.houses?.length || 0} properties):</span>
                <strong>{formatMoney(metrics.totalHouseValue)}</strong>
              </div>
            </div>
          </div>

          {metrics.g8ProjectionText && (
            <div style={{ fontSize: '0.8rem', color: 'var(--mrc-accent, #2563eb)', marginTop: 8, fontWeight: 500 }}>
              ⏱️ {metrics.g8ProjectionText}
            </div>
          )}
        </div>
      ),
      nudge: 'Maintain compounding across real estate and market investments'
    },
    {
      id: 'g9',
      code: 'G9',
      title: 'Dream Milestone: ₹10 Crore Net Worth',
      weight: weights.g9,
      isProgress: true,
      renderDetails: () => (
        <div>
          <div>Current Net Worth: <strong>{formatMoney(metrics.netWorth)}</strong> / {formatMoney(100000000)}</div>

          <div className="goal-breakdown-box" style={{ marginTop: 8, padding: '8px 12px', background: 'var(--mrc-bg-tertiary)', borderRadius: 8, border: '1px solid var(--mrc-border)', fontSize: '0.825rem' }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--mrc-text)' }}>Net Worth Breakdown:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, color: 'var(--mrc-text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>• Total Assets (EF + Investments + Property):</span>
                <strong>+{formatMoney(metrics.totalAssets)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                <span>• Less Total Remaining House Loans:</span>
                <strong>−{formatMoney(metrics.totalHouseEmi)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--mrc-border)', paddingTop: 4, marginTop: 2, color: 'var(--mrc-text)' }}>
                <span>= Net Worth:</span>
                <strong>{formatMoney(metrics.netWorth)}</strong>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--mrc-text-muted)', marginTop: 6 }}>
            Tip: Complete ₹1Cr milestone (Goal 8) first
          </div>
        </div>
      ),
      nudge: 'Focus on scaling primary income, secondary income, and long-term equity compounding'
    },
    {
      id: 'g10',
      code: 'G10',
      title: 'Zero EMI (Debt Free)',
      weight: weights.g10,
      isProgress: false,
      renderDetails: () => (
        <div>
          <div>Current Total Monthly EMI: <strong>{formatMoney(actuals[6] || 0)}</strong></div>
        </div>
      ),
      nudge: 'Prepay existing loans before starting new investments (Rule 6)'
    }
  ];

  return (
    <div className="goals-container">
      {/* Header & Overall Progress */}
      <div className="goals-header-card">
        <div className="goals-header-top">
          <div className="goals-title-group">
            <h2>🎯 Financial Goals</h2>
            <p className="goals-subtitle">Track key wealth milestones and life goals</p>
          </div>
        </div>

        <div className="goals-progress-overview">
          <div className="goals-progress-labels">
            <span>Overall Progress</span>
            <span>{overallPercentage}% Completed</span>
          </div>
          <div className="goals-progress-bar-bg">
            <div className="goals-progress-bar-fill" style={{ width: `${overallPercentage}%` }}></div>
          </div>
        </div>

        <div className="goals-settings-bar">
          <div className="goals-setting-item">
            <span>House Appreciation Rate:</span>
            <input
              type="number"
              className="house-input"
              style={{ width: 70, display: 'inline-block' }}
              value={goalsData.houseAppreciationRate ?? 3}
              onChange={e => updateField('houseAppreciationRate', Number(e.target.value))}
            />
            <span>% / yr</span>
          </div>

          <div className="goals-setting-item">
            <span>Dream Milestone Weight:</span>
            <select
              className="goal-select"
              value={goalsData.dreamMilestonePreset || 'standard'}
              onChange={e => updateField('dreamMilestonePreset', e.target.value)}
            >
              <option value="lightweight">Lightweight (5% G9 weight)</option>
              <option value="standard">Standard (15% G9 weight)</option>
              <option value="big-bet">Big Bet (25% G9 weight)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Goals List */}
      <div className="goals-list">
        {goalDefinitions.map((def) => {
          const status = statuses[def.id] || { done: false, progress: 0 };
          const isDone = status.done;
          const pct = Math.round((status.progress || 0) * 100);
          const achievedDate = achieved[def.id];
          const weightPct = Math.round(def.weight * 100);

          const isG1 = def.id === 'g1';

          return (
            <div key={def.id} className={`goal-card ${isDone ? 'completed' : ''}`}>
              <div className="goal-card-header">
                <div className="goal-title-wrapper">
                  <span className="goal-badge">{def.code}</span>
                  <h3 className="goal-title">{def.title}</h3>
                  <span className="goal-weight-tag">{weightPct}% weight</span>
                </div>
                <div
                  className={`goal-status-badge ${isDone ? 'achieved' : 'pending'}`}
                  style={isDone && isG1 ? { cursor: 'pointer' } : {}}
                  onClick={() => {
                    if (isDone && isG1) {
                      setEditingAchievedGoal(prev => prev === def.id ? null : def.id);
                    }
                  }}
                  title={isDone && isG1 ? "Click to edit achieved date/year" : ""}
                >
                  {isDone ? (
                    <>
                      <span>🏆 Achieved</span>
                      {achievedDate && <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>({achievedDate})</span>}
                      {isG1 && <span style={{ fontSize: '0.7rem', opacity: 0.75, marginLeft: 2 }}>✏️</span>}
                    </>
                  ) : (
                    <span>In Progress</span>
                  )}
                </div>
              </div>

              <div className="goal-card-body">
                {isDone && isG1 && editingAchievedGoal === def.id && (
                  <div className="goal-input-group" style={{ marginTop: 4, marginBottom: 10, padding: '10px 14px' }}>
                    <div className="goal-inline-row">
                      <div className="goal-field-unit">
                        <span className="goal-field-label">Achieved Date / Year</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="text"
                            className="house-input"
                            style={{ width: 140 }}
                            placeholder="e.g. 2024 or 2024-05"
                            value={goalsData.achieved?.[def.id] || ''}
                            onChange={e => updateField(`achieved.${def.id}`, e.target.value)}
                          />
                          <button
                            type="button"
                            className="house-add-btn"
                            style={{ marginTop: 0, padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => setEditingAchievedGoal(null)}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {def.renderDetails(isDone)}

                {def.isProgress && !isDone && (
                  <div className="goal-mini-progress">
                    <div className="goal-mini-bar-bg">
                      <div className="goal-mini-bar-fill" style={{ width: `${pct}%` }}></div>
                    </div>
                    <div className="goal-mini-labels">
                      <span>Progress</span>
                      <span>{pct}%</span>
                    </div>
                  </div>
                )}

                {!isDone && def.nudge && (
                  <div className="goal-nudge">
                    <span className="goal-nudge-icon">💡</span>
                    <span>{def.nudge}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
