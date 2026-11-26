alter table public.ggc_group_update_reads add column if not exists dismissed_at timestamptz;

create or replace function public.ggc_dismiss_group_update(p_update_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare actor text;
begin
 actor:=private.ggc_current_player_id();
 if auth.uid() is null or actor is null then raise exception 'GGC_GROUP_MEMBER_REQUIRED'; end if;
 -- Only the caller's read marker is changed; the shared update and votes are untouched.
 if not exists(select 1 from public.ggc_group_updates_feed() f where f.id=p_update_id) then
  raise exception 'GGC_UPDATE_NOT_AVAILABLE';
 end if;
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
revoke all on function public.ggc_dismiss_group_update(uuid),public.ggc_my_dismissed_group_updates() from public,anon;
grant execute on function public.ggc_dismiss_group_update(uuid),public.ggc_my_dismissed_group_updates() to authenticated;
