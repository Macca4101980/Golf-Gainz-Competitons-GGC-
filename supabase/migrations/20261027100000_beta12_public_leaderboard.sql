-- Beta 12 public leaderboard boundary
-- Keeps public data separate from private ggc_state/ggc_records.
create extension if not exists pgcrypto;

create table if not exists public.ggc_public_shares (
  id uuid primary key default gen_random_uuid(),
  competition_id text not null,
  group_id text,
  token_hash text not null unique,
  enabled boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists ggc_public_shares_token_hash_idx
  on public.ggc_public_shares(token_hash);

alter table public.ggc_public_shares enable row level security;

create policy "public shares owner access"
  on public.ggc_public_shares
  for all to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create or replace function public.get_public_leaderboard(p_token text)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'share_id', s.id,
    'competition_id', s.competition_id,
    'group_id', s.group_id,
    'payload', s.payload,
    'updated_at', s.updated_at
  )
  from public.ggc_public_shares s
  where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and s.enabled = true
    and s.revoked_at is null
  limit 1
$$;

revoke all on function public.get_public_leaderboard(text) from public;
grant execute on function public.get_public_leaderboard(text) to anon, authenticated;
