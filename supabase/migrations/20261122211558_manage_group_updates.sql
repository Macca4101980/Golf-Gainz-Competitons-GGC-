-- Allow Group owners/admins to edit and remove updates, and inspect named poll responses.
-- Tables remain private; every operation validates the caller against live Group membership.

create or replace function public.ggc_update_group_update(p_update_id uuid,p_kind text,p_title text,p_body text default '',p_options jsonb default '[]'::jsonb,p_closes_at timestamptz default null)
returns void language plpgsql security definer set search_path=''
as $$
declare item public.ggc_group_updates%rowtype; clean_options jsonb;
begin
 select * into item from public.ggc_group_updates where id=p_update_id and deleted_at is null for update;
 if item.id is null or not private.ggc_updates_group_admin(item.group_id) then raise exception 'GGC_GROUP_ADMIN_REQUIRED'; end if;
 if p_kind not in ('announcement','poll') then raise exception 'GGC_INVALID_UPDATE_KIND'; end if;
 clean_options:=case when p_kind='poll' then coalesce(p_options,'[]'::jsonb) else '[]'::jsonb end;
 if p_kind='poll' and (jsonb_typeof(clean_options)<>'array' or jsonb_array_length(clean_options) not between 2 and 10 or exists(select 1 from jsonb_array_elements(clean_options) o where coalesce(o->>'id','')='' or char_length(btrim(coalesce(o->>'label',''))) not between 1 and 100)) then raise exception 'GGC_INVALID_POLL_OPTIONS'; end if;
 update public.ggc_group_updates set kind=p_kind,title=btrim(p_title),body=btrim(coalesce(p_body,'')),options=clean_options,closes_at=case when p_kind='poll' then p_closes_at end,updated_at=now() where id=item.id;
 delete from public.ggc_group_update_votes v where v.update_id=item.id and (p_kind<>'poll' or not exists(select 1 from jsonb_array_elements(clean_options) o where o->>'id'=v.option_id));
end $$;

create or replace function public.ggc_delete_group_update(p_update_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare group_key text;
begin
 select group_id into group_key from public.ggc_group_updates where id=p_update_id and deleted_at is null for update;
 if group_key is null or not private.ggc_updates_group_admin(group_key) then raise exception 'GGC_GROUP_ADMIN_REQUIRED'; end if;
 update public.ggc_group_updates set deleted_at=now(),updated_at=now() where id=p_update_id;
end $$;

create or replace function public.ggc_group_poll_responses(p_update_id uuid)
returns table(player_id text,player_name text,option_id text,voted_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
declare item public.ggc_group_updates%rowtype;
begin
 select * into item from public.ggc_group_updates where id=p_update_id and deleted_at is null;
 if item.id is null or item.kind<>'poll' or not private.ggc_updates_group_admin(item.group_id) then raise exception 'GGC_GROUP_ADMIN_REQUIRED'; end if;
 return query
 select m.player_id,coalesce(p.data->>'name','Unknown member'),v.option_id,v.updated_at
 from public.ggc_group_memberships m
 join public.ggc_records p on p.kind='players' and p.record_id=m.player_id and not p.deleted
 left join public.ggc_group_update_votes v on v.update_id=item.id and v.player_id=m.player_id
 where m.group_id=item.group_id
 order by lower(coalesce(p.data->>'name','Unknown member'));
end $$;

revoke all on function public.ggc_update_group_update(uuid,text,text,text,jsonb,timestamptz),public.ggc_delete_group_update(uuid),public.ggc_group_poll_responses(uuid) from public,anon,authenticated;
grant execute on function public.ggc_update_group_update(uuid,text,text,text,jsonb,timestamptz),public.ggc_delete_group_update(uuid),public.ggc_group_poll_responses(uuid) to authenticated;
