-- Beta 12 only. Apply to the isolated test project; production is unchanged.
create schema if not exists private;
alter table public.ggc_public_shares add column if not exists version bigint not null default 1;
create unique index if not exists ggc_public_shares_competition_unique on public.ggc_public_shares(competition_id);
-- All writes go through checked RPCs. Even a signed-in user cannot self-assign a share.
revoke all on public.ggc_public_shares from anon,authenticated;
drop policy if exists "public shares owner access" on public.ggc_public_shares;
create table if not exists private.ggc_public_identity_preferences (
 player_id text primary key, visible boolean not null default true, updated_at timestamptz not null default now()
);
alter table private.ggc_public_identity_preferences enable row level security;
revoke all on private.ggc_public_identity_preferences from public,anon,authenticated;

create or replace function private.ggc_public_share_admin(p_competition_id text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor text; comp jsonb; grp jsonb; permitted boolean;
begin
 if auth.uid() is null then return false; end if;
 select record_id into actor from public.ggc_records where kind='players' and not deleted and data->>'authUserId'=auth.uid()::text order by updated_at desc limit 1;
 if actor is null then return false; end if;
 select data into comp from public.ggc_records where kind='comps' and record_id=p_competition_id and not deleted;
 select data into grp from public.ggc_records where kind='societies' and record_id=comp->>'societyId' and not deleted;
 if grp is null then return false; end if;
 -- Prefer authoritative transactional roles where that schema is installed.
 if to_regclass('public.ggc_group_memberships') is not null then
  execute 'select exists(select 1 from public.ggc_group_memberships where group_id=$1 and player_id=$2 and role in (''owner'',''admin''))' into permitted using comp->>'societyId',actor;
  return permitted;
 end if;
 return coalesce(grp->>'ownerId'=actor or (grp->'admins') ? actor,false);
end $$;
revoke all on function private.ggc_public_share_admin(text) from public,anon,authenticated;

create or replace function private.ggc_public_identity(p_visible boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor text; answer boolean;
begin
 if auth.uid() is null then raise exception 'GGC_SIGN_IN_REQUIRED'; end if;
 select record_id into actor from public.ggc_records where kind='players' and not deleted and data->>'authUserId'=auth.uid()::text order by updated_at desc limit 1;
 if actor is null then raise exception 'GGC_GOLFER_IDENTITY_REQUIRED'; end if;
 if p_visible is not null then
  insert into private.ggc_public_identity_preferences(player_id,visible) values(actor,p_visible)
   on conflict(player_id) do update set visible=excluded.visible,updated_at=now();
 end if;
 select visible into answer from private.ggc_public_identity_preferences where player_id=actor;
 return coalesce(answer,true);
end $$;
create or replace function public.ggc_public_identity(p_visible boolean default null)
returns boolean language sql security invoker set search_path='' as $$select private.ggc_public_identity(p_visible)$$;
revoke all on function private.ggc_public_identity(boolean),public.ggc_public_identity(boolean) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.ggc_public_identity(boolean),public.ggc_public_identity(boolean) to authenticated;

create or replace function private.ggc_public_share_status(p_competition_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare answer jsonb;
begin
 if not private.ggc_public_share_admin(p_competition_id) then raise exception 'GGC_GROUP_ADMIN_REQUIRED'; end if;
 select jsonb_build_object('enabled',enabled and revoked_at is null,'version',version,'updatedAt',updated_at) into answer from public.ggc_public_shares where competition_id=p_competition_id;
 return coalesce(answer,jsonb_build_object('enabled',false,'version',0));
end $$;
create or replace function public.ggc_public_share_status(p_competition_id text)
returns jsonb language sql security invoker set search_path='' as $$select private.ggc_public_share_status(p_competition_id)$$;
revoke all on function private.ggc_public_share_status(text),public.ggc_public_share_status(text) from public,anon,authenticated;
grant execute on function private.ggc_public_share_status(text),public.ggc_public_share_status(text) to authenticated;

create or replace function private.ggc_manage_public_share(p_competition_id text,p_action text,p_token_hash text,p_payload jsonb,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare comp jsonb; grp jsonb; old public.ggc_public_shares%rowtype; entry jsonb; ids jsonb; pid text; safe_rows jsonb:='[]'; cleaned jsonb; through_hole int:=18; provisional boolean:=false; e jsonb;
begin
 if not private.ggc_public_share_admin(p_competition_id) then raise exception 'GGC_GROUP_ADMIN_REQUIRED'; end if;
 if p_action not in ('publish','refresh','rotate','revoke') then raise exception 'GGC_INVALID_SHARE_ACTION'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ggc-public-share:'||p_competition_id,0));
 select * into old from public.ggc_public_shares where competition_id=p_competition_id for update;
 if coalesce(old.version,0) is distinct from p_expected_version then raise exception 'GGC_SHARE_CONFLICT: Reopen leaderboard to load the latest sharing settings'; end if;
 if p_action='revoke' then
  update public.ggc_public_shares set enabled=false,revoked_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 where competition_id=p_competition_id;
  return private.ggc_public_share_status(p_competition_id);
 end if;
 if p_action='refresh' and (old.id is null or not old.enabled or old.revoked_at is not null) then raise exception 'GGC_SHARE_DISABLED'; end if;
 select data into comp from public.ggc_records where kind='comps' and record_id=p_competition_id and not deleted;
 select data into grp from public.ggc_records where kind='societies' and record_id=comp->>'societyId' and not deleted;
 if coalesce(grp->>'publicLeaderboardsEnabled','true')='false' then raise exception 'GGC_PUBLIC_SHARING_DISABLED'; end if;
 e:=comp->'resultsEmbargo';
 if e->>'enabled'='true' and (e->>'releaseAt')::timestamptz>now() then
  provisional:=true;
  through_hole:=case when nullif(e->>'provisionalAt','')::timestamptz>now() then 0 else greatest(1,least(17,coalesce((e->>'visibleThroughHole')::int,15))) end;
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload->'rows') is distinct from 'array' or jsonb_array_length(p_payload->'rows')>500 or (p_payload->>'visibleThrough')::int is distinct from through_hole or (p_payload->>'provisional')::boolean is distinct from provisional then raise exception 'GGC_INVALID_PUBLIC_PAYLOAD'; end if;
 if through_hole=0 and jsonb_array_length(p_payload->'rows')>0 then raise exception 'GGC_RESULTS_HIDDEN'; end if;
 for entry in select value from jsonb_array_elements(p_payload->'rows') loop
  ids:=entry->'memberIds';
  if jsonb_typeof(ids) is distinct from 'array' or jsonb_array_length(ids) not between 1 and 4 or length(entry->>'result')>80 or jsonb_typeof(entry->'result') is distinct from 'string' then raise exception 'GGC_INVALID_PUBLIC_ROW'; end if;
  for pid in select jsonb_array_elements_text(ids) loop
   if not exists(select 1 from public.ggc_records where kind='players' and record_id=pid and not deleted) or not (coalesce(grp->'members','[]') ? pid or coalesce(grp->'admins','[]') ? pid or grp->>'ownerId'=pid or coalesce(comp->'entries','[]') ? pid) then raise exception 'GGC_INVALID_PUBLIC_GOLFER'; end if;
  end loop;
  safe_rows:=safe_rows||jsonb_build_array(jsonb_build_object('memberIds',ids,'teamId',left(entry->>'teamId',256),'position',jsonb_array_length(safe_rows)+1,'result',entry->>'result','complete',greatest(0,least(18,(entry->>'complete')::int)),'totalHoles',case when comp->>'holesMode' in ('front9','back9') then 9 else 18 end));
 end loop;
 cleaned:=jsonb_build_object('schemaVersion',1,'provisional',provisional,'visibleThrough',through_hole,'embargo',coalesce(e,'{}'),'rows',safe_rows);
 if old.id is null or not old.enabled or old.revoked_at is not null or p_action='rotate' then
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_token_hash=old.token_hash then raise exception 'GGC_NEW_TOKEN_REQUIRED'; end if;
 elsif p_token_hash is not null then raise exception 'GGC_ROTATION_REQUIRED';
 end if;
 insert into public.ggc_public_shares(competition_id,group_id,token_hash,payload,created_by,updated_at)
 values(p_competition_id,comp->>'societyId',coalesce(p_token_hash,old.token_hash),cleaned,auth.uid(),clock_timestamp())
 on conflict(competition_id) do update set group_id=excluded.group_id,token_hash=coalesce(p_token_hash,ggc_public_shares.token_hash),payload=cleaned,enabled=true,revoked_at=null,updated_at=clock_timestamp(),version=ggc_public_shares.version+1;
 return private.ggc_public_share_status(p_competition_id);
end $$;
create or replace function public.ggc_manage_public_share(p_competition_id text,p_action text,p_token_hash text default null,p_payload jsonb default null,p_expected_version bigint default 0)
returns jsonb language sql security invoker set search_path='' as $$select private.ggc_manage_public_share(p_competition_id,p_action,p_token_hash,p_payload,p_expected_version)$$;
revoke all on function private.ggc_manage_public_share(text,text,text,jsonb,bigint),public.ggc_manage_public_share(text,text,text,jsonb,bigint) from public,anon,authenticated;
grant execute on function private.ggc_manage_public_share(text,text,text,jsonb,bigint),public.ggc_manage_public_share(text,text,text,jsonb,bigint) to authenticated;

create or replace function private.ggc_read_public_leaderboard(p_token text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.ggc_public_shares%rowtype; comp jsonb; entry jsonb; pid text; names text[]; all_visible boolean; player_name text; label text; team_name text; league jsonb; output jsonb:='[]';
begin
 -- A bearer token is intentionally the only anonymous access capability.
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;
 select * into s from public.ggc_public_shares where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and enabled and revoked_at is null;
 if s.id is null or s.payload->>'schemaVersion' is distinct from '1' then return null; end if;
 select data into comp from public.ggc_records where kind='comps' and record_id=s.competition_id and not deleted;
 if comp is null or comp->>'societyId' is distinct from s.group_id then return null; end if;
 -- If the admin tightens the embargo, fail closed until a new projection is published.
 if coalesce(comp->'resultsEmbargo','{}') is distinct from s.payload->'embargo' then return null; end if;
 select data into league from public.ggc_records where kind='leagues' and record_id=comp->>'leagueId' and not deleted;
 for entry in select value from jsonb_array_elements(s.payload->'rows') loop
  names:=array[]::text[];all_visible:=true;
  for pid in select jsonb_array_elements_text(entry->'memberIds') loop
   select case when coalesce(pref.visible,true) then left(r.data->>'name',100) end into player_name from public.ggc_records r left join private.ggc_public_identity_preferences pref on pref.player_id=r.record_id where r.kind='players' and r.record_id=pid and not r.deleted;
   if player_name is null then all_visible:=false;end if;
   names:=array_append(names,coalesce(player_name,'Anonymous golfer'));
  end loop;
  team_name:=null;
  if all_visible and entry->>'teamId' is not null then
   select left(t->>'name',100) into team_name from jsonb_array_elements(coalesce(league->'teams','[]')) t where t->>'id'=entry->>'teamId' and t->'memberIds'=entry->'memberIds';
  end if;
  label:=case when all_visible then coalesce(team_name,array_to_string(names,' & ')) when cardinality(names)>1 then 'Anonymous team '||(entry->>'position') else 'Anonymous golfer '||(entry->>'position') end;
  output:=output||jsonb_build_array(jsonb_build_object('position',entry->'position','name',label,'complete',entry->'complete','totalHoles',entry->'totalHoles','result',entry->'result'));
 end loop;
 return jsonb_build_object('title',left(comp->>'name',160),'publishedAt',s.updated_at,'provisional',s.payload->'provisional','visibleThrough',s.payload->'visibleThrough','rows',output);
end $$;
create or replace function public.get_public_leaderboard(p_token text)
returns jsonb language sql security invoker set search_path='' as $$select private.ggc_read_public_leaderboard(p_token)$$;
revoke all on function private.ggc_read_public_leaderboard(text),public.get_public_leaderboard(text) from public,anon,authenticated;
grant usage on schema private to anon;
grant execute on function private.ggc_read_public_leaderboard(text),public.get_public_leaderboard(text) to anon,authenticated;
notify pgrst,'reload schema';

-- Service-only source/commit boundary for unattended live calculation.
create or replace function private.ggc_public_leaderboard_source(p_token text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.ggc_public_shares%rowtype; records jsonb;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null;end if;
 select * into s from public.ggc_public_shares where enabled and revoked_at is null and token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if s.id is null then return null;end if;
 if not exists(select 1 from public.ggc_records where kind='comps' and record_id=s.competition_id and not deleted and data->>'societyId'=s.group_id) then return null;end if;
 if exists(select 1 from public.ggc_records where kind='societies' and record_id=s.group_id and not deleted and data->>'publicLeaderboardsEnabled'='false') then return null; end if;
 select coalesce(jsonb_agg(jsonb_build_object('kind',r.kind,'data',r.data,'version',r.version,'updatedAt',r.updated_at) order by r.kind,r.record_id),'[]') into records
 from public.ggc_records r where not r.deleted and (
  (r.kind in ('comps','cards','leagues') and r.data->>'societyId'=s.group_id)
  or (r.kind='societies' and r.record_id=s.group_id)
  or (r.kind='players' and r.record_id in (
   select jsonb_array_elements_text(coalesce(data->'members','[]')||coalesce(data->'admins','[]')||jsonb_build_array(data->>'ownerId')) from public.ggc_records where kind='societies' and record_id=s.group_id and not deleted
   union select jsonb_array_elements_text(coalesce(data->'entries','[]')) from public.ggc_records where kind='comps' and data->>'societyId'=s.group_id and not deleted
  ))
  or (r.kind='courses' and r.record_id in (
   select data->>'course' from public.ggc_records where kind='comps' and data->>'societyId'=s.group_id and not deleted
   union select data->>'courseId' from public.ggc_records where kind='cards' and data->>'societyId'=s.group_id and not deleted
  ))
 );
 return jsonb_build_object('competitionId',s.competition_id,'sourceVersion',md5(records::text),'records',records);
end $$;
create or replace function public.ggc_public_leaderboard_source(p_token text)
returns jsonb language sql security invoker set search_path='' as $$select private.ggc_public_leaderboard_source(p_token)$$;
revoke all on function private.ggc_public_leaderboard_source(text),public.ggc_public_leaderboard_source(text) from public,anon,authenticated,service_role;
grant usage on schema private to service_role;
grant execute on function private.ggc_public_leaderboard_source(text),public.ggc_public_leaderboard_source(text) to service_role;

create or replace function private.ggc_commit_public_leaderboard(p_token text,p_source_version text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.ggc_public_shares%rowtype; source jsonb; comp jsonb; cleaned jsonb; entry jsonb; safe_rows jsonb:='[]';
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null;end if;
 select * into s from public.ggc_public_shares where enabled and revoked_at is null and token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if s.id is null then return null;end if;
 source:=private.ggc_public_leaderboard_source(p_token);
 if source->>'sourceVersion' is distinct from p_source_version then raise exception 'GGC_PUBLIC_SOURCE_CHANGED';end if;
 select data into comp from public.ggc_records where kind='comps' and record_id=s.competition_id and not deleted;
 if jsonb_typeof(p_payload->'rows') is distinct from 'array' or jsonb_array_length(p_payload->'rows')>500 then raise exception 'GGC_INVALID_PUBLIC_PAYLOAD';end if;
 for entry in select value from jsonb_array_elements(p_payload->'rows') loop
  safe_rows:=safe_rows||jsonb_build_array(jsonb_build_object('memberIds',entry->'memberIds','teamId',entry->'teamId','position',jsonb_array_length(safe_rows)+1,'result',left(entry->>'result',80),'complete',entry->'complete','totalHoles',entry->'totalHoles'));
 end loop;
 cleaned:=jsonb_build_object('schemaVersion',1,'provisional',p_payload->'provisional','visibleThrough',p_payload->'visibleThrough','embargo',coalesce(comp->'resultsEmbargo','{}'),'rows',safe_rows);
 if s.payload is distinct from cleaned then
  update public.ggc_public_shares set payload=cleaned,updated_at=clock_timestamp() where id=s.id;
 end if;
 return private.ggc_read_public_leaderboard(p_token);
end $$;
create or replace function public.ggc_commit_public_leaderboard(p_token text,p_source_version text,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$select private.ggc_commit_public_leaderboard(p_token,p_source_version,p_payload)$$;
revoke all on function private.ggc_commit_public_leaderboard(text,text,jsonb),public.ggc_commit_public_leaderboard(text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.ggc_commit_public_leaderboard(text,text,jsonb),public.ggc_commit_public_leaderboard(text,text,jsonb) to service_role;
notify pgrst,'reload schema';
