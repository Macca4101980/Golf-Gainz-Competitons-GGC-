-- Group announcements, polls, votes and per-member read state.
-- All writes use validated RPCs; the underlying tables are not exposed to clients.

create table if not exists public.ggc_group_updates (
 id uuid primary key default gen_random_uuid(),
 group_id text not null,
 kind text not null check (kind in ('announcement','poll')),
 title text not null check (char_length(btrim(title)) between 1 and 120),
 body text not null default '' check (char_length(body) <= 4000),
 options jsonb not null default '[]'::jsonb,
 closes_at timestamptz,
 created_by_player_id text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz,
 constraint ggc_group_updates_options_valid check (
  (kind='announcement' and options='[]'::jsonb and closes_at is null)
  or
  (kind='poll' and jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 10)
 )
);

create table if not exists public.ggc_group_update_votes (
 update_id uuid not null references public.ggc_group_updates(id) on delete cascade,
 player_id text not null,
 option_id text not null,
 updated_at timestamptz not null default now(),
 primary key(update_id,player_id)
);

create table if not exists public.ggc_group_update_reads (
 update_id uuid not null references public.ggc_group_updates(id) on delete cascade,
 player_id text not null,
 read_at timestamptz not null default now(),
 primary key(update_id,player_id)
);

alter table public.ggc_group_updates enable row level security;
alter table public.ggc_group_update_votes enable row level security;
alter table public.ggc_group_update_reads enable row level security;
revoke all on public.ggc_group_updates,public.ggc_group_update_votes,public.ggc_group_update_reads from anon,authenticated;

create index if not exists ggc_group_updates_group_created_idx on public.ggc_group_updates(group_id,created_at desc) where deleted_at is null;
create index if not exists ggc_group_update_votes_update_idx on public.ggc_group_update_votes(update_id);
create index if not exists ggc_group_update_reads_player_idx on public.ggc_group_update_reads(player_id,update_id);

create or replace function private.ggc_current_player_id()
returns text language sql stable security definer set search_path=''
as $$
 select record_id from public.ggc_records
 where kind='players' and not deleted and data->>'authUserId'=(select auth.uid())::text
 order by updated_at desc limit 1
$$;
revoke all on function private.ggc_current_player_id() from public;

create or replace function private.ggc_updates_group_member(p_group_id text)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.ggc_group_memberships m
  join public.ggc_records p on p.kind='players' and p.record_id=m.player_id and not p.deleted
  where m.group_id=p_group_id and p.data->>'authUserId'=(select auth.uid())::text
 )
$$;
create or replace function private.ggc_updates_group_admin(p_group_id text)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.ggc_group_memberships m
  join public.ggc_records p on p.kind='players' and p.record_id=m.player_id and not p.deleted
  where m.group_id=p_group_id and m.role in ('owner','admin') and p.data->>'authUserId'=(select auth.uid())::text
 )
$$;
revoke all on function private.ggc_updates_group_member(text),private.ggc_updates_group_admin(text) from public;

create or replace function public.ggc_group_updates_feed()
returns table(id uuid,group_id text,kind text,title text,body text,options jsonb,closes_at timestamptz,created_by_player_id text,created_by_name text,created_at timestamptz,updated_at timestamptz,vote_counts jsonb,my_option_id text,is_read boolean)
language sql stable security definer set search_path=''
as $$
 with actor as (select private.ggc_current_player_id() player_id),
 allowed as (
  select u.* from public.ggc_group_updates u,actor a
  where u.deleted_at is null and private.ggc_updates_group_member(u.group_id)
 ), counts as (
  select v.update_id,jsonb_object_agg(v.option_id,v.total) vote_counts
  from (select update_id,option_id,count(*)::int total from public.ggc_group_update_votes group by update_id,option_id) v
  group by v.update_id
 )
 select u.id,u.group_id,u.kind,u.title,u.body,u.options,u.closes_at,u.created_by_player_id,
  coalesce(p.data->>'name','Group admin'),u.created_at,u.updated_at,coalesce(c.vote_counts,'{}'::jsonb),
  mine.option_id,(r.update_id is not null)
 from allowed u
 cross join actor a
 left join public.ggc_records p on p.kind='players' and p.record_id=u.created_by_player_id and not p.deleted
 left join counts c on c.update_id=u.id
 left join public.ggc_group_update_votes mine on mine.update_id=u.id and mine.player_id=a.player_id
 left join public.ggc_group_update_reads r on r.update_id=u.id and r.player_id=a.player_id
 order by u.created_at desc
 limit 250
