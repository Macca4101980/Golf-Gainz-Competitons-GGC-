-- Complete record-mode reads for group members without widening write access.
-- This private SECURITY DEFINER helper resolves a course's competition reference
-- without recursive RLS evaluation; it rejects unauthenticated callers.
create or replace function private.ggc_can_read_related_record(p_kind text,p_data jsonb,p_owner uuid)
 returns boolean language plpgsql stable security definer
 set search_path = ''
as $function$
begin
 if auth.uid() is null then return false; end if;
 if p_kind in ('leagues','audit','appFields') then
  return coalesce(private.ggc_record_access(p_kind,p_data,p_owner,false),false);
 end if;
 if p_kind='societyInvites' then
  return coalesce(private.ggc_record_access(p_kind,p_data,p_owner,true),false);
 end if;
 if p_kind='courses' then
  return exists (
   select 1 from public.ggc_records c
   where c.kind='comps' and not c.deleted
    and c.data->>'course'=p_data->>'id'
    and private.ggc_record_access('comps',c.data,c.owner_id,false)
  ) or exists (
   select 1 from public.ggc_records card
   where card.kind='cards' and not card.deleted
    and card.data->>'courseId'=p_data->>'id'
    and (card.owner_id=auth.uid() or private.ggc_record_access('cards',card.data,card.owner_id,false))
  );
 end if;
 return false;
end
$function$;
revoke all on function private.ggc_can_read_related_record(text,jsonb,uuid) from public,anon;
grant execute on function private.ggc_can_read_related_record(text,jsonb,uuid) to authenticated,service_role;

