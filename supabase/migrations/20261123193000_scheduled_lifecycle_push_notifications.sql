-- Generate competition lifecycle updates and deliver them even when every GGC client is closed.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
 if not exists(select 1 from vault.secrets where name='ggc_scheduler_secret') then
  perform vault.create_secret(encode(gen_random_bytes(32),'hex'),'ggc_scheduler_secret','GGC lifecycle push scheduler credential');
 end if;
end $$;

create or replace function public.ggc_scheduler_secret()
returns text
language sql stable security definer set search_path=''
as $$
 select decrypted_secret from vault.decrypted_secrets where name='ggc_scheduler_secret' order by created_at desc limit 1
$$;
revoke all on function public.ggc_scheduler_secret() from public,anon,authenticated;
grant execute on function public.ggc_scheduler_secret() to service_role;

create or replace function private.ggc_safe_timestamptz(p_value text)
returns timestamptz
language plpgsql immutable set search_path=''
as $$
begin
 return nullif(p_value,'')::timestamptz;
exception when others then
 return null;
end $$;
revoke all on function private.ggc_safe_timestamptz(text) from public,anon,authenticated;
grant execute on function private.ggc_safe_timestamptz(text) to service_role;

create or replace function public.ggc_publish_scheduled_updates()
returns integer
language plpgsql security definer set search_path=''
as $$
declare
 c record;
 v_now timestamptz:=now();
 v_start timestamptz;
 v_end timestamptz;
 v_release timestamptz;
 v_actor text;
 v_count integer:=0;
 v_rows integer;
begin
 for c in
  select r.record_id,r.data,r.owner_id
  from public.ggc_records r
  where r.kind='comps' and not r.deleted
   and coalesce(r.data->>'status','') not in ('draft','cancelled','deleted')
 loop
  v_start:=private.ggc_safe_timestamptz(c.data->>'starts');
  v_end:=private.ggc_safe_timestamptz(c.data->>'ends');
  v_release:=case when coalesce((c.data#>>'{resultsEmbargo,enabled}')::boolean,false)
   then private.ggc_safe_timestamptz(c.data#>>'{resultsEmbargo,releaseAt}') else v_end end;
  select coalesce(
   (select g.data->>'ownerId' from public.ggc_records g where g.kind='societies' and g.record_id=c.data->>'societyId' and not g.deleted),
   (select m.player_id from public.ggc_group_memberships m where m.group_id=c.data->>'societyId' and m.role in('owner','admin') order by case m.role when 'owner' then 0 else 1 end,m.player_id limit 1),
   c.owner_id::text,'system'
  ) into v_actor;

  if v_start is not null and v_end is not null and v_now>=v_start and v_now-v_start<=interval '2 days' and v_now<v_end then
   insert into public.ggc_group_updates(group_id,kind,title,body,created_by_player_id,audience,event_key,source_type)
   values(c.data->>'societyId','announcement',coalesce(c.data->>'name','Competition')||' is now live','Scoring is open.',v_actor,'group','comp-live:'||c.record_id||':'||(c.data->>'starts'),'system')
   on conflict do nothing;
   get diagnostics v_rows=row_count;v_count:=v_count+v_rows;
  end if;

  if v_end is not null and v_now<v_end and v_end-v_now<=interval '1 hour' then
   insert into public.ggc_group_updates(group_id,kind,title,body,created_by_player_id,audience,event_key,source_type)
   values(c.data->>'societyId','announcement',coalesce(c.data->>'name','Competition')||' closes soon','Scoring closes within the next hour.',v_actor,'group','comp-closing:'||c.record_id||':'||(c.data->>'ends'),'system')
   on conflict do nothing;
   get diagnostics v_rows=row_count;v_count:=v_count+v_rows;
  end if;

  if v_end is not null and v_now>=v_end and v_now-v_end<=interval '2 days' then
   insert into public.ggc_group_updates(group_id,kind,title,body,created_by_player_id,audience,event_key,source_type)
   values(c.data->>'societyId','announcement',coalesce(c.data->>'name','Competition')||' has closed',case when v_release is not null and v_release>v_now then 'Official results will follow at the scheduled release time.' else 'Scoring has closed.' end,v_actor,'group','comp-closed:'||c.record_id||':'||(c.data->>'ends'),'system')
   on conflict do nothing;
   get diagnostics v_rows=row_count;v_count:=v_count+v_rows;
  end if;

  if v_release is not null and v_now>=v_release and v_now-v_release<=interval '2 days' then
   insert into public.ggc_group_updates(group_id,kind,title,body,created_by_player_id,audience,event_key,source_type)
   values(c.data->>'societyId','announcement',coalesce(c.data->>'name','Competition')||' · official results released','The official results are now available in Results.',v_actor,'group','results-released:'||c.record_id||':'||coalesce(c.data#>>'{resultsEmbargo,releaseAt}',c.data->>'ends'),'system')
   on conflict do nothing;
   get diagnostics v_rows=row_count;v_count:=v_count+v_rows;
  end if;
 end loop;
 return v_count;
end $$;
revoke all on function public.ggc_publish_scheduled_updates() from public,anon,authenticated;
grant execute on function public.ggc_publish_scheduled_updates() to service_role;

create or replace function public.ggc_claim_push_deliveries(p_limit int default 100)
returns table(delivery_id uuid,subscription_id uuid,subscription jsonb,update_id uuid,title text,body text,url text)
language plpgsql security definer set search_path=''
as $$
begin
 insert into public.ggc_push_deliveries(update_id,subscription_id)
 select u.id,s.id from public.ggc_group_updates u
 join public.ggc_push_subscriptions s on s.enabled and (u.source_type='system' or s.player_id<>u.created_by_player_id) and (
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

select cron.schedule(
 'ggc-lifecycle-push-every-minute',
 '* * * * *',
 $job$
 select net.http_post(
  url:='https://yqwnbwkqjvqtdxvlscko.supabase.co/functions/v1/ggc-push',
  headers:=jsonb_build_object('Content-Type','application/json','x-ggc-scheduler-secret',(select decrypted_secret from vault.decrypted_secrets where name='ggc_scheduler_secret' order by created_at desc limit 1)),
  body:='{"scheduled":true}'::jsonb,
  timeout_milliseconds:=15000
 )
 $job$
);
