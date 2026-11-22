-- Automatic, deduplicated Updates with group/admin/private audiences.
alter table public.ggc_group_updates add column if not exists audience text not null default 'group';
alter table public.ggc_group_updates add column if not exists target_player_id text;
alter table public.ggc_group_updates add column if not exists event_key text;
alter table public.ggc_group_updates add column if not exists source_type text not null default 'manual';
alter table public.ggc_group_updates drop constraint if exists ggc_group_updates_audience_valid;
alter table public.ggc_group_updates add constraint ggc_group_updates_audience_valid check (
 audience in ('group','admins','member') and (audience<>'member' or target_player_id is not null)
);
create unique index if not exists ggc_group_updates_event_key_uidx on public.ggc_group_updates(event_key) where event_key is not null;

create or replace function private.ggc_insert_system_update(p_group_id text,p_event_key text,p_title text,p_body text,p_audience text default 'group',p_target_player_id text default null,p_actor text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare new_id uuid;
begin
 if p_audience not in ('group','admins','member') or (p_audience='member' and p_target_player_id is null) then raise exception 'GGC_INVALID_UPDATE_AUDIENCE'; end if;
 insert into public.ggc_group_updates(group_id,kind,title,body,options,created_by_player_id,audience,target_player_id,event_key,source_type)
 values(p_group_id,'announcement',left(btrim(p_title),120),left(btrim(coalesce(p_body,'')),4000),'[]'::jsonb,coalesce(p_actor,p_target_player_id,'system'),p_audience,p_target_player_id,p_event_key,'system')
 on conflict(event_key) where event_key is not null do nothing returning id into new_id;
 return new_id;
end $$;
revoke all on function private.ggc_insert_system_update(text,text,text,text,text,text,text) from public,anon,authenticated;

create or replace function public.ggc_publish_automatic_update(p_group_id text,p_event_key text,p_title text,p_body text default '',p_audience text default 'group',p_target_player_id text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare actor text;
begin
 actor:=private.ggc_current_player_id();
 if actor is null or (not private.ggc_updates_group_admin(p_group_id) and not (p_audience='member' and p_target_player_id=actor and p_event_key like 'scorecard-issue:%')) then raise exception 'GGC_GROUP_ADMIN_REQUIRED'; end if;
 if nullif(btrim(p_event_key),'') is null or char_length(p_event_key)>240 then raise exception 'GGC_INVALID_EVENT_KEY'; end if;
 return private.ggc_insert_system_update(p_group_id,p_event_key,p_title,p_body,p_audience,p_target_player_id,actor);
end $$;

create or replace function private.ggc_membership_update_event()
returns trigger language plpgsql security definer set search_path=''
as $$
declare actor text:=private.ggc_current_player_id(); player_name text; event_id text:=txid_current()::text;
begin
 select coalesce(data->>'name','A golfer') into player_name from public.ggc_records where kind='players' and record_id=coalesce(new.player_id,old.player_id) and not deleted;
 if tg_op='INSERT' then
  if new.role='member' then perform private.ggc_insert_system_update(new.group_id,'membership-join-'||new.group_id||'-'||new.player_id||'-'||event_id,player_name||' joined the Group','', 'admins',null,coalesce(actor,new.player_id)); end if;
  return new;
 elsif tg_op='UPDATE' and old.role is distinct from new.role then
  if new.role='owner' then
   perform private.ggc_insert_system_update(new.group_id,'membership-owner-'||new.group_id||'-'||new.player_id||'-'||event_id,'Group ownership transferred',player_name||' is now the Group Owner.','group',null,coalesce(actor,new.player_id));
   perform private.ggc_insert_system_update(new.group_id,'membership-owner-private-'||new.group_id||'-'||new.player_id||'-'||event_id,'You are now the Group Owner','You now have ownership of this Group.','member',new.player_id,coalesce(actor,new.player_id));
  elsif new.role='admin' and old.role='owner' then
   perform private.ggc_insert_system_update(new.group_id,'membership-owner-former-'||new.group_id||'-'||new.player_id||'-'||event_id,'Group ownership transferred','You remain a Group Admin.','member',new.player_id,coalesce(actor,new.player_id));
  elsif new.role='admin' and old.role='member' then
   perform private.ggc_insert_system_update(new.group_id,'membership-promote-'||new.group_id||'-'||new.player_id||'-'||event_id,player_name||' was promoted to Admin','', 'group',null,coalesce(actor,new.player_id));
   perform private.ggc_insert_system_update(new.group_id,'membership-promote-private-'||new.group_id||'-'||new.player_id||'-'||event_id,'You were promoted to Group Admin','You now have access to the Group administration controls.','member',new.player_id,coalesce(actor,new.player_id));
  elsif new.role='member' and old.role='admin' then
   perform private.ggc_insert_system_update(new.group_id,'membership-demote-'||new.group_id||'-'||new.player_id||'-'||event_id,'Your Group Admin access was removed','You remain a member of the Group.','member',new.player_id,coalesce(actor,new.player_id));
   perform private.ggc_insert_system_update(new.group_id,'membership-demote-admins-'||new.group_id||'-'||new.player_id||'-'||event_id,player_name||' is no longer a Group Admin','', 'admins',null,coalesce(actor,new.player_id));
  end if;
  return new;
 elsif tg_op='DELETE' then
  perform private.ggc_insert_system_update(old.group_id,'membership-remove-'||old.group_id||'-'||old.player_id||'-'||event_id,case when actor=old.player_id then player_name||' left the Group' else player_name||' was removed from the Group' end,'','admins',null,coalesce(actor,old.player_id));
  perform private.ggc_insert_system_update(old.group_id,'membership-remove-private-'||old.group_id||'-'||old.player_id||'-'||event_id,case when actor=old.player_id then 'You left the Group' else 'You were removed from the Group' end,'','member',old.player_id,coalesce(actor,old.player_id));
  return old;
 end if;
 return null;
end $$;
revoke all on function private.ggc_membership_update_event() from public,anon,authenticated;
drop trigger if exists ggc_membership_update_event on public.ggc_group_memberships;
create trigger ggc_membership_update_event after insert or update of role or delete on public.ggc_group_memberships for each row execute function private.ggc_membership_update_event();

create or replace function public.ggc_group_updates_feed()
returns table(id uuid,group_id text,kind text,title text,body text,options jsonb,closes_at timestamptz,created_by_player_id text,created_by_name text,created_at timestamptz,updated_at timestamptz,vote_counts jsonb,my_option_id text,is_read boolean)
language sql stable security definer set search_path=''
as $$
 with actor as (select private.ggc_current_player_id() player_id),
 allowed as (
  select u.* from public.ggc_group_updates u,actor a
  where u.deleted_at is null and (
   (u.audience='member' and u.target_player_id=a.player_id)
   or (u.audience='admins' and private.ggc_updates_group_admin(u.group_id))
   or (u.audience='group' and private.ggc_updates_group_member(u.group_id))
  )
 ), counts as (
  select v.update_id,jsonb_object_agg(v.option_id,v.total) vote_counts
  from (select update_id,option_id,count(*)::int total from public.ggc_group_update_votes group by update_id,option_id) v group by v.update_id
 )
 select u.id,u.group_id,u.kind,u.title,u.body,u.options,u.closes_at,u.created_by_player_id,
  case when u.source_type='system' then 'GGC' else coalesce(p.data->>'name','Group admin') end,u.created_at,u.updated_at,coalesce(c.vote_counts,'{}'::jsonb),mine.option_id,(r.update_id is not null)
 from allowed u cross join actor a
 left join public.ggc_records p on p.kind='players' and p.record_id=u.created_by_player_id and not p.deleted
 left join counts c on c.update_id=u.id
 left join public.ggc_group_update_votes mine on mine.update_id=u.id and mine.player_id=a.player_id
 left join public.ggc_group_update_reads r on r.update_id=u.id and r.player_id=a.player_id
 order by u.created_at desc limit 250
$$;

revoke all on function public.ggc_publish_automatic_update(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ggc_publish_automatic_update(text,text,text,text,text,text) to authenticated;
