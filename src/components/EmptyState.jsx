export default function EmptyState() {
  return (
    <div className="mrc-empty">
      <div className="mrc-empty-content">
        <div className="mrc-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <p className="mrc-empty-title">Enter your monthly salary</p>
        <p className="mrc-empty-desc">
          Type your monthly take-home salary above and click "Calculate" (or press Enter).
          Your personalized money rules will appear with recommended amounts and progress tracking.
        </p>
      </div>
    </div>
  );
}
