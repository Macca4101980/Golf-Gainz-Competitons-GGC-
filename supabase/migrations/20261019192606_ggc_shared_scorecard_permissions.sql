-- Beta 6: permit a golfer in the same live round to patch another participant's
-- scorecard, while preserving the row's existing ownership and group checks.

-- The helper reads group and round membership across RLS-protected records.
-- Keep that capability scoped to authenticated callers; it rejects null auth.uid().
revoke execute on function public.ggc_record_access(text,jsonb,uuid,boolean) from public, anon;
grant execute on function public.ggc_record_access(text,jsonb,uuid,boolean) to authenticated, service_role;

drop policy if exists ggc_records_owner_insert on public.ggc_records;
create policy ggc_records_owner_insert on public.ggc_records
 for insert to authenticated
 with check (
  owner_id = (select auth.uid())
  and (kind <> 'cards' or (select public.ggc_record_access(kind,data,owner_id,true)))
 );

drop policy if exists ggc_records_owner_update on public.ggc_records;
create policy ggc_records_authorized_update on public.ggc_records
 for update to authenticated
 using (
  owner_id = (select auth.uid())
  or (select public.ggc_record_access(kind,data,owner_id,true))
 )
 with check (
  owner_id = (select auth.uid())
  or (select public.ggc_record_access(kind,data,owner_id,true))
 );

-- A collaborator may update a shared card, but cannot silently transfer its
-- record ownership or detach the JSON identity from the indexed record ID.
create or replace function public.ggc_preserve_record_identity()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
 if new.owner_id is distinct from old.owner_id then
  raise exception 'GGC_RECORD_OWNER_IMMUTABLE';
 end if;
 if new.kind is distinct from old.kind or new.record_id is distinct from old.record_id then
  raise exception 'GGC_RECORD_IDENTITY_IMMUTABLE';
 end if;
 if new.data->>'id' is distinct from new.record_id then
  raise exception 'Invalid record ID';
 end if;
 return new;
end $function$;

drop trigger if exists ggc_preserve_record_identity on public.ggc_records;
create trigger ggc_preserve_record_identity
 before update on public.ggc_records
 for each row execute function public.ggc_preserve_record_identity();

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
 from public.ggc_records as r
 where r.kind=p_kind and r.record_id=p_id;
 if not found or v_version<>p_expected_version then raise exception 'GGC_VERSION_CONFLICT'; end if;
 if v_owner<>(select auth.uid())
    and not public.ggc_record_access(p_kind,v_data,v_owner,true) then
  raise exception 'GGC_ACCESS_DENIED';
 end if;

 v_next_data:=(v_data-p_fields)||p_patch;
 if v_next_data->>'id' is distinct from p_id then raise exception 'Invalid record ID'; end if;
 if v_owner<>(select auth.uid())
    and not public.ggc_record_access(p_kind,v_next_data,v_owner,true) then
  raise exception 'GGC_ACCESS_DENIED';
 end if;

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
  if p_kind='cards' and not public.ggc_record_access(p_kind,p_data,auth.uid(),true) then
   raise exception 'GGC_ACCESS_DENIED';
  end if;
  insert into public.ggc_records(kind,record_id,data,deleted,updated_by,owner_id)
  values(p_kind,p_id,p_data,p_deleted,auth.uid(),auth.uid())
  on conflict do nothing returning version into v_version;
 else
  select data,owner_id into v_old_data,v_owner from public.ggc_records
   where kind=p_kind and record_id=p_id for update;
  if not found then raise exception 'GGC_VERSION_CONFLICT'; end if;
  if v_owner<>(select auth.uid()) then
   if not public.ggc_record_access(p_kind,v_old_data,v_owner,true)
      or not public.ggc_record_access(p_kind,p_data,v_owner,true) then
    raise exception 'GGC_ACCESS_DENIED';
   end if;
  end if;
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
