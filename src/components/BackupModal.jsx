import { useState, useRef } from "react";
import { exportBackupJSON, importBackupJSON } from "../utils/storage";

export default function BackupModal({ isOpen, onClose, onDataImported }) {
  const [copied, setCopied] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);

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

  return (
    <div className="mrc-modal-overlay" onClick={onClose}>
      <div className="mrc-modal-content mrc-backup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mrc-modal-header">
          <div className="mrc-modal-title-group">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <h2>Backup &amp; Restore Data</h2>
          </div>
          <button type="button" className="mrc-modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="mrc-modal-body">
          <p className="mrc-backup-desc">
            Your data is stored 100% locally in your browser. Export backups to save your records, or import JSON files across your devices.
          </p>

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
              <p>Select a previously exported RupeeRules JSON backup file to restore your financial logs.</p>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />
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
