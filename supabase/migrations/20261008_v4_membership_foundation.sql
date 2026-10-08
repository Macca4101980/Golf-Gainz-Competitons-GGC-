-- V4 membership normalization: additive schema only, no production writes.
create table if not exists public.ggc_golfers (
 id text primary key,
 display_name text not null,
 auth_user_id uuid references auth.users(id) on delete set null,
 placeholder boolean not null default true,
 claimed_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index if not exists ggc_golfers_one_account on public.ggc_golfers(auth_user_id) where auth_user_id is not null and placeholder=false;
create table if not exists public.ggc_identity_links (
 old_golfer_id text primary key references public.ggc_golfers(id),
 canonical_golfer_id text not null references public.ggc_golfers(id),
 linked_at timestamptz not null default now(),
 constraint ggc_identity_distinct check(old_golfer_id <> canonical_golfer_id)
);
create table if not exists public.ggc_groups (
 id text primary key,
 name text not null,
 created_at timestamptz not null default now()
);
create table if not exists public.ggc_memberships (
 group_id text not null references public.ggc_groups(id),
 golfer_id text not null references public.ggc_golfers(id),
 role text not null default 'member' check(role in ('member','admin','owner')),
 status text not null default 'member' check(status in ('invited','member','removed')),
 joined_at timestamptz not null default now(),
 primary key(group_id,golfer_id)
);
create index if not exists ggc_memberships_golfer_idx on public.ggc_memberships(golfer_id);
alter table public.ggc_golfers enable row level security;
alter table public.ggc_identity_links enable row level security;
alter table public.ggc_groups enable row level security;
alter table public.ggc_memberships enable row level security;
-- No client policies yet: deny direct client access until server-side APIs are ready.
