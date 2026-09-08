export default function Header({
  darkMode,
  onToggleDarkMode,
  onOpenReports,
  onOpenBackup,
}) {
  return (
    <header className="mrc-header">
      <div className="mrc-brand">
        <div className="mrc-logo">
          <span className="mrc-logo-mark">₹</span>
          <span className="mrc-logo-text">RupeeRules</span>
        </div>
        <p className="mrc-tagline">smart money rules for your take-home pay</p>
      </div>
      <div className="mrc-header-actions">
        <button
          type="button"
          className="mrc-header-icon-btn"
          onClick={onOpenReports}
          title="View monthly reports & trends"
          aria-label="Reports"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span className="mrc-btn-text-desktop">Reports</span>
        </button>

        <button
          type="button"
          className="mrc-header-icon-btn"
          onClick={onOpenBackup}
          title="Backup and restore data"
          aria-label="Backup"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="mrc-btn-text-desktop">Backup</span>
        </button>

        <button
          type="button"
          className="mrc-dark-toggle"
          onClick={onToggleDarkMode}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <circle cx="12" cy="5" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
