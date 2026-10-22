-- Keep the authoritative membership table and the society record presented to
-- clients in the same transaction. This prevents a device refresh from
-- restoring stale members/admins/ownerId after a group action succeeds.
create or replace function private.ggc_sync_group_record(p_group_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_members jsonb;
  v_admins jsonb;
  v_owner text;
  v_group jsonb;
  v_version bigint;
begin
  select
    coalesce(jsonb_agg(m.player_id order by m.joined_at, m.player_id), '[]'::jsonb),
    coalesce(jsonb_agg(m.player_id order by m.joined_at, m.player_id)
      filter (where m.role in ('owner', 'admin')), '[]'::jsonb),
    max(m.player_id) filter (where m.role = 'owner')
  into v_members, v_admins, v_owner
  from public.ggc_group_memberships m
  where m.group_id = p_group_id;

  update public.ggc_records r
  set data = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(r.data, '{members}', v_members, true),
            '{admins}', v_admins, true
          ),
          '{ownerId}', coalesce(to_jsonb(v_owner), 'null'::jsonb), true
        ),
        '{updatedAt}', to_jsonb(to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), true
      ),
      version = r.version + 1,
      updated_by = auth.uid(),
      updated_at = now()
  where r.kind = 'societies'
    and r.record_id = p_group_id
    and not r.deleted
  returning r.data, r.version into v_group, v_version;

  if v_group is null then raise exception 'GGC_GROUP_NOT_FOUND'; end if;
  return jsonb_build_object('group', v_group, 'version', v_version);
end;
$function$;

revoke all on function private.ggc_sync_group_record(text) from public, anon, authenticated;
grant execute on function private.ggc_sync_group_record(text) to service_role;

