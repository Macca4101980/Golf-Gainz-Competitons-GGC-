-- Web Push subscriptions and least-privilege delivery queue.
create table if not exists public.ggc_push_subscriptions(
 id uuid primary key default gen_random_uuid(),
 player_id text not null,
 auth_user_id uuid not null,
 endpoint text not null unique,
 subscription jsonb not null,
 enabled boolean not null default true,
 user_agent text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 last_success_at timestamptz
);
alter table public.ggc_push_subscriptions enable row level security;
revoke all on public.ggc_push_subscriptions from public,anon,authenticated;
create index if not exists ggc_push_subscriptions_player_idx on public.ggc_push_subscriptions(player_id) where enabled;

create table if not exists public.ggc_push_deliveries(
 id uuid primary key default gen_random_uuid(),
 update_id uuid not null references public.ggc_group_updates(id) on delete cascade,
 subscription_id uuid not null references public.ggc_push_subscriptions(id) on delete cascade,
 status text not null default 'pending' check(status in('pending','processing','delivered','failed')),
 attempts int not null default 0,
 attempted_at timestamptz,
 delivered_at timestamptz,
 error_text text,
 unique(update_id,subscription_id)
);
alter table public.ggc_push_deliveries enable row level security;
revoke all on public.ggc_push_deliveries from public,anon,authenticated;

create table if not exists private.ggc_push_config(
 singleton boolean primary key default true check(singleton),
 public_key text not null,
 private_key text not null,
 subject text not null
);
alter table private.ggc_push_config enable row level security;
revoke all on private.ggc_push_config from public,anon,authenticated;

create or replace function public.ggc_push_public_key()
returns text language sql stable security definer set search_path=''
as $$ select public_key from private.ggc_push_config where singleton $$;

create or replace function public.ggc_register_push_subscription(p_subscription jsonb,p_user_agent text default '')
returns boolean language plpgsql security definer set search_path=''
as $$
declare actor text; endpoint_value text;
begin
 if auth.uid() is null then raise exception 'GGC_SIGN_IN_REQUIRED'; end if;
 actor:=private.ggc_current_player_id();endpoint_value:=p_subscription->>'endpoint';
 if actor is null then raise exception 'GGC_GOLFER_IDENTITY_REQUIRED'; end if;
 if endpoint_value is null or endpoint_value not like 'https://%' or nullif(p_subscription#>>'{keys,p256dh}','') is null or nullif(p_subscription#>>'{keys,auth}','') is null then raise exception 'GGC_INVALID_PUSH_SUBSCRIPTION'; end if;
 insert into public.ggc_push_subscriptions(player_id,auth_user_id,endpoint,subscription,enabled,user_agent)
 values(actor,auth.uid(),endpoint_value,p_subscription,true,left(coalesce(p_user_agent,''),500))
 on conflict(endpoint) do update set player_id=excluded.player_id,auth_user_id=excluded.auth_user_id,subscription=excluded.subscription,enabled=true,user_agent=excluded.user_agent,updated_at=now();
 return true;
end $$;

create or replace function public.ggc_unregister_push_subscription(p_endpoint text)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'GGC_SIGN_IN_REQUIRED'; end if;
 update public.ggc_push_subscriptions set enabled=false,updated_at=now() where endpoint=p_endpoint and auth_user_id=auth.uid();
 return found;
end $$;

create or replace function public.ggc_push_subscription_status()
returns int language sql stable security definer set search_path=''
as $$ select count(*)::int from public.ggc_push_subscriptions where auth_user_id=auth.uid() and enabled $$;

create or replace function public.ggc_push_server_config()
returns table(public_key text,private_key text,subject text)
language sql stable security definer set search_path=''
as $$ select public_key,private_key,subject from private.ggc_push_config where singleton $$;

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
 on conflict(update_id,subscription_id) do nothing;
 return query
 with picked as (
  select d.id from public.ggc_push_deliveries d where d.status='pending' or (d.status='processing' and d.attempted_at<now()-interval '5 minutes') order by d.id limit greatest(1,least(p_limit,500)) for update skip locked
 ),claimed as (
  update public.ggc_push_deliveries d set status='processing',attempts=d.attempts+1,attempted_at=now() from picked where d.id=picked.id returning d.*
 )
 select d.id,s.id,s.subscription,u.id,u.title,u.body,'/?tab=updates&update='||u.id::text
 from claimed d join public.ggc_push_subscriptions s on s.id=d.subscription_id join public.ggc_group_updates u on u.id=d.update_id;
end $$;

create or replace function public.ggc_finish_push_delivery(p_delivery_id uuid,p_success boolean,p_disable_subscription boolean default false,p_error text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare sub_id uuid;
begin
 update public.ggc_push_deliveries set status=case when p_success then 'delivered' else 'failed' end,delivered_at=case when p_success then now() end,error_text=left(coalesce(p_error,''),1000) where id=p_delivery_id returning subscription_id into sub_id;
 if p_success then update public.ggc_push_subscriptions set last_success_at=now() where id=sub_id;
 elsif p_disable_subscription then update public.ggc_push_subscriptions set enabled=false,updated_at=now() where id=sub_id; end if;
end $$;

revoke all on function public.ggc_push_public_key(),public.ggc_register_push_subscription(jsonb,text),public.ggc_unregister_push_subscription(text),public.ggc_push_subscription_status() from public,anon,authenticated;
grant execute on function public.ggc_push_public_key(),public.ggc_register_push_subscription(jsonb,text),public.ggc_unregister_push_subscription(text),public.ggc_push_subscription_status() to authenticated;
revoke all on function public.ggc_push_server_config(),public.ggc_claim_push_deliveries(int),public.ggc_finish_push_delivery(uuid,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.ggc_push_server_config(),public.ggc_claim_push_deliveries(int),public.ggc_finish_push_delivery(uuid,boolean,boolean,text) to service_role;
