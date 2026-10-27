-- Allow an ordinary Group member to join a competition and maintain only the
-- playing group that contains their own player identity. Competition setup,
-- other playing groups and pair definitions remain Admin/Owner only.

create or replace function private.ggc_can_update_record(
 p_kind text,p_id text,p_next jsonb,p_owner uuid
) returns boolean
 language plpgsql stable security definer
 set search_path = ''
as $function$
declare
 uid text:=auth.uid()::text;
 current_data jsonb;
 sid text;
 society jsonb;
 myplayerids text[];
 old_entries jsonb;
 new_entries jsonb;
 old_invites jsonb;
 new_invites jsonb;
 old_groups jsonb;
 new_groups jsonb;
 grp jsonb;
 player_ids jsonb;
begin
 if uid is null then return false; end if;
 select data into current_data
 from public.ggc_records
 where kind=p_kind and record_id=p_id and not deleted;
 if current_data is null then return false; end if;

 -- Existing Admin/Owner rules continue to authorise the full record.
 if private.ggc_record_access(p_kind,current_data,p_owner,true)
    and private.ggc_record_access(p_kind,p_next,p_owner,true) then
  return true;
 end if;
 if p_kind<>'comps' then return false; end if;
 if p_next->>'id' is distinct from p_id
    or p_next->>'societyId' is distinct from current_data->>'societyId' then
  return false;
 end if;

 sid:=current_data->>'societyId';
 select data into society from public.ggc_records
 where kind='societies' and record_id=sid and not deleted;
 if society is null then return false; end if;
 select coalesce(array_agg(record_id),array[]::text[]) into myplayerids
 from public.ggc_records
 where kind='players' and not deleted
   and (data->>'authUserId'=uid or record_id=uid);
 if not (coalesce(society->'members' ?| myplayerids,false)
         or coalesce(society->'members' ? uid,false)) then
  return false;
 end if;

 -- Members cannot change competition settings or pair definitions.
 if (current_data-array['entries','invites','roundGroups']::text[])
    is distinct from
    (p_next-array['entries','invites','roundGroups']::text[]) then
  return false;
 end if;

 old_entries:=case when jsonb_typeof(current_data->'entries')='array' then current_data->'entries' else '[]'::jsonb end;
 new_entries:=case when jsonb_typeof(p_next->'entries')='array' then p_next->'entries' else '[]'::jsonb end;
 -- Existing entrants cannot be removed; a member may add only their own ID.
 if exists(select 1 from jsonb_array_elements_text(old_entries) e where not new_entries ? e) then return false; end if;
 if exists(select 1 from jsonb_array_elements_text(new_entries) e where not old_entries ? e and not e=any(myplayerids)) then return false; end if;

 old_invites:=case when jsonb_typeof(current_data->'invites')='array' then current_data->'invites' else '[]'::jsonb end;
 new_invites:=case when jsonb_typeof(p_next->'invites')='array' then p_next->'invites' else '[]'::jsonb end;
 -- Joining may consume the caller's invitation but cannot edit anyone else's.
 if exists(select 1 from jsonb_array_elements_text(new_invites) e where not old_invites ? e) then return false; end if;
 if exists(select 1 from jsonb_array_elements_text(old_invites) e where not new_invites ? e and not e=any(myplayerids)) then return false; end if;

 old_groups:=case when jsonb_typeof(current_data->'roundGroups')='array' then current_data->'roundGroups' else '[]'::jsonb end;
 new_groups:=case when jsonb_typeof(p_next->'roundGroups')='array' then p_next->'roundGroups' else '[]'::jsonb end;

 -- A member must preserve every playing group that does not contain them.
 if exists(
  select 1 from jsonb_array_elements(old_groups) old_group
  where not coalesce(old_group->'playerIds' ?| myplayerids,false)
    and not exists(select 1 from jsonb_array_elements(new_groups) new_group where new_group=old_group)
 ) then return false; end if;

 -- Every new/changed group must contain the caller, contain 1-4 unique golfers,
 -- and reference golfers who belong to this Group.
 for grp in select value from jsonb_array_elements(new_groups)
 loop
  if exists(select 1 from jsonb_array_elements(old_groups) old_group where old_group=grp) then continue; end if;
  player_ids:=case when jsonb_typeof(grp->'playerIds')='array' then grp->'playerIds' else '[]'::jsonb end;
  if jsonb_array_length(player_ids) not between 1 and 4
     or not coalesce(player_ids ?| myplayerids,false)
     or (select count(*) from jsonb_array_elements_text(player_ids))
        <> (select count(distinct value) from jsonb_array_elements_text(player_ids)) then
   return false;
  end if;
  if exists(
   select 1 from jsonb_array_elements_text(player_ids) pid
   where not (coalesce(society->'members' ? pid,false)
              or coalesce(society->'admins' ? pid,false)
              or society->>'ownerId'=pid)
  ) then return false; end if;
 end loop;

 -- No golfer can be placed in two live groups in the same competition.
 if exists(
  select pid from jsonb_array_elements(new_groups) g
  cross join lateral jsonb_array_elements_text(case when jsonb_typeof(g->'playerIds')='array' then g->'playerIds' else '[]'::jsonb end) pid
  group by pid having count(*)>1
 ) then return false; end if;
 return true;
