-- Qualify the delivery uniqueness target so PL/pgSQL output-column variables
-- cannot collide with the table column names during a queue flush.
create or replace function public.ggc_claim_push_deliveries(p_limit int default 100)
returns table(delivery_id uuid,subscription_id uuid,subscription jsonb,update_id uuid,title text,body text,url text)
language plpgsql security definer set search_path=''
as $$
begin
 insert into public.ggc_push_deliveries(update_id,subscription_id)
 select u.id,s.id from public.ggc_group_updates u
 join public.ggc_push_subscriptions s on s.enabled and s.player_id<>u.created_by_player_id and (
  (u.audience='member' and s.player_id=u.target_player_id)
  or (u.audience='group' and exists(select 1 from public.ggc_group_memberships m where m.group_id=u.group_id and m.player_id=s.player_id))
  or (u.audience='admins' and exists(select 1 from public.ggc_group_memberships m where m.group_id=u.group_id and m.player_id=s.player_id and m.role in('owner','admin')))
 )
 where u.deleted_at is null and u.created_at>now()-interval '7 days'
 on conflict on constraint ggc_push_deliveries_update_id_subscription_id_key do nothing;
 return query
 with picked as (
  select d.id from public.ggc_push_deliveries d where d.status='pending' or (d.status='processing' and d.attempted_at<now()-interval '5 minutes') order by d.id limit greatest(1,least(p_limit,500)) for update skip locked
 ),claimed as (
  update public.ggc_push_deliveries d set status='processing',attempts=d.attempts+1,attempted_at=now() from picked where d.id=picked.id returning d.*
 )
 select d.id,s.id,s.subscription,u.id,u.title,u.body,'/?tab=updates&update='||u.id::text
 from claimed d join public.ggc_push_subscriptions s on s.id=d.subscription_id join public.ggc_group_updates u on u.id=d.update_id;
end $$;

revoke all on function public.ggc_claim_push_deliveries(int) from public,anon,authenticated;
grant execute on function public.ggc_claim_push_deliveries(int) to service_role;
