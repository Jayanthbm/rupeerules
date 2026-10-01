import { getSupabaseClient } from "./supabaseClient";
import { getSyncState, saveSyncState, markDirtyKeys, clearDirtyKeys } from "./storePersistence";
import { loadAllData, saveAllData } from "../storage";
import { loadGoalsData, saveGoalsData } from "../goals";

/**
 * Pure LWW (Last-Write-Wins) union merge between local months and remote month rows
 */
export function mergeMonths(localMonths = {}, remoteRows = []) {
  const mergedMonths = { ...localMonths };
  const dirtyKeysToPush = [];

  // Map remote rows by month_key
  const remoteMap = {};
  remoteRows.forEach((row) => {
    remoteMap[row.month_key] = row;
  });

  // 1. Process remote rows against local
  remoteRows.forEach((remote) => {
    const key = remote.month_key;
    const local = localMonths[key];

    if (!local) {
      // Remote only -> insert to local
      mergedMonths[key] = {
        salary: Number(remote.salary) || 0,
        actuals: remote.actuals || {},
        items: remote.items || {},
        isLocked: Boolean(remote.is_locked),
        updatedAt: new Date(remote.updated_at).getTime() || Date.now(),
      };
    } else {
      // Both exist -> compare timestamps (Server updated_at vs local updatedAt)
      const remoteTime = new Date(remote.updated_at).getTime() || 0;
      const localTime = local.updatedAt || 0;

      if (remoteTime > localTime) {
        // Remote is newer -> overwrite local
        mergedMonths[key] = {
          salary: Number(remote.salary) || 0,
          actuals: remote.actuals || {},
          items: remote.items || {},
          isLocked: Boolean(remote.is_locked),
          updatedAt: remoteTime,
        };
      } else if (localTime > remoteTime) {
        // Local is newer -> keep local & mark dirty to push
        dirtyKeysToPush.push(key);
      }
    }
  });

  // 2. Process local-only months (not in cloud yet)
  Object.keys(localMonths).forEach((key) => {
    if (!remoteMap[key]) {
      dirtyKeysToPush.push(key);
    }
  });

  return { mergedMonths, dirtyKeysToPush };
}

/**
 * Perform a full sync cycle: Pull -> Merge -> Apply Local -> Push Dirty
 */
