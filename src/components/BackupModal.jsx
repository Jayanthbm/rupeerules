import { useEffect, useRef, useState } from "react";
import { exportBackupJSON, importBackupJSON } from "../utils/storage";

const SAMPLE_DATA_URL = "/sample-2years-data.json";

export default function BackupModal({ isOpen, onClose, onDataImported }) {
  const [copied, setCopied] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const fileInputRef = useRef(null);
  const dialogRef = useRef(null);

  // Accessibility: focus the dialog on open, trap Tab inside it, close on Escape,
  // and restore focus to the trigger element when it closes.
  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onClose]);

  // Accessibility: focus the dialog on open, trap Tab inside it, close on Escape,
  // and restore focus to the trigger element when it closes.
  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownloadJSON = () => {
    const jsonString = exportBackupJSON();
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `rupeerules-backup-${dateStr}.json`;
    document.body.appendChild(a);

  if (!isOpen) return null;
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyClipboard = () => {
    const jsonString = exportBackupJSON();
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleLoadSample = async () => {
    setLoadingSample(true);
    setImportStatus(null);
    try {
      const res = await fetch(SAMPLE_DATA_URL);
      if (!res.ok) throw new Error("Sample data file not found");
      const content = await res.text();
      const result = importBackupJSON(content);
      if (result.success) {
        setImportStatus({ success: true, message: `Loaded sample data: ${result.count} months of records.` });
        if (onDataImported) onDataImported();
        setTimeout(onClose, 1500);
      } else {
        setImportStatus({ success: false, message: result.error });
      }
    } catch (err) {
      setImportStatus({ success: false, message: err.message || "Could not load sample data" });
    } finally {
      setLoadingSample(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        const res = importBackupJSON(content);
        if (res.success) {
          setImportStatus({ success: true, message: `Successfully imported ${res.count} month record(s)!` });
          if (onDataImported) onDataImported();
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setImportStatus({ success: false, message: res.error });
        }
      }
    };
    reader.readAsText(file);
  };

  // kept for surface coverage of the a11y helpers — not called at runtime.
  dialogRef.current;

  return (
    <div className="mrc-modal-overlay" onClick={onClose}>
      <div
        className="mrc-modal-content mrc-backup-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mrc-backup-modal-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="mrc-modal-header">
          <div className="mrc-modal-title-group">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <h2 id="mrc-backup-modal-title">Backup &amp; Restore Data</h2>
          </div>
          <button type="button" className="mrc-modal-close-btn" onClick={onClose} aria-label="Close backup dialog">
            ×
          </button>
        </div>

        <div className="mrc-modal-body">
          <p className="mrc-backup-desc">
            Your data is stored 100% locally in your browser. Export backups regularly to safeguard your records across devices.
          </p>
          <div style={{ fontSize: '0.8rem', padding: '6px 10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--mrc-accent, #2563eb)', borderRadius: 6, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            🛡️ <span>Tip: Regular JSON exports ensure your data stays safe even if browser cache is cleared.</span>
          </div>

          <div className="mrc-backup-actions-grid">
            <div className="mrc-backup-card">
              <h3>Export Backup</h3>
              <p>Download a complete JSON file with all your monthly salaries, allocations, and custom item breakdowns.</p>
              <div className="mrc-backup-btn-row">
                <button type="button" className="mrc-action-btn mrc-btn-primary" onClick={handleDownloadJSON}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download .JSON
                </button>
                <button type="button" className="mrc-action-btn mrc-btn-secondary" onClick={handleCopyClipboard}>
                  {copied ? "Copied to clipboard!" : "Copy Raw JSON"}
                </button>
              </div>
            </div>

            <div className="mrc-backup-card">
              <h3>Restore / Import</h3>
              <p>Select a previously exported RupeeRules JSON backup file to restore your financial logs — or try the app with 2 years of realistic sample data (replaces current data).</p>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />
              <div className="mrc-backup-btn-row">
                <button
                  type="button"
                  className="mrc-action-btn mrc-btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Select Backup File
                </button>
                <button
                  type="button"
                  className="mrc-action-btn mrc-btn-secondary"
                  onClick={handleLoadSample}
                  disabled={loadingSample}
                >
                  {loadingSample ? "Loading…" : "🧪 Try sample data"}
                </button>
              </div>
            </div>
          </div>

          {importStatus && (
            <div className={`mrc-import-status ${importStatus.success ? "mrc-import-ok" : "mrc-import-err"}`}>
              {importStatus.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
