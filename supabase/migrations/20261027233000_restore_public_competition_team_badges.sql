-- Make competition/week public leaderboards return the same team presentation fields as league shares.
CREATE OR REPLACE FUNCTION private.ggc_read_public_leaderboard(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  s public.ggc_public_shares%rowtype;
  comp jsonb;
  entry jsonb;
  pid text;
  names text[];
  all_visible boolean;
  player_name text;
  label text;
  team_name text;
  team_badge text;
  league jsonb;
  output jsonb := '[]';
begin
  -- A bearer token is intentionally the only anonymous access capability.
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;

  select * into s
  from public.ggc_public_shares
  where token_hash = encode(extensions.digest(p_token,'sha256'),'hex')
    and enabled
    and revoked_at is null;

  if s.id is null or s.payload->>'schemaVersion' is distinct from '1' then return null; end if;

  select data into comp
  from public.ggc_records
  where kind='comps' and record_id=s.competition_id and not deleted;

  if comp is null or comp->>'societyId' is distinct from s.group_id then return null; end if;
  if exists(
    select 1 from public.ggc_records
    where kind='societies' and record_id=s.group_id and not deleted
      and data->>'publicLeaderboardsEnabled'='false'
  ) then return null; end if;

  -- If the admin tightens the embargo, fail closed until a new projection is published.
  if coalesce(comp->'resultsEmbargo','{}') is distinct from s.payload->'embargo' then return null; end if;

  select data into league
  from public.ggc_records
  where kind='leagues' and record_id=comp->>'leagueId' and not deleted;

  for entry in select value from jsonb_array_elements(s.payload->'rows') loop
    names := array[]::text[];
    all_visible := true;

    for pid in select jsonb_array_elements_text(entry->'memberIds') loop
      select case when coalesce(pref.visible,true) then left(r.data->>'name',100) end
      into player_name
      from public.ggc_records r
      left join private.ggc_public_identity_preferences pref on pref.player_id=r.record_id
      where r.kind='players' and r.record_id=pid and not r.deleted;

      if player_name is null then all_visible := false; end if;
      names := array_append(names,coalesce(player_name,'Anonymous golfer'));
    end loop;

    team_name := null;
    team_badge := null;
    if all_visible and entry->>'teamId' is not null then
      select left(t->>'name',100),
             nullif(private.ggc_safe_public_badge_image(t->>'badgeImage'),'')
      into team_name, team_badge
      from jsonb_array_elements(coalesce(league->'teams','[]')) t
      where t->>'id'=entry->>'teamId'
      limit 1;
    end if;

    label := case
      when all_visible then coalesce(team_name,array_to_string(names,' & '))
      when cardinality(names)>1 then 'Anonymous team '||(entry->>'position')
      else 'Anonymous golfer '||(entry->>'position')
    end;

    output := output || jsonb_build_array(jsonb_build_object(
      'position',entry->'position',
      'name',label,
      'teamName',label,
      'memberLine',case
        when all_visible then array_to_string(names,' & ')
        when cardinality(names)>1 then 'Player names hidden'
        else 'Player name hidden'
      end,
      'badgeImage',case when all_visible then team_badge else null end,
      'complete',entry->'complete',
      'totalHoles',entry->'totalHoles',
      'result',entry->'result'
    ));
  end loop;

  return jsonb_build_object(
    'title',left(comp->>'name',160),
    'publishedAt',s.updated_at,
    'provisional',s.payload->'provisional',
    'visibleThrough',s.payload->'visibleThrough',
    'rows',output
  );
end
$function$;
