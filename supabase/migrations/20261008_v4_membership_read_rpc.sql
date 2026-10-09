-- Stage 6: authenticated, read-only view of canonical memberships.
-- Safe only after backfill; no broad table SELECT grants.
create or replace function public.ggc_my_memberships_v4()
returns table(group_id text,golfer_id text,role text,status text)
language sql stable security definer set search_path=public,pg_temp
as $$
 select m.group_id,m.golfer_id,m.role,m.status
 from public.ggc_memberships m
 join public.ggc_golfers p on p.id=m.golfer_id
 where auth.uid() is not null and p.auth_user_id=auth.uid() and p.placeholder=false
   and m.status='member';
$$;
revoke all on function public.ggc_my_memberships_v4() from public,anon;
grant execute on function public.ggc_my_memberships_v4() to authenticated;
