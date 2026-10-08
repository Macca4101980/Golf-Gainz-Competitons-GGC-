-- Transactional claim. Requires authenticated session; no name-based matching.
create or replace function public.ggc_claim_golfer(p_placeholder_id text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid(); v_canonical text; v_placeholder public.ggc_golfers%rowtype;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select id into v_canonical from public.ggc_golfers
 where auth_user_id=v_user and placeholder=false order by created_at limit 1;
 if v_canonical is null then raise exception 'Registered golfer profile required'; end if;
 select * into v_placeholder from public.ggc_golfers where id=p_placeholder_id for update;
 if not found then raise exception 'Placeholder not found'; end if;
 if v_placeholder.id=v_canonical then return v_canonical; end if;
 if exists(select 1 from public.ggc_identity_links where old_golfer_id=p_placeholder_id and canonical_golfer_id=v_canonical) then return v_canonical; end if;
 if not v_placeholder.placeholder or v_placeholder.auth_user_id is not null then raise exception 'Golfer already claimed'; end if;
 -- Identity proof must be verified by a trusted server-side invite/claim endpoint before calling.
 -- This function deliberately refuses arbitrary claims until proof validation is implemented.
 raise exception 'Claim verification not configured';
end $$;
revoke all on function public.ggc_claim_golfer(text) from public, anon, authenticated;
-- Grant only after adding server-side invite proof verification.
