export const SETUP_SQL_SCRIPT = `-- RupeeRules cloud sync schema v1 (idempotent)
-- Run once in Supabase → SQL Editor.

-- 1) Tables -------------------------------------------------------------
create table if not exists public.rupee_rules_sync_profile (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  schema_version  int not null default 1,
  cleared_at      timestamptz,
  updated_at      timestamptz not null default now()
);

create table if not exists public.rupee_rules_monthly_records (
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

create table if not exists public.rupee_rules_goals (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  data              jsonb not null,
  client_updated_at bigint not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 2) Row Level Security -------------------------------------------------
alter table public.rupee_rules_sync_profile    enable row level security;
alter table public.rupee_rules_monthly_records enable row level security;
alter table public.rupee_rules_goals           enable row level security;

-- Owner-only access: a logged-in user may touch only their own rows.
create policy "own profile select" on public.rupee_rules_sync_profile
  for select using (auth.uid() = user_id);
create policy "own profile upsert" on public.rupee_rules_sync_profile
  for insert with check (auth.uid() = user_id);
create policy "own profile update" on public.rupee_rules_sync_profile
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own months select" on public.rupee_rules_monthly_records
  for select using (auth.uid() = user_id);
create policy "own months insert" on public.rupee_rules_monthly_records
  for insert with check (auth.uid() = user_id);
create policy "own months update" on public.rupee_rules_monthly_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own months delete" on public.rupee_rules_monthly_records
  for delete using (auth.uid() = user_id);

create policy "own goals select" on public.rupee_rules_goals
  for select using (auth.uid() = user_id);
create policy "own goals upsert" on public.rupee_rules_goals
  for insert with check (auth.uid() = user_id);
create policy "own goals update" on public.rupee_rules_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Realtime -----------------------------------------------------------
alter publication supabase_realtime add table public.rupee_rules_monthly_records;
alter publication supabase_realtime add table public.rupee_rules_goals;
alter publication supabase_realtime add table public.rupee_rules_sync_profile;

-- 4) Keep updated_at fresh ---------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_monthly_touch on public.rupee_rules_monthly_records;
create trigger trg_monthly_touch before update on public.rupee_rules_monthly_records
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_goals_touch on public.rupee_rules_goals;
create trigger trg_goals_touch before update on public.rupee_rules_goals
  for each row execute function public.touch_updated_at();
`;
