-- Add narrowly scoped records for app fields that are not part of an entity
-- collection. Personal fields are private to the signed-in account; society
-- fields are visible to members and writable only by society admins.
alter table public.ggc_records drop constraint if exists ggc_records_kind_check;
alter table public.ggc_records add constraint ggc_records_kind_check
 check (kind = any (array['players','societies','comps','cards','leagues','courses','audit','societyInvites','appFields']::text[]));

-- Seed the versioned store from the current live snapshot before enabling the
-- field-write client. Existing versioned rows always win; this migration only
-- fills rows that do not exist yet.
insert into public.ggc_records(kind,record_id,data,deleted)
select source.kind, item->>'id', item, false
from public.ggc_state snapshot
cross join lateral (values
 ('players'),('societies'),('comps'),('cards'),('leagues'),('courses'),('audit'),('societyInvites')
) as source(kind)
cross join lateral jsonb_array_elements(
 case when jsonb_typeof(snapshot.payload->source.kind)='array'
      then snapshot.payload->source.kind else '[]'::jsonb end
) item
where snapshot.id='main' and item->>'id' is not null
on conflict (kind,record_id) do nothing;

-- Carry legacy deletion markers forward as tombstones so a stale device cannot
-- resurrect a deleted row after the snapshot store is retired.
insert into public.ggc_records(kind,record_id,data,deleted)
select source.kind, deleted_id, jsonb_build_object('id',deleted_id), true
from public.ggc_state snapshot
cross join lateral (values
 ('comps','deletedCompIds'),('societies','deletedSocietyIds'),
 ('leagues','deletedLeagueIds'),('courses','deletedCourseIds')
) as source(kind,field)
cross join lateral jsonb_array_elements_text(
 case when jsonb_typeof(snapshot.payload->source.field)='array'
      then snapshot.payload->source.field else '[]'::jsonb end
) as tombstone(deleted_id)
where snapshot.id='main' and deleted_id is not null
on conflict (kind,record_id) do nothing;

create or replace function public.ggc_save_record(
 p_kind text,p_id text,p_data jsonb,p_expected_version bigint,p_deleted boolean default false
) returns bigint
 language plpgsql
 set search_path to 'public'
as $function$
declare v_version bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_kind not in ('players','societies','comps','cards','leagues','courses','audit','societyInvites','appFields') then raise exception 'Invalid record type'; end if;
 if p_id is null or length(p_id) not between 1 and 256 or p_data->>'id' is distinct from p_id then raise exception 'Invalid record ID'; end if;
 if p_expected_version is null then
  insert into public.ggc_records(kind,record_id,data,deleted,updated_by,owner_id)
  values(p_kind,p_id,p_data,p_deleted,auth.uid(),auth.uid())
  on conflict do nothing returning version into v_version;
 else
  update public.ggc_records set data=p_data,deleted=p_deleted,version=version+1,updated_by=auth.uid(),updated_at=now()
  where kind=p_kind and record_id=p_id and version=p_expected_version returning version into v_version;
 end if;
 if v_version is null then raise exception 'GGC_VERSION_CONFLICT'; end if;
 return v_version;
end $function$;

-- Existing record edits apply only the fields changed on this device. The
-- expected version still rejects stale edits so the client can merge unrelated
-- fields and ask for review when the same field changed on two devices.
create or replace function public.ggc_patch_record(
 p_kind text,p_id text,p_patch jsonb,p_fields text[],p_expected_version bigint,p_deleted boolean default false
) returns bigint
 language plpgsql
 set search_path to 'public'
as $function$
declare v_version bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_kind not in ('players','societies','comps','cards','leagues','courses','audit','societyInvites','appFields') then raise exception 'Invalid record type'; end if;
 if p_id is null or length(p_id) not between 1 and 256 then raise exception 'Invalid record ID'; end if;
 if p_expected_version is null then raise exception 'Expected version required'; end if;
 if jsonb_typeof(p_patch)<>'object' or p_fields is null then raise exception 'Invalid field patch'; end if;
 if 'id'=any(p_fields) or exists(select 1 from unnest(p_fields) as x(field_name) where not (p_patch ? field_name)) or exists(select 1 from jsonb_object_keys(p_patch) as x(field_name) where not (field_name=any(p_fields))) then raise exception 'Patch fields do not match payload'; end if;
 update public.ggc_records as r
 set data=(r.data-p_fields)||p_patch,deleted=p_deleted,version=r.version+1,updated_by=auth.uid(),updated_at=now()
 where r.kind=p_kind and r.record_id=p_id and r.version=p_expected_version
 returning r.version into v_version;
 if v_version is null then raise exception 'GGC_VERSION_CONFLICT'; end if;
 return v_version;
end $function$;