$$;

create or replace function public.ggc_create_group_update(p_group_id text,p_kind text,p_title text,p_body text default '',p_options jsonb default '[]'::jsonb,p_closes_at timestamptz default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare actor text; new_id uuid; clean_options jsonb;
begin
 actor:=private.ggc_current_player_id();
 if actor is null or not private.ggc_updates_group_admin(p_group_id) then raise exception 'GGC_GROUP_ADMIN_REQUIRED'; end if;
 if p_kind not in ('announcement','poll') then raise exception 'GGC_INVALID_UPDATE_KIND'; end if;
 clean_options:=case when p_kind='poll' then coalesce(p_options,'[]'::jsonb) else '[]'::jsonb end;
 if p_kind='poll' and (jsonb_typeof(clean_options)<>'array' or jsonb_array_length(clean_options) not between 2 and 10 or exists(select 1 from jsonb_array_elements(clean_options) o where coalesce(o->>'id','')='' or char_length(btrim(coalesce(o->>'label',''))) not between 1 and 100)) then raise exception 'GGC_INVALID_POLL_OPTIONS'; end if;
 insert into public.ggc_group_updates(group_id,kind,title,body,options,closes_at,created_by_player_id)
 values(p_group_id,p_kind,btrim(p_title),btrim(coalesce(p_body,'')),clean_options,case when p_kind='poll' then p_closes_at end,actor)
 returning id into new_id;
 insert into public.ggc_group_update_reads(update_id,player_id) values(new_id,actor);
 return new_id;
end $$;

create or replace function public.ggc_vote_group_poll(p_update_id uuid,p_option_id text)
returns void language plpgsql security definer set search_path=''
as $$
declare actor text; item public.ggc_group_updates%rowtype;
begin
 actor:=private.ggc_current_player_id();
 select * into item from public.ggc_group_updates where id=p_update_id and deleted_at is null;
 if actor is null or item.id is null or not private.ggc_updates_group_member(item.group_id) then raise exception 'GGC_GROUP_MEMBER_REQUIRED'; end if;
 if item.kind<>'poll' or (item.closes_at is not null and item.closes_at<=now()) then raise exception 'GGC_POLL_CLOSED'; end if;
 if not exists(select 1 from jsonb_array_elements(item.options) o where o->>'id'=p_option_id) then raise exception 'GGC_INVALID_POLL_OPTION'; end if;
 insert into public.ggc_group_update_votes(update_id,player_id,option_id) values(item.id,actor,p_option_id)
 on conflict(update_id,player_id) do update set option_id=excluded.option_id,updated_at=now();
 insert into public.ggc_group_update_reads(update_id,player_id) values(item.id,actor)
 on conflict(update_id,player_id) do update set read_at=now();
end $$;

create or replace function public.ggc_mark_group_update_read(p_update_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare actor text; group_key text;
begin
 actor:=private.ggc_current_player_id();
 select group_id into group_key from public.ggc_group_updates where id=p_update_id and deleted_at is null;
 if actor is null or group_key is null or not private.ggc_updates_group_member(group_key) then raise exception 'GGC_GROUP_MEMBER_REQUIRED'; end if;
 insert into public.ggc_group_update_reads(update_id,player_id) values(p_update_id,actor)
 on conflict(update_id,player_id) do update set read_at=now();
end $$;

revoke all on function public.ggc_group_updates_feed(),public.ggc_create_group_update(text,text,text,text,jsonb,timestamptz),public.ggc_vote_group_poll(uuid,text),public.ggc_mark_group_update_read(uuid) from public,anon;
grant execute on function public.ggc_group_updates_feed(),public.ggc_create_group_update(text,text,text,text,jsonb,timestamptz),public.ggc_vote_group_poll(uuid,text),public.ggc_mark_group_update_read(uuid) to authenticated;
