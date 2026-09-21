create table if not exists public.ggc_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.ggc_state enable row level security;
drop policy if exists "ggc_state_read" on public.ggc_state;
drop policy if exists "ggc_state_write" on public.ggc_state;
create policy "ggc_state_read" on public.ggc_state for select to anon using (true);
create policy "ggc_state_write" on public.ggc_state for all to anon using (true) with check (true);
grant usage on schema public to anon;
grant select, insert, update, delete on table public.ggc_state to anon;
