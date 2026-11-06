CREATE OR REPLACE FUNCTION private.ggc_public_league_leaderboard_source(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.ggc_public_league_shares%rowtype; records jsonb;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null;end if;
 select * into s from public.ggc_public_league_shares where enabled and revoked_at is null and token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if s.id is null then return null;end if;
 if not exists(select 1 from public.ggc_records where kind='leagues' and record_id=s.league_id and not deleted and data->>'societyId'=s.group_id) then return null;end if;
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
 return jsonb_build_object('leagueId',s.league_id,'sourceVersion',md5(records::text),'records',records);
end $function$
; 
create or replace function public.ggc_public_league_leaderboard_source(p_token text)
returns jsonb language sql security invoker set search_path='' as $$select private.ggc_public_league_leaderboard_source(p_token)$$;
revoke all on function private.ggc_public_league_leaderboard_source(text),public.ggc_public_league_leaderboard_source(text) from public,anon,authenticated,service_role;
grant execute on function private.ggc_public_league_leaderboard_source(text),public.ggc_public_league_leaderboard_source(text) to service_role;

create or replace function private.ggc_commit_public_league_leaderboard(p_token text,p_source_version text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.ggc_public_league_shares%rowtype; source jsonb; league jsonb; entry jsonb; safe_rows jsonb:='[]'; cleaned jsonb;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null;end if;
 select * into s from public.ggc_public_league_shares where enabled and revoked_at is null and token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if s.id is null then return null;end if;
 source:=private.ggc_public_league_leaderboard_source(p_token);
 if source is null then return null;end if;
 if source->>'sourceVersion' is distinct from p_source_version then raise exception 'GGC_PUBLIC_SOURCE_CHANGED';end if;
 select data into league from public.ggc_records where kind='leagues' and record_id=s.league_id and not deleted;
 if jsonb_typeof(p_payload->'rows') is distinct from 'array' or jsonb_array_length(p_payload->'rows')>500 then raise exception 'GGC_INVALID_PUBLIC_PAYLOAD';end if;
 for entry in select value from jsonb_array_elements(p_payload->'rows') loop
  if jsonb_typeof(entry->'memberIds') is distinct from 'array' or jsonb_array_length(entry->'memberIds') not between 1 and 4 then raise exception 'GGC_INVALID_PUBLIC_ROW';end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(league->'teams','[]')) team where team->>'id'=entry->>'teamId' and (team->'memberIds') @> (entry->'memberIds') and (entry->'memberIds') @> (team->'memberIds')) then raise exception 'GGC_INVALID_PUBLIC_TEAM';end if;
  safe_rows:=safe_rows||jsonb_build_array(jsonb_build_object(
   'memberIds',entry->'memberIds','teamId',left(entry->>'teamId',256),'position',jsonb_array_length(safe_rows)+1,
   'badgeImage',private.ggc_safe_public_badge_image(entry->>'badgeImage'),
   'result',left(entry->>'result',80),'complete',greatest(0,least(18,coalesce((entry->>'complete')::int,18))),'totalHoles',18,
   'played',greatest(0,coalesce((entry->>'played')::int,0)),'cut',greatest(0,least(100,coalesce((entry->>'cut')::numeric,0))),
   'provisionalCut',coalesce((entry->>'provisionalCut')::boolean,false),
   'counting',coalesce((select jsonb_agg(greatest(0,least(100,v::numeric))) from jsonb_array_elements_text(coalesce(entry->'counting','[]'::jsonb)) v),'[]'::jsonb)));
 end loop;
 cleaned:=jsonb_build_object('schemaVersion',1,'scope','league','title',left(league->>'name',160),'provisional',coalesce((p_payload->>'provisional')::boolean,false),'visibleThrough',greatest(0,least(18,coalesce((p_payload->>'visibleThrough')::int,18))),'rows',safe_rows);
 if s.payload is distinct from cleaned then update public.ggc_public_league_shares set payload=cleaned,updated_at=clock_timestamp() where id=s.id;end if;
 return private.ggc_read_public_league_leaderboard(p_token);
end $$;
create or replace function public.ggc_commit_public_league_leaderboard(p_token text,p_source_version text,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$select private.ggc_commit_public_league_leaderboard(p_token,p_source_version,p_payload)$$;
revoke all on function private.ggc_commit_public_league_leaderboard(text,text,jsonb),public.ggc_commit_public_league_leaderboard(text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.ggc_commit_public_league_leaderboard(text,text,jsonb),public.ggc_commit_public_league_leaderboard(text,text,jsonb) to service_role;
