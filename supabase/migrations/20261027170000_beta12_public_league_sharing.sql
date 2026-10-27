-- Beta 12 league-level public leaderboard shares.
create table if not exists public.ggc_public_league_shares(
 id uuid primary key default gen_random_uuid(),
 league_id text not null unique,
 group_id text not null,
 token_hash text not null unique,
 enabled boolean not null default true,
 payload jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revoked_at timestamptz,
 version bigint not null default 1
);
alter table public.ggc_public_league_shares enable row level security;
revoke all on public.ggc_public_league_shares from anon,authenticated;

create or replace function private.ggc_league_group(p_league_id text)
returns text language sql stable security definer set search_path='' as $$
 select data->>'societyId' from public.ggc_records
 where kind='leagues' and record_id=p_league_id and not deleted limit 1
$$;
revoke all on function private.ggc_league_group(text) from public,anon,authenticated;

create or replace function private.ggc_public_league_admin(p_league_id text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor text; group_id text; grp jsonb; permitted boolean;
begin
 if auth.uid() is null then return false; end if;
 group_id:=private.ggc_league_group(p_league_id);
 if group_id is null then return false; end if;
 select record_id into actor from public.ggc_records where kind='players' and not deleted and data->>'authUserId'=auth.uid()::text order by updated_at desc limit 1;
 select data into grp from public.ggc_records where kind='societies' and record_id=group_id and not deleted;
 if actor is null or grp is null then return false; end if;
 if to_regclass('public.ggc_group_memberships') is not null then
  execute 'select exists(select 1 from public.ggc_group_memberships where group_id=$1 and player_id=$2 and role in (''owner'',''admin''))' into permitted using group_id,actor;
  return permitted;
 end if;
 return coalesce(grp->>'ownerId'=actor or (grp->'admins') ? actor,false);
end $$;
revoke all on function private.ggc_public_league_admin(text) from public,anon,authenticated;

create or replace function public.ggc_public_league_share_status(p_league_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.ggc_public_league_shares%rowtype;
begin
 if not private.ggc_public_league_admin(p_league_id) then raise exception 'GGC_GROUP_ADMIN_REQUIRED'; end if;
 select * into s from public.ggc_public_league_shares where league_id=p_league_id;
 return coalesce(jsonb_build_object('enabled',s.enabled and s.revoked_at is null,'version',s.version,'updatedAt',s.updated_at),jsonb_build_object('enabled',false,'version',0));
end $$;
revoke all on function public.ggc_public_league_share_status(text) from public,anon;
grant execute on function public.ggc_public_league_share_status(text) to authenticated;

create or replace function public.ggc_manage_public_league_share(p_league_id text,p_action text,p_token_hash text default null,p_payload jsonb default null,p_expected_version bigint default 0)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.ggc_public_league_shares%rowtype; group_id text; grp jsonb; entry jsonb; pid text; safe_rows jsonb:='[]'; cleaned jsonb;
begin
 if not private.ggc_public_league_admin(p_league_id) then raise exception 'GGC_GROUP_ADMIN_REQUIRED'; end if;
 if p_action not in ('publish','refresh','rotate','revoke') then raise exception 'GGC_INVALID_SHARE_ACTION'; end if;
 group_id:=private.ggc_league_group(p_league_id);
 select * into s from public.ggc_public_league_shares where league_id=p_league_id for update;
 if coalesce(s.version,0) is distinct from p_expected_version then raise exception 'GGC_SHARE_CONFLICT: Reopen leaderboard to load the latest sharing settings'; end if;
 if p_action='revoke' then
  update public.ggc_public_league_shares set enabled=false,revoked_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 where league_id=p_league_id;
  return public.ggc_public_league_share_status(p_league_id);
 end if;
 select data into grp from public.ggc_records where kind='societies' and record_id=group_id and not deleted;
 if coalesce(grp->>'publicLeaderboardsEnabled','true')='false' then raise exception 'GGC_PUBLIC_SHARING_DISABLED'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload->'rows') is distinct from 'array' or jsonb_array_length(p_payload->'rows')>500 then raise exception 'GGC_INVALID_PUBLIC_PAYLOAD'; end if;
 for entry in select value from jsonb_array_elements(p_payload->'rows') loop
  if jsonb_typeof(entry->'memberIds') is distinct from 'array' or jsonb_array_length(entry->'memberIds') not between 1 and 4 then raise exception 'GGC_INVALID_PUBLIC_ROW'; end if;
  for pid in select jsonb_array_elements_text(entry->'memberIds') loop
   if not exists(select 1 from public.ggc_records where kind='players' and record_id=pid and not deleted) then raise exception 'GGC_INVALID_PUBLIC_GOLFER'; end if;
  end loop;
  safe_rows:=safe_rows||jsonb_build_array(jsonb_build_object('memberIds',entry->'memberIds','teamId',left(entry->>'teamId',256),'position',jsonb_array_length(safe_rows)+1,'result',left(entry->>'result',80),'complete',greatest(0,least(18,coalesce((entry->>'complete')::int,18))),'totalHoles',18));
 end loop;
 cleaned:=jsonb_build_object('schemaVersion',1,'scope','league','title',left(coalesce(p_payload->>'title','League leaderboard'),160),'provisional',coalesce((p_payload->>'provisional')::boolean,false),'visibleThrough',greatest(0,least(18,coalesce((p_payload->>'visibleThrough')::int,18))),'rows',safe_rows);
 if s.id is null or not s.enabled or s.revoked_at is not null or p_action='rotate' then
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_token_hash=s.token_hash then raise exception 'GGC_NEW_TOKEN_REQUIRED'; end if;
 elsif p_token_hash is not null then raise exception 'GGC_ROTATION_REQUIRED'; end if;
 insert into public.ggc_public_league_shares(league_id,group_id,token_hash,payload,created_by,updated_at)
 values(p_league_id,group_id,coalesce(p_token_hash,s.token_hash),cleaned,auth.uid(),clock_timestamp())
 on conflict(league_id) do update set group_id=excluded.group_id,token_hash=coalesce(p_token_hash,ggc_public_league_shares.token_hash),payload=cleaned,enabled=true,revoked_at=null,updated_at=clock_timestamp(),version=ggc_public_league_shares.version+1;
 return public.ggc_public_league_share_status(p_league_id);
end $$;
revoke all on function public.ggc_manage_public_league_share(text,text,text,jsonb,bigint) from public,anon;
grant execute on function public.ggc_manage_public_league_share(text,text,text,jsonb,bigint) to authenticated;

create or replace function private.ggc_read_public_league_leaderboard(p_token text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.ggc_public_league_shares%rowtype; grp jsonb; league jsonb; entry jsonb; pid text; names text[]; all_visible boolean; player_name text; label text; team_name text; output jsonb:='[]';
begin
 select * into s from public.ggc_public_league_shares where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and enabled and revoked_at is null;
 if s.id is null then return null; end if;
 if exists(select 1 from public.ggc_records where kind='societies' and record_id=s.group_id and not deleted and data->>'publicLeaderboardsEnabled'='false') then return null; end if;
 select data into league from public.ggc_records where kind='leagues' and record_id=s.league_id and not deleted;
 for entry in select value from jsonb_array_elements(s.payload->'rows') loop
  names:=array[]::text[]; all_visible:=true;
  for pid in select jsonb_array_elements_text(entry->'memberIds') loop
   select case when coalesce(pref.visible,true) then left(r.data->>'name',100) end into player_name from public.ggc_records r left join private.ggc_public_identity_preferences pref on pref.player_id=r.record_id where r.kind='players' and r.record_id=pid and not r.deleted;
   if player_name is null then all_visible:=false; end if;
   names:=array_append(names,coalesce(player_name,'Anonymous golfer'));
  end loop;
  team_name:=null;
  if all_visible and entry->>'teamId' is not null then
   select left(t->>'name',100) into team_name from jsonb_array_elements(coalesce(league->'teams','[]')) t where t->>'id'=entry->>'teamId';
  end if;
  label:=case when all_visible then coalesce(team_name,array_to_string(names,' & ')) when cardinality(names)>1 then 'Anonymous team '||(entry->>'position') else 'Anonymous golfer '||(entry->>'position') end;
  output:=output||jsonb_build_array(jsonb_build_object('position',entry->'position','name',label,'complete',entry->'complete','totalHoles',entry->'totalHoles','result',entry->>'result'));
 end loop;
 return jsonb_build_object('title',coalesce(s.payload->>'title',league->>'name'),'publishedAt',s.updated_at,'provisional',s.payload->'provisional','visibleThrough',s.payload->'visibleThrough','rows',output);
end $$;
create or replace function public.ggc_get_public_league_leaderboard(p_token text)
returns jsonb language sql security invoker set search_path='' as $$select private.ggc_read_public_league_leaderboard(p_token)$$;
revoke all on function public.ggc_get_public_league_leaderboard(text) from public;
grant execute on function public.ggc_get_public_league_leaderboard(text) to anon,authenticated,service_role;
notify pgrst,'reload schema';