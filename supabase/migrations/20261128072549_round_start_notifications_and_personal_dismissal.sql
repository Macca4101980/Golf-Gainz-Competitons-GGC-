alter table public.ggc_group_update_reads add column if not exists dismissed_at timestamptz;

create or replace function public.ggc_dismiss_group_update(p_update_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare actor text;
begin
 actor:=private.ggc_current_player_id();
 if auth.uid() is null or actor is null then raise exception 'GGC_GROUP_MEMBER_REQUIRED'; end if;
 if not exists(select 1 from public.ggc_group_updates_feed() f where f.id=p_update_id) then raise exception 'GGC_UPDATE_NOT_AVAILABLE'; end if;
 insert into public.ggc_group_update_reads(update_id,player_id,dismissed_at)
 values(p_update_id,actor,now())
 on conflict(update_id,player_id) do update set dismissed_at=now();
end $$;

create or replace function public.ggc_my_dismissed_group_updates()
returns setof uuid language sql stable security definer set search_path=''
as $$
 select r.update_id from public.ggc_group_update_reads r
 where auth.uid() is not null and r.player_id=private.ggc_current_player_id() and r.dismissed_at is not null
$$;

create or replace function public.ggc_publish_round_started_update(p_comp_id text,p_round_group_id text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
 actor text;actor_name text;comp_data jsonb;group_data jsonb;round_group jsonb;group_id text;audience_name text;comp_name text;player_names text;started_at timestamptz;event_name text;update_id uuid;
begin
 if auth.uid() is null then raise exception 'GGC_GROUP_MEMBER_REQUIRED'; end if;
 actor:=private.ggc_current_player_id();
 if actor is null then raise exception 'GGC_GROUP_MEMBER_REQUIRED'; end if;
 select r.data into comp_data from public.ggc_records r where r.kind='comps' and r.record_id=p_comp_id and not r.deleted;
 if comp_data is null then raise exception 'GGC_COMPETITION_NOT_FOUND'; end if;
 group_id:=comp_data->>'societyId';
 if group_id is null or not private.ggc_updates_group_member(group_id) then raise exception 'GGC_GROUP_MEMBER_REQUIRED'; end if;
 select item into round_group from jsonb_array_elements(coalesce(comp_data->'roundGroups','[]'::jsonb)) item where item->>'id'=p_round_group_id limit 1;
 if round_group is null then raise exception 'GGC_ROUND_GROUP_NOT_FOUND'; end if;
 if round_group->>'startedBy' is distinct from actor then raise exception 'GGC_ROUND_START_ACTOR_MISMATCH'; end if;
 started_at:=private.ggc_safe_timestamptz(round_group->>'startedAt');
 if started_at is null or started_at<now()-interval '15 minutes' or started_at>now()+interval '2 minutes' then raise exception 'GGC_ROUND_START_EXPIRED'; end if;
 select r.data into group_data from public.ggc_records r where r.kind='societies' and r.record_id=group_id and not r.deleted;
 audience_name:=case when group_data->>'roundStartNotificationAudience'='group' then 'group' else 'admins' end;
 select coalesce(nullif(btrim(r.data->>'name'),''),'A golfer') into actor_name from public.ggc_records r where r.kind='players' and r.record_id=actor and not r.deleted;
 actor_name:=coalesce(actor_name,'A golfer');comp_name:=coalesce(nullif(btrim(comp_data->>'name'),''),'Competition');
 select string_agg(coalesce(nullif(btrim(p.data->>'name'),''),'Golfer'),', ' order by ids.ordinality) into player_names
 from jsonb_array_elements_text(coalesce(round_group->'playerIds','[]'::jsonb)) with ordinality ids(player_id,ordinality)
 left join public.ggc_records p on p.kind='players' and p.record_id=ids.player_id and not p.deleted;
 event_name:='round-start:'||p_comp_id||':'||p_round_group_id||':'||coalesce(round_group->>'startedAt','');
 insert into public.ggc_group_updates(group_id,kind,title,body,options,created_by_player_id,audience,event_key,source_type)
 values(group_id,'announcement',left(actor_name||' started a round',120),left(comp_name||case when nullif(player_names,'') is null then '' else E'\n'||player_names end,4000),'[]'::jsonb,actor,audience_name,event_name,'round-start')
 on conflict(event_key) where event_key is not null do nothing returning id into update_id;
 if update_id is null then select u.id into update_id from public.ggc_group_updates u where u.event_key=event_name; end if;
 return update_id;
end $$;

revoke all on function public.ggc_dismiss_group_update(uuid),public.ggc_my_dismissed_group_updates(),public.ggc_publish_round_started_update(text,text) from public,anon,authenticated;
grant execute on function public.ggc_dismiss_group_update(uuid),public.ggc_my_dismissed_group_updates(),public.ggc_publish_round_started_update(text,text) to authenticated;
