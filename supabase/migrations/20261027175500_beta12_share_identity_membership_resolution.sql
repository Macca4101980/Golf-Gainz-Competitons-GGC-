
create or replace function private.ggc_public_group_member(p_group_id text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare grp jsonb; permitted boolean:=false;
begin
 if auth.uid() is null or p_group_id is null then return false; end if;
 if to_regclass('public.ggc_group_memberships') is not null then
  execute 'select exists(select 1 from public.ggc_group_memberships m join public.ggc_records p on p.kind=''players'' and p.record_id=m.player_id and not p.deleted where m.group_id=$1 and p.data->>''authUserId''=$2)'
  into permitted using p_group_id,auth.uid()::text;
 end if;
 if permitted then return true; end if;
 select data into grp from public.ggc_records where kind='societies' and record_id=p_group_id and not deleted;
 return exists(select 1 from public.ggc_records p where p.kind='players' and not p.deleted and p.data->>'authUserId'=auth.uid()::text and (grp->>'ownerId'=p.record_id or coalesce(grp->'admins','[]'::jsonb) ? p.record_id or coalesce(grp->'members','[]'::jsonb) ? p.record_id));
end $$;

create or replace function private.ggc_public_group_admin(p_group_id text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare grp jsonb; permitted boolean:=false;
begin
 if auth.uid() is null or p_group_id is null then return false; end if;
 if to_regclass('public.ggc_group_memberships') is not null then
  execute 'select exists(select 1 from public.ggc_group_memberships m join public.ggc_records p on p.kind=''players'' and p.record_id=m.player_id and not p.deleted where m.group_id=$1 and m.role in (''owner'',''admin'') and p.data->>''authUserId''=$2)'
  into permitted using p_group_id,auth.uid()::text;
 end if;
 if permitted then return true; end if;
 select data into grp from public.ggc_records where kind='societies' and record_id=p_group_id and not deleted;
 return exists(select 1 from public.ggc_records p where p.kind='players' and not p.deleted and p.data->>'authUserId'=auth.uid()::text and (grp->>'ownerId'=p.record_id or coalesce(grp->'admins','[]'::jsonb) ? p.record_id));
end $$;

create or replace function private.ggc_public_league_member(p_league_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select private.ggc_public_group_member(private.ggc_league_group(p_league_id))
$$;

create or replace function private.ggc_public_league_admin(p_league_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select private.ggc_public_group_admin(private.ggc_league_group(p_league_id))
$$;

create or replace function private.ggc_public_share_admin(p_competition_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select private.ggc_public_group_member((select data->>'societyId' from public.ggc_records where kind='comps' and record_id=p_competition_id and not deleted limit 1))
$$;

create or replace function private.ggc_public_competition_admin(p_competition_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select private.ggc_public_group_admin((select data->>'societyId' from public.ggc_records where kind='comps' and record_id=p_competition_id and not deleted limit 1))
$$;