revoke execute on function public.ggc_patch_record(text,text,jsonb,text[],bigint,boolean) from public,anon;
grant execute on function public.ggc_patch_record(text,text,jsonb,text[],bigint,boolean) to authenticated;

create or replace function public.ggc_record_access(p_kind text,p_data jsonb,p_owner uuid,p_write boolean default false)
 returns boolean
 language plpgsql stable security definer
 set search_path to 'public'
as $function$
declare uid text; sid text; actor text; society jsonb; member boolean; admin boolean; own boolean; myplayerids text[];
begin
 uid:=auth.uid()::text;
 if uid is null then return false; end if;
 own:=p_owner::text=uid;
 if p_kind='appFields' then
  if p_data->>'scope'='user' then
   return p_data->>'userId'=uid and own;
  end if;
  if p_data->>'scope'<>'society' then return false; end if;
  sid:=p_data->>'societyId';
  if sid is null then return false; end if;
  select data into society from public.ggc_records where kind='societies' and record_id=sid and not deleted;
  if society is null then return false; end if;
  select coalesce(array_agg(record_id),array[]::text[]) into myplayerids from public.ggc_records
   where kind='players' and not deleted and (data->>'authUserId'=uid or record_id=uid);
  member:=coalesce(society->'members' ?| myplayerids,false) or coalesce(society->'members' ? uid,false);
  admin:=coalesce(society->'admins' ?| myplayerids,false) or coalesce(society->'admins' ? uid,false) or society->>'ownerId'=uid or society->>'ownerId'=any(myplayerids);
  return case when p_write then admin else member or admin end;
 end if;
 select coalesce(array_agg(record_id),array[]::text[]) into myplayerids from public.ggc_records
  where kind='players' and not deleted and (data->>'authUserId'=uid or record_id=uid);
 if p_kind='courses' then return not p_write or own; end if;
 if p_kind='players' then
  if p_data->>'authUserId'=uid or p_data->>'id'=uid then return true; end if;
  if p_write then
   if nullif(p_data->>'authUserId','') is not null then return false; end if;
   if exists (
    select 1 from public.ggc_records s where s.kind='societies' and not s.deleted
    and s.data->'members' ? (p_data->>'id')
    and (s.data->'admins' ?| myplayerids or s.data->'admins' ? uid
         or s.data->>'ownerId'=uid or s.data->>'ownerId'=any(myplayerids))
   ) then return true; end if;
   return own and (p_data->>'createdBy'=uid or p_data->>'createdBy'=any(myplayerids))
    and (coalesce(p_data->>'unclaimed','false')='true' or coalesce(p_data->>'placeholder','false')='true' or coalesce(p_data->>'guest','false')='true')
    and exists (select 1 from public.ggc_records s where s.kind='societies' and not s.deleted
     and (s.data->'admins' ?| myplayerids or s.data->'admins' ? uid or s.data->>'ownerId'=uid or s.data->>'ownerId'=any(myplayerids)));
  end if;
  return exists (select 1 from public.ggc_records s where s.kind='societies' and not s.deleted
   and s.data->'members' ? (p_data->>'id')
   and (s.data->'members' ?| myplayerids or s.data->'admins' ?| myplayerids or s.data->'members' ? uid or s.data->'admins' ? uid or s.data->>'ownerId'=uid));
 end if;
 sid:=case when p_kind='societies' then p_data->>'id' else p_data->>'societyId' end;
 if sid is null then return own and p_kind<>'cards'; end if;
 if p_kind='societies' then society:=p_data;
 else select data into society from public.ggc_records where kind='societies' and record_id=sid and not deleted; end if;
 if society is null then return false; end if;
 member:=coalesce(society->'members' ?| myplayerids,false) or coalesce(society->'members' ? uid,false);
 admin:=coalesce(society->'admins' ?| myplayerids,false) or coalesce(society->'admins' ? uid,false) or society->>'ownerId'=uid or society->>'ownerId'=any(myplayerids);
 if p_kind='audit' then
  actor:=p_data->>'editedById';
  if p_write then return admin or (member and (actor=uid or actor=any(myplayerids))); end if;
  return member or admin;
 end if;
 if p_kind='cards' then
  actor:=p_data->>'playerId';
  if p_write then return admin or (member and (actor=uid or actor=any(myplayerids) or exists (
   select 1 from public.ggc_records comp where comp.kind='comps' and not comp.deleted and comp.record_id=p_data->>'compId' and comp.data->>'societyId'=sid
   and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(comp.data->'roundGroups')='array' then comp.data->'roundGroups' else '[]'::jsonb end) grp
    where (grp->'playerIds') ? actor and ((grp->'playerIds') ? uid or (grp->'playerIds') ?| myplayerids))))); end if;
  return member or admin or actor=uid or actor=any(myplayerids);
 end if;
 if p_write then return admin; end if;
 return member or admin;
end $function$;
