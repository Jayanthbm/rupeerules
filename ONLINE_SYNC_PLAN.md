# Online Sync — Feature Plan & Analysis

> Status: **📋 Plan** (not yet implemented)
> Author note: This document analyses the existing RupeeRules codebase and proposes a design for optional cloud sync across devices. No code has been changed as part of this document.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Feature Requirements](#3-feature-requirements)
4. [Recommended Service: Supabase (BYO Project)](#4-recommended-service-supabase-byo-project)
5. [Supabase Project Setup (Owner Guide)](#5-supabase-project-setup-owner-guide)
6. [Database Schema](#6-database-schema)
7. [Authentication & Token Flow](#7-authentication--token-flow)
8. [Sync Engine Design](#8-sync-engine-design)
9. [Edge Cases & Conflict Handling](#9-edge-cases--conflict-handling)
10. [Implementation Phases](#10-implementation-phases)
11. [Files to Touch](#11-files-to-touch)
12. [Testing Plan](#12-testing-plan)
13. [Security & Privacy](#13-security--privacy)
14. [Alternatives Considered](#14-alternatives-considered)
15. [Open Questions](#15-open-questions)

---

## 1. Executive Summary

RupeeRules is a **fully offline, 100% client-side** personal finance PWA. All data lives in `localStorage`, with JSON export/import as the only portability mechanism. This works well for a single device, but a user who tracks expenses on a laptop and a phone currently has no way to keep both in sync.

**Proposal:** Add an **optional, opt-in "Cloud Sync"** feature using a **Bring-Your-Own (BYO) Supabase project**:

- The app keeps working **exactly as today** with zero cloud dependency when sync is off.
- The user pastes their own Supabase **Project URL + anon key** into a settings screen (BYO model — no central backend for the app developer to run or pay for).
- The user creates their account in the Supabase dashboard (private-deployment model), then logs in from the app.
- On login the app connects to a small 3-table schema (provided as a copy-paste SQL script), performs a **one-time merge** of local and cloud data, then keeps both in sync (**local-first, last-write-wins per month row, realtime push** for live multi-device updates).
- Everything (JSON backup/restore, Clear All, offline usage) continues to work unchanged.

**Why Supabase:** it is the only free option that bundles everything this feature needs in a single service — Postgres (fits the tabular month data), built-in auth with refresh tokens, Row Level Security (each user can only ever see their own rows), realtime subscriptions (live multi-device updates), and a zero-backend client SDK that suits this static PWA. Alternatives are compared in §14.

---

## 2. Current Architecture Analysis

### 2.1 What the app is

- **Stack:** React 19 + Vite 8, plain JavaScript (JSX), vanilla CSS, PWA service worker. No router, no backend, no server state.
- **State:** a single custom hook (`src/hooks/useMoneyRules.js`, ~450 lines, `useReducer`-based) owns all financial state; `GoalsSection` owns goals state separately.
- **Persistence:** synchronous `localStorage` writes on every mutation.

### 2.2 localStorage inventory (complete)

| Key | Owner | Shape | Sync candidate? |
|---|---|---|---|
| `rupeerules_store_v2` | `storage.js` → `useMoneyRules` | `{ activeMonth, months: { "YYYY-MM": MonthRecord } }` | ✅ **Yes — core data** |
| `rupeerules_goals_v1` | `goals.js` → `GoalsSection` | Goals data (lifetime, not per-month) | ✅ **Yes** |
| `mrc_state_v1` | `storage.js` | Legacy v1 store (migration source only) | ❌ No (transient) |
| `mrc_darkmode` | `useDarkMode.js` | `"true"`/`"false"` | ❌ No (device-local preference) |
| `mrc_canibuy_state_v1` | `CanIBuySection.jsx` | Advisor draft state | ❌ No (device-local draft; see OQ-6) |

### 2.3 Core data shapes (from `storage.js` / `goals.js`)

```js
// rupeerules_store_v2
{
  activeMonth: "YYYY-MM",
  months: {
    "YYYY-MM": {
      salary: number,
      actuals: { [ruleId: string]: number },        // rule ids "1".."8"
      items:   { [ruleId: string]: [{ id, name, amount, isLinked? }] },
      isLocked: boolean | undefined,                 // month lock flag
      updatedAt: number                              // epoch ms
    }
  }
}

// rupeerules_goals_v1  (see GOALS_PLAN.md for full shape)
{
  houseAppreciationRate, dreamMilestonePreset,
  trip: {...}, car: {...}, houses: [...max 5],
  secondIncome, passiveIncome,
  achieved: { g1..g10: "YYYY-MM" | null }
}
```

Notes that matter for sync design:

- **`updatedAt` already exists per month** (`Date.now()`-style epoch ms) — the raw ingredient for last-write-wins is already in place.
- **`items` rows carry client-generated string ids** (now `crypto.randomUUID()`). Item-level identity exists, which allows field-level merges later if needed.
- **`actuals` and `items` are sparse maps** — absence means "not set", not zero.
- **The active month is device-local UI state** (`store.activeMonth`), not user data — it should **not** be synced.
- **Backup format (v3):** `{ appName: "RupeeRules", version: 3, exportedAt, data, goals }` — import accepts v1/v2/v3 and single-month snapshots. Any sync restore path must keep accepting these.
- **There is no "delete month" action** in the reducer — the only destructive op is `CLEAR_ALL` (wipes store + goals + optionally dark mode).

### 2.4 Mutation surface (reducer actions in `useMoneyRules.js`)

`SWITCH_MONTH`, `COPY_MONTH`, `SET_SALARY_COMMIT`, `UPDATE_ACTUAL`, `UPDATE_ITEM`, `ADD_ITEM`, `REMOVE_ITEM`, `SORT_ITEMS`, `RELOAD`, `TOGGLE_MONTH_LOCK`, `CLEAR_ALL`.

Every reducer path ends in a `saveAllData(store)` call — this is the **single natural hook point** for a sync engine: enqueue a push after each save. Goals persist via a `useEffect` in `GoalsSection` (second, smaller hook point).

### 2.5 Implications for sync

1. **The month is the natural sync unit.** All user edits are per-month (salary, actuals, items, lock). One row per `(user, month)` matches the write pattern.
2. **Local-first is mandatory.** The app must remain fully functional offline (it's a PWA with a service worker); the cloud is a mirror, not the source of truth.
3. **`CLEAR_ALL` must propagate** (or be cloud-preserving) — a wipe that resurfaces from the cloud on next pull would be a nasty surprise. This needs an explicit design decision (see §9.4 and OQ-2).
4. **`activeMonth` must stay device-local** — it cannot live inside the synced month set.

---

## 3. Feature Requirements

### 3.1 Functional

1. **Zero regression:** offline/local-only behavior, JSON backup/restore, sample data, Clear All — all unchanged when sync is off.
2. **Opt-in configuration:** user can enter a Supabase **Project URL** and **anon key** in a new Settings/Sync screen; stored locally; editable/removable.
3. **BYO accounts:** the project owner creates users manually in Supabase → Authentication → Users (no open signup required by default). App offers a **login form** (email + password).
4. **Token handling:** on successful login the app obtains the Supabase session (access token + refresh token). The SDK persists and auto-refreshes it; the user stays logged in across reloads. Sign-out clears it.
5. **Schema provisioning:** the app cannot create databases/tables from the client by design (DDL requires elevated privileges). Instead:
   - A copy-paste **SQL script** (§6.3) creates everything (tables, RLS, realtime) in one shot via the Supabase SQL Editor.
   - The app **detects** whether tables exist after login (a lightweight probe query) and, if missing, shows a **guided setup panel** with step-by-step instructions and the exact SQL to copy. This is the closest safe equivalent to "create the DB automatically".
6. **First-login merge:** when local and cloud both have data, neither silently overwrites the other. See §9.1 for the merge policy.
7. **Continuous sync:** local edits push to cloud (debounced); cloud changes pull into the app — via periodic fetch on focus, **and** realtime push while online (live multi-device).
8. **Multi-device:** any number of devices logged into the same account converge to the same data.
9. **Sync status UI:** unobtrusive indicator (Offline / Syncing / Synced / Error + last-synced time), manual "Sync now" button, "Sign out" and "Disconnect (forget config)" actions.

### 3.2 Non-functional

- Sync must never block or degrade the UI (all network work async, debounced, failure-tolerant).
- Data volume is tiny (24 months × few KB ≪ 1 MB) — free tiers of any provider are far beyond sufficient.
- Money data is sensitive: RLS must guarantee a user can only read/write their own rows; anon key alone grants nothing (see §13).

---

## 4. Recommended Service: Supabase (BYO Project)

**Recommendation: Supabase**, configured in **BYO mode** — every user of RupeeRules provisions their own (free) Supabase project and pastes its URL + anon key into the app.

### 4.1 Why Supabase fits this app

| Need | Supabase answer |
|---|---|
| Structured, per-month financial records | **Postgres** — one row per month, JSONB for maps, easy querying later (e.g., "all salaries" for reports without loading JSON) |
| Private-deployment auth (owner creates users) | **Supabase Auth** — dashboard user creation, email+password login, **access + refresh tokens managed automatically** by the JS SDK |
| Only-my-rows isolation | **Row Level Security** with `auth.uid()` — enforced in the database, not in app code |
| Multi-device live updates | **Realtime** subscriptions on the tables (Postgres change replication over WebSocket) |
| Static PWA, no backend to host | **`@supabase/supabase-js`** works entirely client-side; the app's Cloudflare-Pages-style static hosting stays untouched |
| Free for personal use | Free tier comfortably covers this workload (see §4.2) |
| Escape hatch | Open source; can be self-hosted later if the hosted product ever changes for the worse |

### 4.2 Free tier headroom (approximate — verify current limits in the dashboard)

- **2 free projects**, **~500 MB database**, **~5 GB egress/month**, **~50k monthly active users** (auth), **~200 concurrent realtime clients**.
- RupeeRules usage: one user, a few hundred KB total, a handful of writes/day. **Headroom is effectively infinite** for personal use. The practical constraint is the 2-project cap per account (fine for BYO single-purpose projects).

### 4.3 The two config values

The user provides (from Supabase → Project Settings → API):

| Value | Visible to app users? | Purpose |
|---|---|---|
| **Project URL** (`https://xyz.supabase.co`) | Yes | API endpoint |
| **anon / public key** | Yes | Public client key — identifies the project, grants **no** data access without an authenticated session (RLS enforces this) |

Neither is a secret in the traditional sense — they ship inside a static bundle and are designed to be public. The **service_role key must never** be used in the app or pasted into it (§13).

App-side env-var names (for the owner's own build, or for hardcoding defaults): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. The runtime settings screen overrides env defaults, since BYO users won't rebuild the app.

---

## 5. Supabase Project Setup (Owner Guide)

The doc this section will become in-product (the "guided setup panel" content). Steps as the user will see them:

### Step 1 — Create the project
1. Sign up at **supabase.com** (free) → **New project**.
2. Name it (e.g. `rupeerules`), pick a region near you, set a **database password** (store it somewhere safe — it's only needed for direct DB access, not by the app).

### Step 2 — Create your user (manual, per the BYO/private model)
1. Dashboard → **Authentication → Users → Add user → Create new user**.
2. Enter **email + password**. Mark it as email-confirmed.
3. This is the account you'll log into RupeeRules with. (Optionally disable public sign-ups entirely: Authentication → Providers → Email → turn off "Allow new users to sign up".)

### Step 3 — Create the tables (one-time, ~30 seconds)
1. Dashboard → **SQL Editor → New query**.
2. Paste the SQL script from §6.3 and **Run**. It creates the tables, indexes, RLS policies, and enables realtime. It is **idempotent** (safe to run twice).

### Step 4 — Copy the config into the app
1. Dashboard → **Project Settings → API**.
2. Copy **Project URL** and **anon public** key.
3. In RupeeRules: **Settings → Cloud Sync → Configure**, paste both, **Save**.

### Step 5 — Log in and first sync
1. In the same panel: **Log in** with the email/password from Step 2.
2. The app verifies the schema (probe query). If tables are missing, the guided panel shows Step 3's SQL.
3. First pull/push merge runs (§9.1). Status pill shows **Synced**.

> **Why can't the app create the DB automatically?** Creating tables requires privileged DDL. Exposing an admin/service key inside a public static app would let *anyone* run DDL against the user's database — a serious security hole. A one-time copy-paste SQL script is the standard, safe pattern for BYO Supabase apps (used widely because it keeps the anon key the only credential in the client). The guided panel with copy-to-clipboard SQL makes this painless.

---

## 6. Database Schema

### 6.1 Design rationale

- **One row per user per month** (not per rule, not one giant JSON blob):
  - Matches the app's write granularity exactly (every edit touches exactly one month).
  - `updated_at` per row gives clean last-write-wins semantics.
  - JSONB columns preserve the existing `actuals`/`items` shapes **byte-for-byte**, so the sync layer needs no lossy translation — a future schema change to the app's maps doesn't require a migration here.
- **Goals as a single row per user** (JSONB): goals are lifetime state edited from one screen; row-level LWW is correct.
- **A sync profile row** records the last wipe (`cleared_at`) so Clear All can propagate deterministically (§9.4), plus optional device bookkeeping.

### 6.2 Tables

```
sync_profile
  user_id        uuid      PK  (== auth.users.id)
  schema_version int       NOT NULL DEFAULT 1
  cleared_at     timestamptz                   -- last Clear All marker (nullable)
  updated_at     timestamptz NOT NULL DEFAULT now()

monthly_records
  user_id        uuid      NOT NULL            -- owner (RLS scope)
  month_key      text      NOT NULL            -- "YYYY-MM"
  salary         numeric   NOT NULL DEFAULT 0
  actuals        jsonb     NOT NULL DEFAULT '{}'::jsonb
  items          jsonb     NOT NULL DEFAULT '{}'::jsonb
  is_locked      boolean   NOT NULL DEFAULT false
  client_updated_at  bigint    NOT NULL        -- client epoch-ms updatedAt (LWW key)
  created_at     timestamptz NOT NULL DEFAULT now()
  updated_at     timestamptz NOT NULL DEFAULT now()
  PK (user_id, month_key)

goals
  user_id        uuid      PK
  data           jsonb     NOT NULL
  client_updated_at  bigint    NOT NULL
  created_at     timestamptz NOT NULL DEFAULT now()
  updated_at     timestamptz NOT NULL DEFAULT now()
```

Index: `monthly_records (user_id, month_key)` is the PK — also the access pattern. No further indexes needed at this scale.

### 6.3 Setup SQL (copy-paste script)

```sql
-- RupeeRules cloud sync schema v1 (idempotent)
-- Run once in Supabase → SQL Editor.

-- 1) Tables -------------------------------------------------------------
create table if not exists public.sync_profile (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  schema_version  int not null default 1,
  cleared_at      timestamptz,
  updated_at      timestamptz not null default now()
);

create table if not exists public.monthly_records (
  user_id           uuid not null references auth.users(id) on delete cascade,
  month_key         text not null,
  salary            numeric not null default 0,
  actuals           jsonb not null default '{}'::jsonb,
  items             jsonb not null default '{}'::jsonb,
  is_locked         boolean not null default false,
  client_updated_at bigint not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, month_key)
);

create table if not exists public.goals (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  data              jsonb not null,
  client_updated_at bigint not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 2) Row Level Security -------------------------------------------------
alter table public.sync_profile    enable row level security;
alter table public.monthly_records enable row level security;
alter table public.goals           enable row level security;

-- Owner-only access: a logged-in user may touch only their own rows.
-- (Anon/unauthenticated requests match no policy and see nothing.)
create policy "own profile select" on public.sync_profile
  for select using (auth.uid() = user_id);
create policy "own profile upsert" on public.sync_profile
  for insert with check (auth.uid() = user_id);
create policy "own profile update" on public.sync_profile
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own months select" on public.monthly_records
  for select using (auth.uid() = user_id);
create policy "own months insert" on public.monthly_records
  for insert with check (auth.uid() = user_id);
create policy "own months update" on public.monthly_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own months delete" on public.monthly_records
  for delete using (auth.uid() = user_id);

create policy "own goals select" on public.goals
  for select using (auth.uid() = user_id);
create policy "own goals upsert" on public.goals
  for insert with check (auth.uid() = user_id);
create policy "own goals update" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Realtime -----------------------------------------------------------
alter publication supabase_realtime add table public.monthly_records;
alter publication supabase_realtime add table public.goals;
alter publication supabase_realtime add table public.sync_profile;

-- 4) Keep updated_at fresh ---------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_monthly_touch on public.monthly_records;
create trigger trg_monthly_touch before update on public.monthly_records
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_goals_touch on public.goals;
create trigger trg_goals_touch before update on public.goals
  for each row execute function public.touch_updated_at();
```

> The publication statements will error harmlessly if a table is already in the publication; the app's guided panel can present them as separate optional statements, or they can be toggled in Dashboard → Database → Replication instead.

### 6.4 Mapping app ⇄ DB

| App (`store.months["2026-09"]`) | `monthly_records` row |
|---|---|
| `salary` | `salary` |
| `actuals` (map ruleId→number) | `actuals` (jsonb, identical shape) |
| `items` (map ruleId→array) | `items` (jsonb, identical shape) |
| `isLocked` | `is_locked` |
| `updatedAt` (epoch ms) | `client_updated_at` |
| — (device-local) | `created_at` / `updated_at` (server metadata only) |
| `store.activeMonth` | **not synced** (device-local UI state) |

`loadGoalsData()` output ⇄ `goals.data` (jsonb, identical shape). `goals.achieved` travels inside `data`.

---

## 7. Authentication & Token Flow

### 7.1 Login (email + password)

1. App calls `supabase.auth.signInWithPassword({ email, password })`.
2. Supabase returns a **session** containing `access_token` (JWT, ~1 h validity) and `refresh_token` (long-lived, rotatable).
3. The SDK **persists the session in `localStorage` automatically** (key `sb-<project-ref>-auth-token`) and **auto-refreshes the access token** before expiry — the app does not manage tokens manually. On reload the session is restored from storage; if the refresh token was revoked, the session resolves to null and the app shows logged-out state.
4. All subsequent SDK queries attach the access token as `Authorization: Bearer …`; PostgREST resolves `auth.uid()` from it — this is what makes RLS work.

> Requirement satisfied: "need to get access token and refresh token" — they *are* obtained and used; they're just managed by the SDK rather than hand-rolled, which is the safer path (rotation, expiry, retry are handled). If the UI wants to display session info, `supabase.auth.getSession()` exposes the tokens without ever needing to parse JWTs in app code.

### 7.2 Session events the app should react to

- `SIGNED_IN` → run the sync bootstrap (schema probe → merge → subscribe realtime).
- `TOKEN_REFRESHED` → no-op (log only).
- `SIGNED_OUT` → stop realtime, clear sync queue, keep local data (sign-out ≠ wipe).
- `USER_DELETED` / invalid session → show re-login prompt.

### 7.3 Sign out & disconnect (two different actions)

- **Sign out:** `supabase.auth.signOut()` — clears tokens, keeps the Supabase config and local data. Next login re-syncs.
- **Disconnect:** clears the stored config (URL + anon key) **and** signs out — returns the app to pure-local mode.

---

## 8. Sync Engine Design

### 8.1 Principles

1. **Local-first:** UI reads/writes `localStorage` synchronously, exactly as today. The cloud is a background mirror.
2. **Single writer per device:** the sync engine is the only code that talks to Supabase; the app keeps its reducer untouched.
3. **Coarse LWW (v1):** per **month row** and per **goals row**, newest `client_updated_at` wins. Rationale in §9.2.
4. **Debounced push:** after any `saveAllData`/`saveGoalsData`, schedule an upload ~1.5 s later (coalesce bursts like typing or item-add storms). Also flush on `visibilitychange → hidden` and `beforeunload` (best-effort).
5. **Pull triggers:** login, app start (if logged in), window refocus, realtime events, manual "Sync now".

### 8.2 The sync cycle (per trigger)

```
PULL   →  MERGE  →  APPLY LOCAL  →  PUSH DIRTY
```

1. **Pull:** `select * from monthly_records where user_id = auth.uid()` (+ `goals`, + `sync_profile`). Tiny result set (one row per tracked month); fine to fetch whole-set each time — pagination unnecessary at this scale.
2. **Merge (per month key):**
   - Cloud only → insert into local store.
   - Local only → mark dirty, push.
   - Both → compare `client_updated_at`: newer wins; equal → local wins (deterministic tie-break).
   - Same for the goals row.
3. **Apply local:** dispatch `RELOAD` with the merged store (the reducer already supports full-state replacement), update `syncedAt`.
4. **Push dirty:** `upsert` changed month rows and the goals row (upsert avoids read-before-write races).

### 8.3 First-login merge (the important one)

Scenario: phone has 24 months, laptop has 6 overlapping + 3 new months.

- **Rule:** union of months. For keys present on both sides, **newer `client_updated_at` wins per month** (not per field).
- **Snapshot safety:** before applying a merge that changes more than N rows (say > 5) or when conflicts are detected, capture `exportBackupJSON()` into an in-memory restore point and offer "Download pre-sync backup" in the sync panel. Cheap insurance, aligns with the existing backup feature.
- **UI:** a one-time "Merging your data…" state with a summary ("24 months from cloud, 3 newer from this device").

### 8.4 Realtime (live multi-device)

- On login, subscribe to changes on `monthly_records` / `goals` / `sync_profile` filtered to the user.
- On event: fetch that row (or re-pull whole set — it's tiny) → merge (same LWW rule) → apply locally. Ignore echo events for rows this device just pushed (compare `client_updated_at` + a pushed-hash cache).
- If realtime disconnects, the engine degrades gracefully: periodic pull on focus keeps devices converging within seconds-to-minutes instead of instantly.

### 8.5 Offline queue

- Mutations while offline just save locally (as today) and mark the month dirty with the new `updatedAt`.
- A simple `dirty: { [monthKey]: true }` set in localStorage (`rupeerules_sync_state_v1`) records what needs pushing; on reconnect/pull, dirty rows are pushed after the pull-merge so a stale cloud copy can't clobber newer local edits.
- Failed pushes retry with backoff; the status pill surfaces persistent errors.

### 8.6 What is *not* synced (v1)

- `activeMonth` (device UI state), `mrc_darkmode` (device preference), `mrc_canibuy_state_v1` (draft — see OQ-6), legacy `mrc_state_v1`.

---

## 9. Edge Cases & Conflict Handling

### 9.1 Conflict matrix

| Situation | Resolution |
|---|---|
| Two devices edit **different months** | No conflict — independent rows. |
| Two devices edit the **same month** while both online | Realtime pull applies the remote row; the local device's next keystroke re-writes the whole row with a fresh `updatedAt`. Last keystroke wins. Acceptable for a single-user app. |
| Same month edited on **two devices while offline** | Whole-row LWW on next sync; the loser's changes are replaced. Risk noted in §9.2; pre-sync backup (§8.3) mitigates data loss. |
| **Goals** edited on two devices | Whole-object LWW (single row). |
| Clock skew between devices | `client_updated_at` is client-clock based. Skew only matters when two devices edit the *same* month within the skew window. Mitigation if it ever bites: use server `updated_at` as tie-breaker, or switch the LWW key to server time (OQ-4). |

### 9.2 The whole-row LWW trade-off (explicitly accepted for v1)

Because a month is one row, concurrent edits to *different rules in the same month* on two devices lose one side's changes. The alternatives:

- **(a) Field-level merge** — diff `actuals`/`items` per key and merge disjoint edits. Doable (item ids exist) but roughly doubles sync complexity; deferred.
- **(b) Normalized rows per rule** — eliminates most conflicts but adds a join/mapping layer and bigger rewrite. Deferred.
- **(c) Accept coarse LWW + pre-sync backup** — chosen for v1: single-user, small blast radius (one month), trivially explainable ("latest edit wins"), and the risk window (same month, two devices, offline, overlapping edits) is narrow.

### 9.3 Import / backup interplay

`importBackupJSON` replaces the whole local store today. Under sync it should additionally **mark all imported months dirty** so they push; a confirmation line in the modal ("This will also sync to cloud") keeps expectations clear. Export needs no change (it reads local state).

### 9.4 `CLEAR_ALL`

Options:

- **A. Propagate the wipe (recommended):** write `cleared_at = now()` to `sync_profile`, delete cloud rows; other devices pull `cleared_at` and clear locally (once, tracked by their own last-seen `cleared_at`). Matches user intent of "Clear All".
- **B. Local-only wipe:** cloud restores everything on next pull — surprising and data-lossy *in the other direction*.
- Choose A; the `sync_profile.cleared_at` marker makes it deterministic across devices. (Double-check intent in the confirm dialog: "Clears data on all synced devices.")

### 9.5 Account/data resets on the Supabase side

If the owner deletes a user or resets the project, the app's next pull gets auth errors → surface "Session invalid — please log in again" without touching local data.

### 9.6 Service worker / offline

The SW caches app shell assets only; API calls bypass it (no cache-first for Supabase — ensure fetches go network-direct so stale API responses can't mask fresh data).

---

## 10. Implementation Phases

Each phase is independently shippable and testable.

**Phase 0 — Persistence seams (refactor, no behavior change)**
- Extract a thin `storePersistence` wrapper around `saveAllData`/`loadAllData`/goals save so the sync layer can observe writes without touching the reducer (or simply register a post-save callback in the existing call sites — 4 call sites total).
- Add `rupeerules_sync_state_v1` (config, session snapshot refs, dirty set, `cleared_at` cursor).

**Phase 1 — Config & auth UI**
- `SyncSection` (settings screen or modal): config form (URL + anon key, validation via a harmless `GET /auth/v1/health` probe), login form, status pill, sign out / disconnect.
- Supabase client factory reading config from `rupeerules_sync_state_v1` (fallback: `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`).
- Dep: `@supabase/supabase-js`.

**Phase 2 — Schema bootstrap**
- Post-login probe (e.g., `select from monthly_records limit 1`; map PostgREST errors: `42P01` = missing table).
- Guided panel (§5) with copy-to-clipboard SQL when missing.

**Phase 3 — Pull / merge / push engine**
- Implement §8.2/§8.3 with unit-tested pure merge functions (`syncMerge.js`).
- Wire post-save hook → dirty set → debounced push.
- First-login backup snapshot offer.

**Phase 4 — Realtime + polish**
- Realtime subscriptions, echo suppression, focus-refetch, retry/backoff, status pill states, "Sync now".
- `CLEAR_ALL` propagation via `sync_profile.cleared_at`.

**Phase 5 — Hardening (can follow later)**
- Field-level merge for `actuals`/`items` (§9.2 option a), server-clock LWW key, multi-account support, sync audit log.

---

## 11. Files to Touch

| File | Change |
|---|---|
| `src/utils/sync/supabaseClient.js` | NEW — client factory from stored config/env |
| `src/utils/sync/syncEngine.js` | NEW — pull/merge/push cycle, dirty set, debounce, realtime |
| `src/utils/sync/syncMerge.js` | NEW — pure merge/LWW functions (unit-testable) |
| `src/utils/sync/syncMerge.test.js` | NEW — merge engine tests |
| `src/components/SyncSection.jsx` | NEW — config + login + status UI |
| `src/styles/sync.css` | NEW — styles |
| `src/components/Header.jsx` | Add ⚙️/☁️ Sync nav entry (4th icon next to Reports/Backup/Can-I-Buy) |
| `src/MoneyRulesCalculator.jsx` | Mount SyncSection; pass status down |
| `src/hooks/useMoneyRules.js` | Register post-save hook; handle `RELOAD` from sync; `CLEAR_ALL` hook |
| `src/components/GoalsSection.jsx` | Post-save hook for goals dirty marking |
| `src/utils/storage.js` | `importBackupJSON` marks months dirty when sync active |
| `package.json` | `@supabase/supabase-js` dependency |
| `README.md` | Document the feature + owner setup guide |

---

## 12. Testing Plan

- **Unit (Vitest, existing setup):**
  - `syncMerge.js`: LWW cases, union merge, tie-breaks, `cleared_at` handling, dirty-set diffing, JSONB shape round-trips (app shape ⇄ row shape).
  - Storage round-trip: month row → app month → row yields identical `actuals`/`items`.
- **Integration (manual or against a throwaway Supabase project):**
  - Fresh login, empty local → cloud fills.
  - Local-only months push; cloud-only months pull.
  - Two browser profiles = two devices: edit on A → appears on B live (realtime) and vice versa.
  - Offline (devtools) edits → back online → converges.
  - Import backup while synced → cloud updated.
  - Clear All → cloud wiped, other device clears.
  - Invalid config / wrong key / missing tables → guided panel, no crashes.
  - Sign out → local data intact; sign in again → merges cleanly.

---

## 13. Security & Privacy

- **RLS is the security boundary.** Every table's policies restrict all operations to `auth.uid() = user_id`. The anon key alone authenticates nobody — an unauthenticated request matches no policy and returns nothing.
- **Never ship the `service_role` key** in the client or store it in the app's config screen. It bypasses RLS. The guided panel must not even link to it.
- **TLS everywhere** (Supabase is HTTPS-only).
- **Data in cloud is plaintext.** Personal finance data leaves the device only when the user opts in, to their own project, under their own account. For extra privacy, an optional client-side encryption layer (encrypt JSONB payloads with a user passphrase via WebCrypto before upload) is a viable Phase 5+ addition (OQ-7).
- **Config storage:** URL + anon key in `localStorage` is consistent with the SDK's own session storage there; acceptable for this threat model.
- **GDPR-ish posture:** the user is also the data controller (their own project); deletion = Clear All + delete user in dashboard.

---

## 14. Alternatives Considered

| Option | Free tier | Auth | Realtime | Fit for this app | Verdict |
|---|---|---|---|---|---|
| **Supabase (BYO)** ✅ | ~500 MB DB, ~5 GB egress, ~50k MAU (verify current) | ✅ Email/password + dashboard user creation, refresh tokens auto-managed | ✅ Built-in | SQL+JSONB matches month rows; RLS gives per-user isolation with zero server code; static-host friendly | **Recommended** |
| **Firebase (Firestore)** | Generous Spark tier | ✅ (incl. email/password) | ✅ | Solid; but document-DB model fits worse, Google account required, lock-in stronger, security rules harder to audit than SQL RLS | Good runner-up |
| **PocketBase** (self-host) | Free forever (single binary) | ✅ | ✅ | Lovely DX, but **needs a always-on server** the user must run — contradicts "no backend" simplicity for a BYO audience | Only if self-hosting is acceptable |
| **Turso / libSQL** | Free tier | ❌ DIY | ❌ | Would require building auth+tokens+realtime from scratch | Rejected (too much glue) |
| **CloudKit JS** | Free (Apple) | Apple ID only | ✅ | Excludes non-Apple devices | Rejected |
| **Dexie Cloud** | Small free tier | ✅ | ✅ | Syncs IndexedDB — elegant, but the app's storage is localStorage, and the free tier is tight; adds an abstraction not otherwise used | Rejected for v1 |
| **GitHub Gist as KV** | Free | PAT needed | ❌ | Hacky, no realtime, PAT handling is risky client-side | Rejected |
| **Custom backend** (Node+Postgres on Fly/Render) | Free-ish tiers | DIY | DIY | Everything Supabase gives, hand-rolled; ongoing maintenance burden | Rejected for v1 |

---

## 15. Open Questions

1. **Signup in-app?** The plan assumes dashboard-created users (private deployment). Should the app also expose a sign-up form (Supabase would need "Allow new users to sign up" + email confirmation)? Trivial to add later; default keeps the BYO project private to its owner. *(OQ-1)*
2. **Clear All semantics** — confirmed preference for propagating wipes to the cloud (§9.4 Option A)? Some users may want the cloud to act as an off-device safety net that *survives* local wipes. *(OQ-2)*
3. **Per-month granularity vs. per-rule rows** — if multi-device *simultaneous* edits to the same month become a real pattern, migrate `actuals`/`items` to normalized rows (§9.2 b) or implement field-level merge (a). Which matters more: simplicity (current choice) or guaranteed no-loss concurrent editing? *(OQ-3)*
4. **LWW clock source** — client epoch ms (simple, skew-sensitive) vs. server `updated_at` (accurate, but needs read-before-write or a DB function for the client to stamp). Stay client-clock for v1? *(OQ-4)*
5. **Multi-account** — should the app support switching between Supabase accounts/projects (e.g., family sharing a project with separate users)? Not planned for v1. *(OQ-5)*
6. **Sync the Can-I-Buy draft** (`mrc_canibuy_state_v1`) as a small preference? Low value; excluded by default. *(OQ-6)*
7. **Client-side encryption** — encrypt payloads with a user passphrase (zero-knowledge cloud) at the cost of losing server-side queryability and adding key-recovery pain (lost passphrase = lost data)? *(OQ-7)*
8. **Env defaults vs. runtime config** — ship with empty defaults and require the settings screen (pure BYO), or allow the owner to bake their own project's URL/key at build time (single-tenant convenience)? Both are supported by the plan; default recommendation: runtime config wins if present. *(OQ-8)*
9. **Free-tier ceiling awareness** — limits cited are approximate as of writing; the guided panel could link to the current Supabase pricing page rather than hardcoding numbers. *(OQ-9)*

---

*End of plan — ready for implementation in phases; Phase 0–1 are the natural starting point.*
