-- Allow any authenticated Group member to publish/share weekly or overall leaderboards.
-- Only Group owners/admins may rotate or revoke a link; the Group-level switch remains admin-only.

create or replace function private.ggc_public_competition_admin(p_competition_id text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor text; group_id text; grp jsonb; permitted boolean;
begin
 if auth.uid() is null then return false; end if;
 select data->>'societyId' into group_id from public.ggc_records where kind='comps' and record_id=p_competition_id and not deleted limit 1;
 select record_id into actor from public.ggc_records where kind='players' and not deleted and data->>'authUserId'=auth.uid()::text order by updated_at desc limit 1;
 if actor is null or group_id is null then return false; end if;
 if to_regclass('public.ggc_group_memberships') is not null then
  execute 'select exists(select 1 from public.ggc_group_memberships where group_id=$1 and player_id=$2 and role in (''owner'',''admin''))' into permitted using group_id,actor;
  return permitted;
 end if;
 select data into grp from public.ggc_records where kind='societies' and record_id=group_id and not deleted;
 return coalesce(grp->>'ownerId'=actor or (coalesce(grp->'admins','[]') ? actor),false);
end $$;

create or replace function private.ggc_public_league_member(p_league_id text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor text; group_id text; grp jsonb; permitted boolean;
begin
 if auth.uid() is null then return false; end if;
 group_id:=private.ggc_league_group(p_league_id);
 select record_id into actor from public.ggc_records where kind='players' and not deleted and data->>'authUserId'=auth.uid()::text order by updated_at desc limit 1;
 if actor is null or group_id is null then return false; end if;
 if to_regclass('public.ggc_group_memberships') is not null then
  execute 'select exists(select 1 from public.ggc_group_memberships where group_id=$1 and player_id=$2)' into permitted using group_id,actor;
  return permitted;
 end if;
 select data into grp from public.ggc_records where kind='societies' and record_id=group_id and not deleted;
 return coalesce(grp->>'ownerId'=actor or (coalesce(grp->'admins','[]') ? actor) or (coalesce(grp->'members','[]') ? actor),false);
end $$;

revoke all on function private.ggc_public_competition_admin(text) from public,anon,authenticated;
revoke all on function private.ggc_public_league_member(text) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.ggc_manage_public_share(p_competition_id text, p_action text, p_token_hash text, p_payload jsonb, p_expected_version bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare comp jsonb; grp jsonb; old public.ggc_public_shares%rowtype; entry jsonb; ids jsonb; pid text; safe_rows jsonb:='[]'; cleaned jsonb; through_hole int:=18; provisional boolean:=false; e jsonb;
begin
 if not private.ggc_public_share_admin(p_competition_id) then raise exception 'GGC_GROUP_MEMBER_REQUIRED'; end if;
 if p_action not in ('publish','refresh','rotate','revoke') then raise exception 'GGC_INVALID_SHARE_ACTION'; end if;
 if p_action in ('rotate','revoke') and not private.ggc_public_competition_admin(p_competition_id) then raise exception 'GGC_GROUP_ADMIN_REQUIRED'; end if;
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
 if old.id is null or not old.enabled or old.revoked_at is not null or p_action='rotate' or (p_action='publish' and p_token_hash is not null) then
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_token_hash=old.token_hash then raise exception 'GGC_NEW_TOKEN_REQUIRED'; end if;
 elsif p_token_hash is not null then raise exception 'GGC_ROTATION_REQUIRED';
 end if;
 insert into public.ggc_public_shares(competition_id,group_id,token_hash,payload,created_by,updated_at)
 values(p_competition_id,comp->>'societyId',coalesce(p_token_hash,old.token_hash),cleaned,auth.uid(),clock_timestamp())
 on conflict(competition_id) do update set group_id=excluded.group_id,token_hash=coalesce(p_token_hash,ggc_public_shares.token_hash),payload=cleaned,enabled=true,revoked_at=null,updated_at=clock_timestamp(),version=ggc_public_shares.version+1;
 return private.ggc_public_share_status(p_competition_id);
end $function$
;

CREATE OR REPLACE FUNCTION private.ggc_manage_public_league_share(p_league_id text, p_action text, p_token_hash text DEFAULT NULL::text, p_payload jsonb DEFAULT NULL::jsonb, p_expected_version bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.ggc_public_league_shares%rowtype; group_id text; grp jsonb; entry jsonb; pid text; safe_rows jsonb:='[]'; cleaned jsonb;
begin
 if not private.ggc_public_league_member(p_league_id) then raise exception 'GGC_GROUP_MEMBER_REQUIRED'; end if;
 if p_action not in ('publish','refresh','rotate','revoke') then raise exception 'GGC_INVALID_SHARE_ACTION'; end if;
 if p_action in ('rotate','revoke') and not private.ggc_public_league_admin(p_league_id) then raise exception 'GGC_GROUP_ADMIN_REQUIRED'; end if;
 group_id:=private.ggc_league_group(p_league_id);
 select * into s from public.ggc_public_league_shares where league_id=p_league_id for update;
 if coalesce(s.version,0) is distinct from p_expected_version then raise exception 'GGC_SHARE_CONFLICT: Reopen leaderboard to load the latest sharing settings'; end if;
 if p_action='revoke' then
  update public.ggc_public_league_shares set enabled=false,revoked_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 where league_id=p_league_id;
  return private.ggc_public_league_share_status(p_league_id);
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
 if s.id is null or not s.enabled or s.revoked_at is not null or p_action='rotate' or (p_action='publish' and p_token_hash is not null) then
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_token_hash=s.token_hash then raise exception 'GGC_NEW_TOKEN_REQUIRED'; end if;
 elsif p_token_hash is not null then raise exception 'GGC_ROTATION_REQUIRED'; end if;
 insert into public.ggc_public_league_shares(league_id,group_id,token_hash,payload,created_by,updated_at)
 values(p_league_id,group_id,coalesce(p_token_hash,s.token_hash),cleaned,auth.uid(),clock_timestamp())
 on conflict(league_id) do update set group_id=excluded.group_id,token_hash=coalesce(p_token_hash,ggc_public_league_shares.token_hash),payload=cleaned,enabled=true,revoked_at=null,updated_at=clock_timestamp(),version=ggc_public_league_shares.version+1;
 return private.ggc_public_league_share_status(p_league_id);
end $function$
;


revoke all on function private.ggc_manage_public_share(text,text,text,jsonb,bigint) from public,anon,authenticated;
revoke all on function private.ggc_manage_public_league_share(text,text,text,jsonb,bigint) from public,anon,authenticated;

create or replace function private.ggc_public_league_share_status(p_league_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.ggc_public_league_shares%rowtype;
begin
 if not private.ggc_public_league_member(p_league_id) then raise exception 'GGC_GROUP_MEMBER_REQUIRED'; end if;
 select * into s from public.ggc_public_league_shares where league_id=p_league_id;
 return coalesce(jsonb_build_object('enabled',s.enabled and s.revoked_at is null,'version',s.version,'updatedAt',s.updated_at),jsonb_build_object('enabled',false,'version',0));
end $$;
revoke all on function private.ggc_public_league_share_status(text) from public,anon,authenticated;

create or replace function public.ggc_public_league_share_status(p_league_id text)
returns jsonb language sql security invoker set search_path='' as $$
 select private.ggc_public_league_share_status(p_league_id)
$$;

create or replace function public.ggc_manage_public_league_share(p_league_id text,p_action text,p_token_hash text default null,p_payload jsonb default null,p_expected_version bigint default 0)
returns jsonb language sql security invoker set search_path='' as $$
 select private.ggc_manage_public_league_share(p_league_id,p_action,p_token_hash,p_payload,p_expected_version)
$$;

revoke all on function public.ggc_public_league_share_status(text) from public,anon;
revoke all on function public.ggc_manage_public_league_share(text,text,text,jsonb,bigint) from public,anon;
grant execute on function public.ggc_public_league_share_status(text) to authenticated;
grant execute on function public.ggc_manage_public_league_share(text,text,text,jsonb,bigint) to authenticated;
notify pgrst,'reload schema';


-- Public authenticated RPC wrappers. These are security definer only so they can cross
-- into the unexposed private schema; all authorization is re-checked by the private functions.
create or replace function public.ggc_public_share_status(p_competition_id text)
returns jsonb language sql security definer set search_path='' as $$
 select private.ggc_public_share_status(p_competition_id)
$$;

create or replace function public.ggc_manage_public_share(p_competition_id text,p_action text,p_token_hash text default null,p_payload jsonb default null,p_expected_version bigint default 0)
returns jsonb language sql security definer set search_path='' as $$
 select private.ggc_manage_public_share(p_competition_id,p_action,p_token_hash,p_payload,p_expected_version)
$$;

create or replace function public.ggc_public_league_share_status(p_league_id text)
returns jsonb language sql security definer set search_path='' as $$
 select private.ggc_public_league_share_status(p_league_id)
$$;

create or replace function public.ggc_manage_public_league_share(p_league_id text,p_action text,p_token_hash text default null,p_payload jsonb default null,p_expected_version bigint default 0)
returns jsonb language sql security definer set search_path='' as $$
 select private.ggc_manage_public_league_share(p_league_id,p_action,p_token_hash,p_payload,p_expected_version)
$$;

revoke all on function public.ggc_public_share_status(text) from public,anon;
revoke all on function public.ggc_manage_public_share(text,text,text,jsonb,bigint) from public,anon;
revoke all on function public.ggc_public_league_share_status(text) from public,anon;
revoke all on function public.ggc_manage_public_league_share(text,text,text,jsonb,bigint) from public,anon;
grant execute on function public.ggc_public_share_status(text) to authenticated;
grant execute on function public.ggc_manage_public_share(text,text,text,jsonb,bigint) to authenticated;
grant execute on function public.ggc_public_league_share_status(text) to authenticated;
grant execute on function public.ggc_manage_public_league_share(text,text,text,jsonb,bigint) to authenticated;
notify pgrst,'reload schema';


-- Resolve membership across every player record linked to the signed-in auth account.
create or replace function private.ggc_public_share_admin(p_competition_id text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare group_id text; grp jsonb; permitted boolean;
begin
 if auth.uid() is null then return false; end if;
 select data->>'societyId' into group_id from public.ggc_records where kind='comps' and record_id=p_competition_id and not deleted limit 1;
 if group_id is null then return false; end if;
 if to_regclass('public.ggc_group_memberships') is not null then
  execute 'select exists(select 1 from public.ggc_group_memberships m join public.ggc_records p on p.kind=''players'' and p.record_id=m.player_id and not p.deleted where m.group_id=$1 and p.data->>''authUserId''=$2)' into permitted using group_id,auth.uid()::text;
  return permitted;
 end if;
 select data into grp from public.ggc_records where kind='societies' and record_id=group_id and not deleted;
 return exists(select 1 from public.ggc_records p where p.kind='players' and not p.deleted and p.data->>'authUserId'=auth.uid()::text and (grp->>'ownerId'=p.record_id or coalesce(grp->'admins','[]') ? p.record_id or coalesce(grp->'members','[]') ? p.record_id));
end $$;

create or replace function private.ggc_public_competition_admin(p_competition_id text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare group_id text; grp jsonb; permitted boolean;
begin
 if auth.uid() is null then return false; end if;
 select data->>'societyId' into group_id from public.ggc_records where kind='comps' and record_id=p_competition_id and not deleted limit 1;
 if group_id is null then return false; end if;
 if to_regclass('public.ggc_group_memberships') is not null then
  execute 'select exists(select 1 from public.ggc_group_memberships m join public.ggc_records p on p.kind=''players'' and p.record_id=m.player_id and not p.deleted where m.group_id=$1 and m.role in (''owner'',''admin'') and p.data->>''authUserId''=$2)' into permitted using group_id,auth.uid()::text;
  return permitted;
 end if;
 select data into grp from public.ggc_records where kind='societies' and record_id=group_id and not deleted;
 return exists(select 1 from public.ggc_records p where p.kind='players' and not p.deleted and p.data->>'authUserId'=auth.uid()::text and (grp->>'ownerId'=p.record_id or coalesce(grp->'admins','[]') ? p.record_id));
end $$;

create or replace function private.ggc_public_league_member(p_league_id text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare group_id text; grp jsonb; permitted boolean;
begin
 if auth.uid() is null then return false; end if;
 group_id:=private.ggc_league_group(p_league_id);
 if group_id is null then return false; end if;
 if to_regclass('public.ggc_group_memberships') is not null then
  execute 'select exists(select 1 from public.ggc_group_memberships m join public.ggc_records p on p.kind=''players'' and p.record_id=m.player_id and not p.deleted where m.group_id=$1 and p.data->>''authUserId''=$2)' into permitted using group_id,auth.uid()::text;
  return permitted;
 end if;
 select data into grp from public.ggc_records where kind='societies' and record_id=group_id and not deleted;
 return exists(select 1 from public.ggc_records p where p.kind='players' and not p.deleted and p.data->>'authUserId'=auth.uid()::text and (grp->>'ownerId'=p.record_id or coalesce(grp->'admins','[]') ? p.record_id or coalesce(grp->'members','[]') ? p.record_id));
end $$;

create or replace function private.ggc_public_league_admin(p_league_id text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare group_id text; grp jsonb; permitted boolean;
begin
 if auth.uid() is null then return false; end if;
 group_id:=private.ggc_league_group(p_league_id);
 if group_id is null then return false; end if;
 if to_regclass('public.ggc_group_memberships') is not null then
  execute 'select exists(select 1 from public.ggc_group_memberships m join public.ggc_records p on p.kind=''players'' and p.record_id=m.player_id and not p.deleted where m.group_id=$1 and m.role in (''owner'',''admin'') and p.data->>''authUserId''=$2)' into permitted using group_id,auth.uid()::text;
  return permitted;
 end if;
 select data into grp from public.ggc_records where kind='societies' and record_id=group_id and not deleted;
 return exists(select 1 from public.ggc_records p where p.kind='players' and not p.deleted and p.data->>'authUserId'=auth.uid()::text and (grp->>'ownerId'=p.record_id or coalesce(grp->'admins','[]') ? p.record_id));
end $$;

revoke all on function private.ggc_public_share_admin(text) from public,anon,authenticated;
revoke all on function private.ggc_public_competition_admin(text) from public,anon,authenticated;
revoke all on function private.ggc_public_league_member(text) from public,anon,authenticated;
revoke all on function private.ggc_public_league_admin(text) from public,anon,authenticated;


create or replace function private.ggc_public_league_share_status(p_league_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.ggc_public_league_shares%rowtype;
begin
 if not private.ggc_public_league_member(p_league_id) then raise exception 'GGC_GROUP_MEMBER_REQUIRED'; end if;
 select * into s from public.ggc_public_league_shares where league_id=p_league_id;
 if s.id is null then return jsonb_build_object('enabled',false,'version',0); end if;
 return jsonb_build_object('enabled',s.enabled and s.revoked_at is null,'version',s.version,'updatedAt',s.updated_at);
end $$;
revoke all on function private.ggc_public_league_share_status(text) from public,anon,authenticated;
notify pgrst,'reload schema';
