-- Let authenticated Group members resolve every golfer who is actually
-- referenced by one of their Group's competitions or Leagues. This is a
-- read-only policy: the existing create/update/delete boundaries are unchanged.
create or replace function private.ggc_can_read_competition_participant(p_player_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  uid text := auth.uid()::text;
  my_player_ids text[];
begin
  if uid is null or nullif(p_player_id, '') is null then return false; end if;

  select coalesce(array_agg(record_id), array[]::text[])
    into my_player_ids
  from public.ggc_records
  where kind = 'players'
    and not deleted
    and (data->>'authUserId' = uid or record_id = uid);

  return exists (
    select 1
    from public.ggc_records society
    where society.kind = 'societies'
      and not society.deleted
      and (
        coalesce(society.data->'members' ?| my_player_ids, false)
        or coalesce(society.data->'admins' ?| my_player_ids, false)
        or coalesce(society.data->'members' ? uid, false)
        or coalesce(society.data->'admins' ? uid, false)
        or society.data->>'ownerId' = uid
        or society.data->>'ownerId' = any(my_player_ids)
      )
      and (
        coalesce(society.data->'members' ? p_player_id, false)
        or coalesce(society.data->'admins' ? p_player_id, false)
        or society.data->>'ownerId' = p_player_id
        or exists (
          select 1
          from public.ggc_records competition
          where competition.kind = 'comps'
            and not competition.deleted
            and competition.data->>'societyId' = society.record_id
            and (
              coalesce(competition.data->'entries' ? p_player_id, false)
              or exists (
                select 1
                from jsonb_array_elements(
                  case when jsonb_typeof(competition.data->'pairs') = 'array'
                    then competition.data->'pairs' else '[]'::jsonb end
                ) pair
                where coalesce(pair->'ids' ? p_player_id, false)
              )
              or exists (
                select 1
                from jsonb_array_elements(
                  case when jsonb_typeof(competition.data->'roundGroups') = 'array'
                    then competition.data->'roundGroups' else '[]'::jsonb end
                ) playing_group
                where coalesce(playing_group->'playerIds' ? p_player_id, false)
              )
            )
        )
        or exists (
          select 1
          from public.ggc_records card
          where card.kind = 'cards'
            and not card.deleted
            and card.data->>'societyId' = society.record_id
            and card.data->>'playerId' = p_player_id
        )
        or exists (
          select 1
          from public.ggc_records league
          where league.kind = 'leagues'
            and not league.deleted
            and league.data->>'societyId' = society.record_id
            and (
              coalesce(league.data->'memberIds' ? p_player_id, false)
              or exists (
                select 1
                from jsonb_array_elements(
                  case when jsonb_typeof(league.data->'teams') = 'array'
                    then league.data->'teams' else '[]'::jsonb end
                ) team
                where coalesce(team->'memberIds' ? p_player_id, false)
              )
            )
        )
      )
  );
end
$function$;

revoke all on function private.ggc_can_read_competition_participant(text) from public, anon;
grant execute on function private.ggc_can_read_competition_participant(text) to authenticated, service_role;

drop policy if exists ggc_records_competition_participant_select on public.ggc_records;
create policy ggc_records_competition_participant_select
on public.ggc_records
for select
to authenticated
using (
  kind = 'players'
  and (select private.ggc_can_read_competition_participant(record_id))
);