end $function$;

revoke all on function private.ggc_can_update_record(text,text,jsonb,uuid) from public,anon;
grant execute on function private.ggc_can_update_record(text,text,jsonb,uuid) to authenticated,service_role;

drop policy if exists ggc_records_authorized_update on public.ggc_records;
create policy ggc_records_authorized_update on public.ggc_records for update to authenticated
 using (private.ggc_can_update_record(kind,record_id,data,owner_id))
 with check (private.ggc_can_update_record(kind,record_id,data,owner_id));

create or replace function public.ggc_patch_record(
 p_kind text,p_id text,p_patch jsonb,p_fields text[],p_expected_version bigint,p_deleted boolean default false
) returns bigint
 language plpgsql
 set search_path to 'public'
as $function$
declare v_version bigint; v_data jsonb; v_next_data jsonb; v_owner uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_kind not in ('players','societies','comps','cards','leagues','courses','audit','societyInvites','appFields') then raise exception 'Invalid record type'; end if;
 if p_id is null or length(p_id) not between 1 and 256 then raise exception 'Invalid record ID'; end if;
 if p_expected_version is null then raise exception 'Expected version required'; end if;
 if jsonb_typeof(p_patch)<>'object' or p_fields is null then raise exception 'Invalid field patch'; end if;
 if 'id'=any(p_fields) or exists(select 1 from unnest(p_fields) as x(field_name) where not (p_patch ? field_name)) or exists(select 1 from jsonb_object_keys(p_patch) as x(field_name) where not (field_name=any(p_fields))) then raise exception 'Patch fields do not match payload'; end if;

 select r.data,r.owner_id,r.version into v_data,v_owner,v_version
 from public.ggc_records as r where r.kind=p_kind and r.record_id=p_id;
 if not found or v_version<>p_expected_version then raise exception 'GGC_VERSION_CONFLICT'; end if;
 v_next_data:=(v_data-p_fields)||p_patch;
 if v_next_data->>'id' is distinct from p_id then raise exception 'Invalid record ID'; end if;
 if not private.ggc_can_update_record(p_kind,p_id,v_next_data,v_owner) then raise exception 'GGC_ACCESS_DENIED'; end if;

 update public.ggc_records as r
 set data=v_next_data,deleted=p_deleted,version=r.version+1,updated_by=auth.uid(),updated_at=now()
 where r.kind=p_kind and r.record_id=p_id and r.version=p_expected_version
 returning r.version into v_version;
 if v_version is null then raise exception 'GGC_VERSION_CONFLICT'; end if;
 return v_version;
end $function$;

create or replace function public.ggc_save_record(
 p_kind text,p_id text,p_data jsonb,p_expected_version bigint,p_deleted boolean default false
) returns bigint
 language plpgsql
 set search_path to 'public'
as $function$
declare v_version bigint; v_old_data jsonb; v_owner uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_kind not in ('players','societies','comps','cards','leagues','courses','audit','societyInvites','appFields') then raise exception 'Invalid record type'; end if;
 if p_id is null or length(p_id) not between 1 and 256 or p_data->>'id' is distinct from p_id then raise exception 'Invalid record ID'; end if;
 if p_expected_version is null then
  if not private.ggc_can_write_record(p_kind,p_data,auth.uid()) then raise exception 'GGC_ACCESS_DENIED'; end if;
  insert into public.ggc_records(kind,record_id,data,deleted,updated_by,owner_id)
  values(p_kind,p_id,p_data,p_deleted,auth.uid(),auth.uid())
  on conflict do nothing returning version into v_version;
 else
  select data,owner_id into v_old_data,v_owner from public.ggc_records where kind=p_kind and record_id=p_id;
  if not found then raise exception 'GGC_VERSION_CONFLICT'; end if;
  if not private.ggc_can_update_record(p_kind,p_id,p_data,v_owner) then raise exception 'GGC_ACCESS_DENIED'; end if;
  update public.ggc_records set data=p_data,deleted=p_deleted,version=version+1,updated_by=auth.uid(),updated_at=now()
   where kind=p_kind and record_id=p_id and version=p_expected_version returning version into v_version;
 end if;
 if v_version is null then raise exception 'GGC_VERSION_CONFLICT'; end if;
 return v_version;
end $function$;

revoke execute on function public.ggc_patch_record(text,text,jsonb,text[],bigint,boolean) from public,anon;
grant execute on function public.ggc_patch_record(text,text,jsonb,text[],bigint,boolean) to authenticated;
revoke execute on function public.ggc_save_record(text,text,jsonb,bigint,boolean) from public,anon;
grant execute on function public.ggc_save_record(text,text,jsonb,bigint,boolean) to authenticated;
