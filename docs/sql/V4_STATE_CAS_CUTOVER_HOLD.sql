-- STAGED ONLY: apply at controlled cutover, never during shadow-mode rollout.
-- Blocks old client POST/PATCH to ggc_state; only authenticated CAS RPC may update.
-- Ensure public.ggc_state(id text primary key, payload jsonb, updated_at timestamptz) exists.
create or replace function public.ggc_save_state_cas(p_expected_revision timestamptz,p_payload jsonb)
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare v_revision timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_expected_revision is null or p_payload is null or jsonb_typeof(p_payload)<>'object'
 then raise exception 'Invalid state or revision' using errcode='22023'; end if;
 -- Reject missing/empty structural arrays before any write.
 if jsonb_typeof(p_payload->'players')<>'array'
 or jsonb_typeof(p_payload->'societies')<>'array'
 or jsonb_typeof(p_payload->'comps')<>'array'
 or jsonb_typeof(p_payload->'cards')<>'array'
 then raise exception 'Incomplete application state' using errcode='22023'; end if;
 update public.ggc_state
 set payload=p_payload,updated_at=clock_timestamp()
 where id='main' and updated_at=p_expected_revision
 returning updated_at into v_revision;
 if v_revision is null then raise exception 'State conflict: reload required' using errcode='40001'; end if;
 return v_revision;
end $$;
revoke all on function public.ggc_save_state_cas(timestamptz,jsonb) from public,anon;
grant execute on function public.ggc_save_state_cas(timestamptz,jsonb) to authenticated;
-- CUTOVER ENFORCEMENT: old app builds can no longer overwrite newer data.
revoke insert,update,delete on public.ggc_state from anon,authenticated;
