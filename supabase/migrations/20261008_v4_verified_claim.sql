-- V4 stage 3: proof-backed, idempotent account claim.
-- Trusted service issues random opaque invite token; store ONLY SHA-256 digest.
create extension if not exists pgcrypto;
create table if not exists public.ggc_claim_invites (
 id uuid primary key default gen_random_uuid(),
 placeholder_id text not null references public.ggc_golfers(id),
 token_digest text not null unique,
 intended_email text,
 expires_at timestamptz not null,
 consumed_at timestamptz,
 consumed_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.ggc_claim_invites enable row level security;
-- No direct client table policies. Issue tokens only from trusted server code.
create or replace function public.ggc_claim_golfer(p_placeholder_id text,p_token text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_user uuid := auth.uid();
 v_canonical text;
 v_inv public.ggc_claim_invites%rowtype;
 v_placeholder public.ggc_golfers%rowtype;
 v_email text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_token is null or length(p_token)<32 then raise exception 'Invalid claim token'; end if;
 select id into v_canonical from public.ggc_golfers
 where auth_user_id=v_user and placeholder=false order by created_at limit 1;
 if v_canonical is null then raise exception 'Registered golfer required'; end if;
 select * into v_inv from public.ggc_claim_invites
 where placeholder_id=p_placeholder_id and token_digest=encode(digest(p_token,'sha256'),'hex')
 for update;
 if not found then raise exception 'Invalid claim token'; end if;
 if v_inv.consumed_at is not null then
   if v_inv.consumed_by=v_user and exists(select 1 from public.ggc_identity_links where old_golfer_id=p_placeholder_id and canonical_golfer_id=v_canonical) then return v_canonical; end if;
   raise exception 'Claim already used';
 end if;
 if v_inv.expires_at<=now() then raise exception 'Claim expired'; end if;
 select lower(email) into v_email from auth.users where id=v_user and email_confirmed_at is not null;
 if v_email is null then raise exception 'Verified email required'; end if;
 if v_inv.intended_email is not null and lower(v_inv.intended_email)<>v_email then raise exception 'Invite email mismatch'; end if;
 select * into v_placeholder from public.ggc_golfers where id=p_placeholder_id for update;
 if not found or not v_placeholder.placeholder or v_placeholder.auth_user_id is not null then raise exception 'Placeholder not claimable'; end if;
 insert into public.ggc_identity_links(old_golfer_id,canonical_golfer_id) values(p_placeholder_id,v_canonical)
 on conflict(old_golfer_id) do nothing;
 if not exists(select 1 from public.ggc_identity_links where old_golfer_id=p_placeholder_id and canonical_golfer_id=v_canonical) then raise exception 'Already linked to different account'; end if;
 insert into public.ggc_memberships(group_id,golfer_id,role,status,joined_at)
 select group_id,v_canonical,role,status,joined_at from public.ggc_memberships where golfer_id=p_placeholder_id
 on conflict(group_id,golfer_id) do update set
 status=case when public.ggc_memberships.status='member' or excluded.status='member' then 'member' else public.ggc_memberships.status end,
 role=case when public.ggc_memberships.role='owner' or excluded.role='owner' then 'owner' when public.ggc_memberships.role='admin' or excluded.role='admin' then 'admin' else 'member' end;
 -- Historical placeholder memberships remain for legacy scores; readers resolve identity link.
 update public.ggc_claim_invites set consumed_at=now(),consumed_by=v_user where id=v_inv.id;
 return v_canonical;
end $$;
revoke all on function public.ggc_claim_golfer(text,text) from public,anon;
grant execute on function public.ggc_claim_golfer(text,text) to authenticated;
