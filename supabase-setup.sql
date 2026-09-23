-- GGC Build 3.3: permanent cloud player profiles keyed to Supabase Auth UUID.
-- Safe to run more than once.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  handicap_index numeric(4,1) not null default 0.0,
  passkey_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles_read_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_read_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;

-- Existing shared competition state remains available during this migration build.
-- This avoids deleting existing societies/comps while profiles are moved to durable identities.
create table if not exists public.ggc_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.ggc_state enable row level security;
drop policy if exists "ggc_state_authenticated_read" on public.ggc_state;
drop policy if exists "ggc_state_authenticated_write" on public.ggc_state;
create policy "ggc_state_authenticated_read" on public.ggc_state for select to authenticated using (true);
create policy "ggc_state_authenticated_write" on public.ggc_state for all to authenticated using (true) with check (true);
grant select, insert, update, delete on table public.ggc_state to authenticated;
insert into public.ggc_state(id,payload) values('main','{}'::jsonb) on conflict(id) do nothing;