create or replace function public.ggc_group_initialize(p_group_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare v_actor text; v_group jsonb; v_sync jsonb;
begin
  if auth.uid() is null then raise exception 'GGC_SIGN_IN_REQUIRED'; end if;
  v_actor := public.ggc_group_my_player_id();
  if v_actor is null then raise exception 'GGC_GOLFER_IDENTITY_REQUIRED'; end if;
  select data into v_group from public.ggc_records
   where kind='societies' and record_id=p_group_id and not deleted for update;
  if v_group is null then raise exception 'GGC_GROUP_NOT_FOUND'; end if;
  if v_group->>'ownerId' is distinct from v_actor then raise exception 'GGC_GROUP_OWNER_REQUIRED'; end if;
  insert into public.ggc_group_memberships(group_id,player_id,role)
   values(p_group_id,v_actor,'owner')
   on conflict(group_id,player_id) do update set role='owner',updated_at=now();
  v_sync := private.ggc_sync_group_record(p_group_id);
  return jsonb_build_object('ok',true,'group_id',p_group_id)||v_sync;
end;
$function$;

create or replace function public.ggc_group_set_admin(p_group_id text, p_player_id text, p_is_admin boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare v_actor text; v_target_role text; v_sync jsonb;
begin
  if auth.uid() is null then raise exception 'GGC_SIGN_IN_REQUIRED'; end if;
  v_actor := public.ggc_group_my_player_id();
  if not exists(select 1 from public.ggc_group_memberships where group_id=p_group_id and player_id=v_actor and role='owner')
   then raise exception 'GGC_GROUP_OWNER_REQUIRED'; end if;
  select role into v_target_role from public.ggc_group_memberships
   where group_id=p_group_id and player_id=p_player_id for update;
  if v_target_role is null then return jsonb_build_object('ok',false,'reason','not_member'); end if;
  if v_target_role='owner' then return jsonb_build_object('ok',false,'reason','owner_role_fixed'); end if;
  update public.ggc_group_memberships
   set role=case when p_is_admin then 'admin' else 'member' end,updated_at=now()
   where group_id=p_group_id and player_id=p_player_id;
  v_sync := private.ggc_sync_group_record(p_group_id);
  return jsonb_build_object('ok',true,'group_id',p_group_id,'player_id',p_player_id)||v_sync;
end;
$function$;

create or replace function public.ggc_group_transfer_owner(p_group_id text, p_player_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare v_actor text; v_sync jsonb;
begin
  if auth.uid() is null then raise exception 'GGC_SIGN_IN_REQUIRED'; end if;
  v_actor := public.ggc_group_my_player_id();
  if not exists(select 1 from public.ggc_group_memberships where group_id=p_group_id and player_id=v_actor and role='owner')
   then raise exception 'GGC_GROUP_OWNER_REQUIRED'; end if;
  if not exists(select 1 from public.ggc_group_memberships where group_id=p_group_id and player_id=p_player_id)
   then return jsonb_build_object('ok',false,'reason','not_member'); end if;
  if p_player_id=v_actor then return jsonb_build_object('ok',true,'already_owner',true); end if;
  update public.ggc_group_memberships set role='admin',updated_at=now()
   where group_id=p_group_id and player_id=v_actor;
  update public.ggc_group_memberships set role='owner',updated_at=now()
   where group_id=p_group_id and player_id=p_player_id;
  v_sync := private.ggc_sync_group_record(p_group_id);
  return jsonb_build_object('ok',true,'group_id',p_group_id,'player_id',p_player_id)||v_sync;
end;
$function$;

create or replace function public.ggc_group_claim_owner(p_group_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare v_actor text; v_sync jsonb;
begin
  if auth.uid() is null then raise exception 'GGC_SIGN_IN_REQUIRED'; end if;
  v_actor := public.ggc_group_my_player_id();
  if not exists(select 1 from public.ggc_group_memberships where group_id=p_group_id and player_id=v_actor)
   then return jsonb_build_object('ok',false,'reason','not_member'); end if;
  if exists(select 1 from public.ggc_group_memberships where group_id=p_group_id and role='owner')
   then return jsonb_build_object('ok',false,'reason','already_has_owner'); end if;
  update public.ggc_group_memberships set role='owner',updated_at=now()
   where group_id=p_group_id and player_id=v_actor;
  v_sync := private.ggc_sync_group_record(p_group_id);
  return jsonb_build_object('ok',true,'group_id',p_group_id)||v_sync;
end;
$function$;

create or replace function public.ggc_group_remove_member(p_group_id text, p_player_id text)
returns jsonb language plpgsql security definer set search_path to 'public','private','pg_temp' as $function$
declare v_actor text; v_actor_role text; v_target_role text; v_sync jsonb;
begin
  if auth.uid() is null then raise exception 'GGC_SIGN_IN_REQUIRED'; end if;
  v_actor:=public.ggc_group_my_player_id();
  select role into v_actor_role from public.ggc_group_memberships where group_id=p_group_id and player_id=v_actor;
  if v_actor_role is null or v_actor_role not in ('owner','admin') then return jsonb_build_object('ok',false,'reason','not_authorized'); end if;
  select role into v_target_role from public.ggc_group_memberships where group_id=p_group_id and player_id=p_player_id for update;
  if v_target_role is null then return jsonb_build_object('ok',false,'reason','not_member'); end if;
  if v_target_role='owner' then return jsonb_build_object('ok',false,'reason','owner_must_transfer'); end if;
  if v_target_role='admin' and v_actor_role<>'owner' then return jsonb_build_object('ok',false,'reason','not_authorized'); end if;
  delete from public.ggc_group_memberships where group_id=p_group_id and player_id=p_player_id;
  v_sync:=private.ggc_sync_group_record(p_group_id);
  return jsonb_build_object('ok',true,'group_id',p_group_id,'player_id',p_player_id)||v_sync;
end;
$function$;

create or replace function public.ggc_group_leave(p_group_id text)
returns jsonb language plpgsql security definer set search_path to 'public','private','pg_temp' as $function$
declare v_actor text; v_role text; v_sync jsonb;
begin
  if auth.uid() is null then raise exception 'GGC_SIGN_IN_REQUIRED'; end if;
  v_actor:=public.ggc_group_my_player_id();
  select role into v_role from public.ggc_group_memberships where group_id=p_group_id and player_id=v_actor for update;
  if v_role is null then return jsonb_build_object('ok',false,'reason','not_member'); end if;
  if v_role='owner' then return jsonb_build_object('ok',false,'reason','owner_must_transfer'); end if;
  delete from public.ggc_group_memberships where group_id=p_group_id and player_id=v_actor;
  v_sync:=private.ggc_sync_group_record(p_group_id);
  return jsonb_build_object('ok',true,'group_id',p_group_id,'player_id',v_actor)||v_sync;
end;
$function$;

create or replace function public.ggc_group_add_temporary_golfer(p_group_id text,p_player_id text)
returns jsonb language plpgsql security definer set search_path to 'public','private','pg_temp' as $function$
declare v_actor text; v_player jsonb; v_sync jsonb;
begin
  if auth.uid() is null then raise exception 'GGC_SIGN_IN_REQUIRED'; end if;
  v_actor:=public.ggc_group_my_player_id();
  if not exists(select 1 from public.ggc_group_memberships where group_id=p_group_id and player_id=v_actor and role in ('owner','admin'))
   then raise exception 'GGC_GROUP_ADMIN_REQUIRED'; end if;
  select data into v_player from public.ggc_records where kind='players' and record_id=p_player_id and not deleted;
  if v_player is null then raise exception 'GGC_GOLFER_NOT_SAVED'; end if;
  if coalesce((v_player->>'unclaimed')::boolean,false) is distinct from true or nullif(v_player->>'authUserId','') is not null or v_player->>'createdBy' is distinct from v_actor
   then raise exception 'GGC_NOT_YOUR_TEMPORARY_GOLFER'; end if;
  insert into public.ggc_group_memberships(group_id,player_id,role) values(p_group_id,p_player_id,'member')
   on conflict(group_id,player_id) do nothing;
  v_sync:=private.ggc_sync_group_record(p_group_id);
  return jsonb_build_object('ok',true,'group_id',p_group_id,'player_id',p_player_id)||v_sync;
end;
$function$;

create or replace function public.ggc_group_join_code(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public','private','pg_temp' as $function$
declare v_group record; v_actor text; v_existing text; v_sync jsonb;
begin
  if auth.uid() is null then raise exception 'GGC_SIGN_IN_REQUIRED'; end if;
  v_actor:=public.ggc_group_my_player_id();
  if v_actor is null then raise exception 'GGC_GOLFER_IDENTITY_REQUIRED'; end if;
  select record_id,data into v_group from public.ggc_records where kind='societies' and not deleted
   and upper(data->>'code')=upper(trim(coalesce(p_code,''))) limit 1 for update;
  if not found then return jsonb_build_object('ok',false,'reason','code_not_found'); end if;
  select role into v_existing from public.ggc_group_memberships where group_id=v_group.record_id and player_id=v_actor;
  insert into public.ggc_group_memberships(group_id,player_id,role) values(v_group.record_id,v_actor,'member')
   on conflict(group_id,player_id) do nothing;
  v_sync:=private.ggc_sync_group_record(v_group.record_id);
  return jsonb_build_object('ok',true,'group_id',v_group.record_id,'already_member',v_existing is not null)||v_sync;
end;
$function$;

create or replace function public.ggc_group_respond_invitation(p_invitation_id uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path to 'public','private','pg_temp' as $function$
declare v_inv record; v_actor text; v_sync jsonb:='{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'GGC_SIGN_IN_REQUIRED'; end if;
  v_actor:=public.ggc_group_my_player_id();
  select * into v_inv from public.ggc_group_invitations_v2 where id=p_invitation_id for update;
  if not found or v_inv.invited_player_id<>v_actor then raise exception 'GGC_INVITATION_NOT_FOUND'; end if;
  if v_inv.status<>'pending' then return jsonb_build_object('ok',false,'reason','already_responded'); end if;
  if p_accept then
    insert into public.ggc_group_memberships(group_id,player_id,role) values(v_inv.group_id,v_actor,'member')
     on conflict(group_id,player_id) do nothing;
    v_sync:=private.ggc_sync_group_record(v_inv.group_id);
  end if;
  update public.ggc_group_invitations_v2 set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now()
   where id=p_invitation_id;
  return jsonb_build_object('ok',true,'accepted',p_accept,'group_id',v_inv.group_id)||v_sync;
end;
$function$;

revoke execute on function public.ggc_group_initialize(text) from public, anon;
revoke execute on function public.ggc_group_set_admin(text,text,boolean) from public, anon;
revoke execute on function public.ggc_group_transfer_owner(text,text) from public, anon;
revoke execute on function public.ggc_group_claim_owner(text) from public, anon;
revoke execute on function public.ggc_group_remove_member(text,text) from public, anon;
revoke execute on function public.ggc_group_leave(text) from public, anon;
revoke execute on function public.ggc_group_add_temporary_golfer(text,text) from public, anon;
revoke execute on function public.ggc_group_join_code(text) from public, anon;
revoke execute on function public.ggc_group_respond_invitation(uuid,boolean) from public, anon;
grant execute on function public.ggc_group_initialize(text) to authenticated, service_role;
grant execute on function public.ggc_group_set_admin(text,text,boolean) to authenticated, service_role;
grant execute on function public.ggc_group_transfer_owner(text,text) to authenticated, service_role;
grant execute on function public.ggc_group_claim_owner(text) to authenticated, service_role;
grant execute on function public.ggc_group_remove_member(text,text) to authenticated, service_role;
grant execute on function public.ggc_group_leave(text) to authenticated, service_role;
grant execute on function public.ggc_group_add_temporary_golfer(text,text) to authenticated, service_role;
grant execute on function public.ggc_group_join_code(text) to authenticated, service_role;
grant execute on function public.ggc_group_respond_invitation(uuid,boolean) to authenticated, service_role;
