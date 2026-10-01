const SYNC_STATE_KEY = "rupeerules_sync_state_v1";

/**
 * Default sync state shape
 */
const DEFAULT_SYNC_STATE = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  userSession: null,
  dirtyKeys: [], // month keys or 'goals' needing sync
  lastSyncedAt: null,
  clearedAt: null,
};

/**
 * Read sync state from localStorage
 */
export function getSyncState() {
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    if (!raw) return DEFAULT_SYNC_STATE;
    return { ...DEFAULT_SYNC_STATE, ...JSON.parse(raw) };
  } catch (err) {
    console.error("Failed to read sync state:", err);
    return DEFAULT_SYNC_STATE;
  }
}

/**
 * Save sync state to localStorage
 */
export function saveSyncState(state) {
  try {
    const current = getSyncState();
    const updated = { ...current, ...state };
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error("Failed to save sync state:", err);
  }
}

/**
 * Mark keys as dirty for cloud sync
 */
export function markDirtyKeys(keys) {
  const state = getSyncState();
  const keyArray = Array.isArray(keys) ? keys : [keys];
  const set = new Set([...state.dirtyKeys, ...keyArray]);
  saveSyncState({ dirtyKeys: Array.from(set) });
}

/**
 * Clear dirty keys after push
 */
export function clearDirtyKeys(keysToClear) {
  const state = getSyncState();
  const clearArray = Array.isArray(keysToClear) ? keysToClear : [keysToClear];
  const set = new Set(state.dirtyKeys);
  clearArray.forEach((k) => set.delete(k));
  saveSyncState({ dirtyKeys: Array.from(set) });
}

/**
 * Read effective Supabase creds (localStorage overrides env vars)
 */
export function getSupabaseCredentials() {
  const state = getSyncState();
  const url = state.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || "";
  const anonKey = state.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  return { url, anonKey };
}

const SYNCED_SNAPSHOT_KEY = "rupeerules_synced_snapshot_v1";

/**
 * Get last known synced state from localStorage (eliminates GET network requests before push)
 */
export function getSyncedSnapshot() {
  try {
    const raw = localStorage.getItem(SYNCED_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

/**
 * Update last known synced state in localStorage after successful sync/push
 */
export function saveSyncedSnapshot(snapshot) {
  try {
    const current = getSyncedSnapshot();
    const updated = { ...current, ...snapshot };
    localStorage.setItem(SYNCED_SNAPSHOT_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error("Failed to save synced snapshot:", err);
  }
}
