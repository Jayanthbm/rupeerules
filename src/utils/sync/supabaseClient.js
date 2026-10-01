import { createClient } from "@supabase/supabase-js";
import { getSupabaseCredentials, getSyncState, saveSyncState } from "./storePersistence";

let supabaseInstance = null;

/**
 * Get or create Supabase client instance based on current config
 */
export function getSupabaseClient() {
  const { url, anonKey } = getSupabaseCredentials();

  if (!url || !anonKey) {
    supabaseInstance = null;
    return null;
  }

  if (
    !supabaseInstance ||
    supabaseInstance.supabaseUrl !== url ||
    supabaseInstance.supabaseKey !== anonKey
  ) {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return supabaseInstance;
}

/**
 * Probe if Supabase tables exist by running a lightweight query
 */
export async function probeSupabaseSchema() {
  const client = getSupabaseClient();
  if (!client) return { connected: false, tablesExist: false, error: "No config" };

  try {
    const { error } = await client
      .from("rupee_rules_monthly_records")
      .select("month_key")
      .limit(1);

    if (error) {
      // 42P01 is Postgres error code for table does not exist
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return { connected: true, tablesExist: false, error: "Tables not created" };
      }
      return { connected: true, tablesExist: false, error: error.message };
    }

    return { connected: true, tablesExist: true, error: null };
  } catch (err) {
    return { connected: false, tablesExist: false, error: err.message };
  }
}

/**
 * Validate Supabase configuration credentials by calling the Auth health endpoint
 */
export async function validateSupabaseCredentials(url, anonKey) {
  const cleanUrl = (url || "").trim().replace(/\/$/, "");
  const cleanKey = (anonKey || "").trim();

  if (!cleanUrl || !cleanKey) {
    return { valid: false, error: "Project URL and Anon Key are required." };
  }

  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    return { valid: false, error: "Project URL must start with https:// or http://" };
  }

  try {
    const testClient = createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false },
    });

    // Probe auth API endpoint (safe harmless check)
    const { error } = await testClient.auth.getSession();
    if (error && error.status >= 400 && error.status !== 401) {
      return { valid: false, error: `Invalid credentials: ${error.message}` };
    }

    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: `Connection failed: ${err.message}` };
  }
}

