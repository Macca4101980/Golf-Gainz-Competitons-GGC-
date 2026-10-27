-- Preserve trusted Golf Gainz team badges on public leaderboards while rejecting arbitrary remote images.
CREATE OR REPLACE FUNCTION private.ggc_safe_public_badge_image(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_value LIKE 'data:image/%' THEN left(p_value, 500000)
    WHEN p_value LIKE 'https://yqwnbwkqjvqtdxvlscko.supabase.co/storage/v1/object/public/team-badges/%'
      THEN left(p_value, 2048)
    ELSE ''
  END
$function$;

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
  safe_rows:=safe_rows||jsonb_build_array(jsonb_build_object('memberIds',entry->'memberIds','teamId',left(entry->>'teamId',256),'teamName',left(entry->>'teamName',100),'badgeImage',private.ggc_safe_public_badge_image(entry->>'badgeImage'),'position',jsonb_array_length(safe_rows)+1,'result',left(entry->>'result',80),'complete',greatest(0,least(18,coalesce((entry->>'complete')::int,18))),'totalHoles',18,'played',greatest(0,coalesce((entry->>'played')::int,0)),'cut',greatest(0,least(100,coalesce((entry->>'cut')::numeric,0))),'provisionalCut',coalesce((entry->>'provisionalCut')::boolean,false),'counting',coalesce((select jsonb_agg(greatest(0,least(100,(v)::numeric))) from jsonb_array_elements_text(coalesce(entry->'counting','[]'::jsonb)) v),'[]'::jsonb)));
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

CREATE OR REPLACE FUNCTION private.ggc_read_public_league_leaderboard(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.ggc_public_league_shares%rowtype; grp jsonb; league jsonb; entry jsonb; pid text; names text[]; all_visible boolean; player_name text; label text; team_name text; team_badge text; output jsonb:='[]';
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
  team_name:=null; team_badge:=null;
  if all_visible and entry->>'teamId' is not null then
   select left(t->>'name',100),nullif(private.ggc_safe_public_badge_image(t->>'badgeImage'),'') into team_name,team_badge from jsonb_array_elements(coalesce(league->'teams','[]')) t where t->>'id'=entry->>'teamId';
  end if;
  label:=case when all_visible then coalesce(team_name,array_to_string(names,' & ')) when cardinality(names)>1 then 'Anonymous team '||(entry->>'position') else 'Anonymous golfer '||(entry->>'position') end;
  output:=output||jsonb_build_array(jsonb_build_object('position',entry->'position','name',label,'teamName',label,'memberLine',case when all_visible then array_to_string(names,' & ') else case when cardinality(names)>1 then 'Player names hidden' else 'Player name hidden' end end,'badgeImage',case when all_visible then coalesce(team_badge,nullif(entry->>'badgeImage','')) else null end,'complete',entry->'complete','totalHoles',entry->'totalHoles','result',entry->>'result','played',entry->'played','cut',entry->'cut','provisionalCut',entry->'provisionalCut','counting',coalesce(entry->'counting','[]'::jsonb)));
 end loop;
 return jsonb_build_object('title',coalesce(s.payload->>'title',league->>'name'),'summary','Best counting scores · 90% handicap · League handicap adjustments','publishedAt',s.updated_at,'provisional',s.payload->'provisional','visibleThrough',s.payload->'visibleThrough','rows',output);
end $function$
;