export async function performFullSync(onReloadStore) {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: "Not configured" };

  const { data: userData } = await client.auth.getUser();
  if (!userData?.user) return { success: false, error: "Not logged in" };

  const userId = userData.user.id;

  try {
    // 1. Check if cloud DB was cleared elsewhere
    const { data: profile } = await client
      .from("rupee_rules_sync_profile")
      .select("cleared_at")
      .eq("user_id", userId)
      .maybeSingle();

    const syncState = getSyncState();
    if (profile?.cleared_at) {
      const remoteClearedTime = new Date(profile.cleared_at).getTime();
      const lastSeenCleared = syncState.clearedAt || 0;

      if (remoteClearedTime > lastSeenCleared) {
        // Cloud was cleared! Clear local state
        saveSyncState({ clearedAt: remoteClearedTime, lastSyncedAt: Date.now() });
        return { success: true, cleared: true };
      }
    }

    // 2. Pull remote month records & goals
    const [{ data: remoteRows, error: pullError }, { data: remoteGoals, error: goalsError }] = await Promise.all([
      client.from("rupee_rules_monthly_records").select("*").eq("user_id", userId),
      client.from("rupee_rules_goals").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    if (pullError) throw pullError;
    if (goalsError) throw goalsError;

    // 3. Read & merge current local month store
    const localStore = loadAllData();
    const { mergedMonths, dirtyKeysToPush } = mergeMonths(localStore.months, remoteRows || []);

    const updatedStore = { ...localStore, months: mergedMonths };
    saveAllData(updatedStore);
    if (typeof onReloadStore === "function") {
      onReloadStore(updatedStore);
    }

    // 4. Merge & sync Goals row
    const localGoals = loadGoalsData();
    if (remoteGoals?.data) {
      const remoteTime = new Date(remoteGoals.updated_at).getTime() || 0;
      const localTime = localGoals.updatedAt || 0;

      if (remoteTime > localTime) {
        saveGoalsData({ ...remoteGoals.data, updatedAt: remoteTime });
      } else if (localTime > remoteTime || !remoteGoals) {
        // Push local goals to cloud
        await client.from("rupee_rules_goals").upsert({
          user_id: userId,
          data: localGoals,
          client_updated_at: localGoals.updatedAt || Date.now(),
        }, { onConflict: "user_id" });
      }
    } else if (localGoals) {
      // First push of goals to cloud
      await client.from("rupee_rules_goals").upsert({
        user_id: userId,
        data: localGoals,
        client_updated_at: localGoals.updatedAt || Date.now(),
      }, { onConflict: "user_id" });
    }

    // 5. Push local dirty/newer months to cloud
    const state = getSyncState();
    const allDirtyKeys = Array.from(new Set([...state.dirtyKeys, ...dirtyKeysToPush]));

    for (const key of allDirtyKeys) {
      if (key === "goals") continue;
      const monthData = mergedMonths[key];
      if (!monthData) continue;

      const payload = {
        user_id: userId,
        month_key: key,
        salary: monthData.salary || 0,
        actuals: monthData.actuals || {},
        items: monthData.items || {},
        is_locked: Boolean(monthData.isLocked),
        client_updated_at: monthData.updatedAt || Date.now(),
      };

      const { error: upsertError } = await client
        .from("rupee_rules_monthly_records")
        .upsert(payload, { onConflict: "user_id,month_key" });

      if (!upsertError) {
        clearDirtyKeys(key);
      }
    }

    saveSyncState({ lastSyncedAt: Date.now() });
    return { success: true, count: Object.keys(mergedMonths).length };
  } catch (err) {
    console.error("Sync error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Force Re-sync: Clears local storage and pulls fresh copy from Supabase
 */
export async function forceReSyncFromCloud(onReloadStore) {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: "Not configured" };

  const { data: userData } = await client.auth.getUser();
  if (!userData?.user) return { success: false, error: "Not logged in" };

  const userId = userData.user.id;

  try {
    // 1. Pull remote records & goals directly
    const [{ data: remoteRows, error: pullError }, { data: remoteGoals, error: goalsError }] = await Promise.all([
      client.from("rupee_rules_monthly_records").select("*").eq("user_id", userId),
      client.from("rupee_rules_goals").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    if (pullError) throw pullError;
    if (goalsError) throw goalsError;

    if (remoteGoals?.data) {
      saveGoalsData({ ...remoteGoals.data, updatedAt: new Date(remoteGoals.updated_at).getTime() || Date.now() });
    }

    // 2. Build local months map strictly from remote rows
    const freshMonths = {};
    (remoteRows || []).forEach((remote) => {
      freshMonths[remote.month_key] = {
        salary: Number(remote.salary) || 0,
        actuals: remote.actuals || {},
        items: remote.items || {},
        isLocked: Boolean(remote.is_locked),
        updatedAt: new Date(remote.updated_at).getTime() || Date.now(),
      };
    });

    const localStore = loadAllData();
    const updatedStore = { ...localStore, months: freshMonths };

    saveAllData(updatedStore);
    saveSyncState({ dirtyKeys: [], lastSyncedAt: Date.now() });

    if (typeof onReloadStore === "function") {
      onReloadStore(updatedStore);
    }

    return { success: true, count: Object.keys(freshMonths).length };
  } catch (err) {
    console.error("Force re-sync error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Clear Database data + Local Storage
 */
export async function clearDatabaseAndLocal() {
  const client = getSupabaseClient();
  if (client) {
    const { data: userData } = await client.auth.getUser();
    if (userData?.user) {
      const userId = userData.user.id;
      const nowIso = new Date().toISOString();

      // 1. Delete rows in Supabase
      await client.from("rupee_rules_monthly_records").delete().eq("user_id", userId);
      await client.from("rupee_rules_goals").delete().eq("user_id", userId);

      // 2. Mark clear profile
      await client.from("rupee_rules_sync_profile").upsert({
        user_id: userId,
        cleared_at: nowIso,
      });
    }
  }

  // 3. Clear local storage
  localStorage.removeItem("rupeerules_store_v2");
  localStorage.removeItem("rupeerules_goals_v1");
  saveSyncState({ dirtyKeys: [], clearedAt: Date.now() });
}

/**
 * Silent Push: Pushes current local store and goals to Supabase WITHOUT re-rendering local React state
 */
export async function pushLocalToCloud() {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: "Not configured" };

  const { data: userData } = await client.auth.getUser();
  if (!userData?.user) return { success: false, error: "Not logged in" };

  const userId = userData.user.id;

  try {
    const localStore = loadAllData();
    const localGoals = loadGoalsData();

    // 1. Push all local months
    const months = localStore.months || {};
    for (const key of Object.keys(months)) {
      const monthData = months[key];
      const payload = {
        user_id: userId,
        month_key: key,
        salary: monthData.salary || 0,
        actuals: monthData.actuals || {},
        items: monthData.items || {},
        is_locked: Boolean(monthData.isLocked),
        client_updated_at: monthData.updatedAt || Date.now(),
      };

      await client
        .from("rupee_rules_monthly_records")
        .upsert(payload, { onConflict: "user_id,month_key" });
    }

    // 2. Push local goals
    if (localGoals) {
      await client.from("rupee_rules_goals").upsert({
        user_id: userId,
        data: localGoals,
        client_updated_at: localGoals.updatedAt || Date.now(),
      }, { onConflict: "user_id" });
    }

    saveSyncState({ lastSyncedAt: Date.now() });
    return { success: true };
  } catch (err) {
    console.error("Silent push error:", err);
    return { success: false, error: err.message };
  }
}

