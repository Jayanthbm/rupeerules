import { useState, useEffect } from "react";
import { getSupabaseClient, probeSupabaseSchema, validateSupabaseCredentials } from "../utils/sync/supabaseClient";
import { getSyncState, saveSyncState } from "../utils/sync/storePersistence";
import { SETUP_SQL_SCRIPT } from "../utils/sync/setupSql";
import { performFullSync, forceReSyncFromCloud, clearDatabaseAndLocal } from "../utils/sync/syncEngine";

export default function SyncPage({ onReloadStore }) {
  const [syncState, setSyncState] = useState(getSyncState());
  const [urlInput, setUrlInput] = useState(syncState.supabaseUrl || "");
  const [anonKeyInput, setAnonKeyInput] = useState(syncState.supabaseAnonKey || "");
  const [isEditingConfig, setIsEditingConfig] = useState(!syncState.supabaseUrl || !syncState.supabaseAnonKey);

  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [user, setUser] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error' | 'info', text }
  const [schemaStatus, setSchemaStatus] = useState(null); // { connected, tablesExist, error }
  const [copiedSql, setCopiedSql] = useState(false);

  const isConfigured = Boolean(syncState.supabaseUrl && syncState.supabaseAnonKey);

  // Initialize client and session check
  useEffect(() => {
    if (isConfigured) {
      const client = getSupabaseClient();
      if (client) {
        client.auth.getUser().then(({ data, error }) => {
          if (data?.user) {
            setUser(data.user);
            checkSchema();
          }
        });
      }
    }
  }, [isConfigured]);

  const handleSyncNow = async () => {
    setSyncing(true);
    setMessage(null);
    const res = await performFullSync(onReloadStore);
    setSyncing(false);
    setSyncState(getSyncState());

    if (res.success) {
      if (res.cleared) {
        setMessage({ type: "info", text: "Database was cleared on another device. Local storage updated." });
      } else {
        setMessage({ type: "success", text: `⚡ Synced successfully (${res.count} month records)!` });
      }
    } else {
      setMessage({ type: "error", text: `Sync failed: ${res.error}` });
    }
  };

  const handleForceReSync = async () => {
    const confirmed = window.confirm(
      "🔄 Force Re-sync will overwrite your local browser data with fresh records pulled directly from Supabase.\n\nDo you want to proceed?"
    );
    if (!confirmed) return;

    setSyncing(true);
    setMessage(null);
    const res = await forceReSyncFromCloud(onReloadStore);
    setSyncing(false);
    setSyncState(getSyncState());

    if (res.success) {
      setMessage({ type: "success", text: `🔄 Force re-synced cleanly (${res.count} month records from cloud)!` });
    } else {
      setMessage({ type: "error", text: `Force re-sync failed: ${res.error}` });
    }
  };

  const handleClearDatabaseAndLocal = async () => {
    const confirmed = window.confirm(
      "⚠️ DANGER: This will permanently delete ALL your financial records from Supabase cloud database AND your local browser storage across all synced devices.\n\nAre you sure you want to proceed?"
    );

    if (!confirmed) return;

    setLoading(true);
    await clearDatabaseAndLocal();
    setLoading(false);
    setSyncState(getSyncState());
    setUser(null);
    setMessage({ type: "info", text: "Cloud database and local storage cleared." });

    if (typeof onReloadStore === "function") {
      onReloadStore({ months: {} });
    }
  };

  const checkSchema = async () => {
    setLoading(true);
    const status = await probeSupabaseSchema();
    setSchemaStatus(status);
    setLoading(false);
  };

  const handleSaveCredentials = async (e) => {
    e.preventDefault();
    const cleanUrl = urlInput.trim();
    const cleanKey = anonKeyInput.trim();

    setLoading(true);
    setMessage(null);

    // Validate Supabase credentials against Auth endpoint
    const validation = await validateSupabaseCredentials(cleanUrl, cleanKey);
    setLoading(false);

    if (!validation.valid) {
      setMessage({ type: "error", text: validation.error });
      return;
    }

    saveSyncState({ supabaseUrl: cleanUrl, supabaseAnonKey: cleanKey });
    setSyncState(getSyncState());
    setIsEditingConfig(false);
    setMessage({ type: "success", text: "✅ Supabase configuration verified and saved!" });

    // Check schema if user logged in
    setTimeout(checkSchema, 300);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const client = getSupabaseClient();
    if (!client) {
      setMessage({ type: "error", text: "Please configure valid Supabase credentials first." });
      return;
    }

    setLoading(true);
    setMessage(null);
    const { data, error } = await client.auth.signInWithPassword({
      email: emailInput.trim(),
      password: passwordInput,
    });

    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else if (data?.user) {
      setUser(data.user);
      setMessage({ type: "success", text: `Logged in as ${data.user.email}` });
      await checkSchema();
    }
  };

  const handleSignOut = async () => {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    setUser(null);
    setSchemaStatus(null);
    setMessage({ type: "info", text: "Signed out successfully." });
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SETUP_SQL_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="mrc-section mrc-sync-page" style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <h2>☁️ Cloud Sync Settings</h2>
      </div>

      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "20px",
            backgroundColor: message.type === "error" ? "rgba(220, 38, 38, 0.1)" : message.type === "success" ? "rgba(34, 197, 94, 0.1)" : "rgba(37, 99, 235, 0.1)",
            border: `1px solid ${message.type === "error" ? "#dc2626" : message.type === "success" ? "#22c55e" : "#2563eb"}`,
            color: "var(--mrc-text)",
          }}
        >
          {message.text}
        </div>
      )}

      {/* Section 1: Supabase Configuration & Status */}
      <section className="mrc-input-section" style={{ marginBottom: "20px", padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: "16px", margin: 0, marginBottom: "6px" }}>Supabase Connection</h3>
            <div style={{ fontSize: "13px", color: "var(--mrc-subtext)", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {isConfigured ? (
                <>
                  <span>✓ <strong>Configured</strong></span>
                  <span>•</span>
                  <code style={{ fontSize: "12px", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px" }}>
                    {syncState.supabaseUrl}
                  </code>
                </>
              ) : (
                <span>⚪ Not configured</span>
              )}

              {user && (
                <>
                  <span>•</span>
                  <span>✓ <strong>Logged in</strong> ({user.email})</span>
                </>
              )}

              {user && schemaStatus?.tablesExist && (
                <>
                  <span>•</span>
                  <span>✓ <strong>Database Ready</strong></span>
                </>
              )}
            </div>
          </div>

          {isConfigured && !isEditingConfig && (
            <button
              className="mrc-calculate-btn"
              type="button"
              onClick={() => setIsEditingConfig(true)}
              style={{ padding: "4px 12px", fontSize: "12px" }}
            >
              ✏️ Edit Config
            </button>
          )}
        </div>

        {(!isConfigured || isEditingConfig) && (
          <form onSubmit={handleSaveCredentials} style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <p style={{ fontSize: "13px", color: "var(--mrc-subtext)", marginBottom: "12px" }}>
              Enter Project URL and <strong>Publishable key</strong> (or legacy Anon key) from Supabase Dashboard → Settings → API keys.
            </p>

            <div style={{ marginBottom: "12px" }}>
              <label className="mrc-field-label">Project URL</label>
              <input
                className="mrc-input"
                type="url"
                placeholder="https://xyz.supabase.co"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label className="mrc-field-label">Publishable Key (or Anon Key)</label>
              <input
                className="mrc-input"
                type="text"
                placeholder="sbp_... or eyJhbGciOi..."
                value={anonKeyInput}
                onChange={(e) => setAnonKeyInput(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button className="mrc-calculate-btn" type="submit" disabled={loading}>
                {loading ? "Validating..." : "Validate & Save Configuration"}
              </button>
              {isConfigured && (
                <button className="mrc-clear-btn" type="button" onClick={() => setIsEditingConfig(false)}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      {/* Section 2: User Login Form (Only when configured and not logged in) */}
      {isConfigured && !user && (
        <section className="mrc-input-section" style={{ marginBottom: "20px", padding: "16px" }}>
          <h3 style={{ fontSize: "16px", margin: 0, marginBottom: "12px" }}>User Account Login</h3>
          <form onSubmit={handleLogin}>
            <p style={{ fontSize: "13px", color: "var(--mrc-subtext)", marginBottom: "12px" }}>
              Log in with your account created in Supabase Dashboard → Authentication → Users.
            </p>
            <div style={{ marginBottom: "12px" }}>
              <label className="mrc-field-label">Email</label>
              <input
                className="mrc-input"
                type="email"
                placeholder="user@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label className="mrc-field-label">Password</label>
              <input
                className="mrc-input"
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <button className="mrc-calculate-btn" type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>
        </section>
      )}

      {/* Section 3: Sync Actions & Management (Clean Redesign) */}
      {isConfigured && user && (
        <section className="mrc-input-section" style={{ marginBottom: "20px", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", margin: 0 }}>Sync Actions & Account Management</h3>
            <span style={{ fontSize: "12px", color: "var(--mrc-subtext)" }}>
              {syncState.lastSyncedAt
                ? `Last synced: ${new Date(syncState.lastSyncedAt).toLocaleTimeString()}`
                : "Not synced yet"}
            </span>
          </div>

          {/* Quick Action Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            {/* 1. Sync Now */}
            <button
              className="mrc-calculate-btn"
              onClick={handleSyncNow}
              disabled={syncing || loading}
              type="button"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 16px" }}
            >
              <span>⚡</span>
              <span>{syncing ? "Syncing..." : "Sync Now"}</span>
            </button>

            {/* 2. Force Re-sync */}
            <button
              className="mrc-calculate-btn"
              onClick={handleForceReSync}
              disabled={syncing || loading}
              type="button"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 16px", backgroundColor: "rgba(37, 99, 235, 0.15)", color: "#2563eb", border: "1px solid rgba(37, 99, 235, 0.3)" }}
              title="Clears local storage and pulls fresh data from Supabase"
            >
              <span>🔄</span>
              <span>Force Re-sync</span>
            </button>

            {/* 3. Sign Out */}
            <button
              className="mrc-clear-btn"
              onClick={handleSignOut}
              disabled={syncing || loading}
              type="button"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 16px" }}
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          </div>

          {/* Danger Zone */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h4 style={{ fontSize: "14px", color: "#dc2626", margin: 0, marginBottom: "2px" }}>Clear DB & Local Storage</h4>
                <p style={{ fontSize: "12px", color: "var(--mrc-subtext)", margin: 0 }}>
                  Permanently wipe all records from both Supabase cloud database and local browser.
                </p>
              </div>
              <button
                className="mrc-clear-btn"
                onClick={handleClearDatabaseAndLocal}
                disabled={loading || syncing}
                type="button"
                style={{ color: "#dc2626", borderColor: "rgba(220, 38, 38, 0.4)", padding: "6px 14px", fontSize: "12px", whiteSpace: "nowrap" }}
              >
                🗑️ Clear All
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Section 4: Schema Health & Setup Instructions (Only shown if tables are MISSING) */}
      {isConfigured && user && schemaStatus && !schemaStatus.tablesExist && (
        <section className="mrc-input-section" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h3 style={{ fontSize: "16px", margin: 0 }}>Database Setup Instructions</h3>
            <button className="mrc-calculate-btn" onClick={checkSchema} disabled={loading} type="button" style={{ padding: "4px 12px", fontSize: "12px" }}>
              🔄 Re-verify Tables
            </button>
          </div>

          <div style={{ padding: "16px", borderRadius: "8px", backgroundColor: "rgba(234, 179, 8, 0.1)", border: "1px solid #eab308" }}>
            <h4 style={{ color: "#d97706", marginBottom: "8px" }}>⚠️ Supabase Connected, but Tables Not Found</h4>
            <p style={{ fontSize: "14px", marginBottom: "12px" }}>
              Your project needs the RupeeRules tables created once. Follow these steps:
            </p>
            <ol style={{ fontSize: "14px", paddingLeft: "20px", marginBottom: "15px", lineHeight: "1.6" }}>
              <li>Click the button below to copy the complete setup SQL.</li>
              <li>Open your <strong>Supabase Dashboard → SQL Editor → New Query</strong>.</li>
              <li>Paste the script, click <strong>Run</strong>, then click <strong>Re-verify Tables</strong> above.</li>
            </ol>
            <button className="mrc-calculate-btn" onClick={handleCopySql} type="button">
              {copiedSql ? "✓ SQL Copied!" : "📋 Copy Setup SQL Script"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
