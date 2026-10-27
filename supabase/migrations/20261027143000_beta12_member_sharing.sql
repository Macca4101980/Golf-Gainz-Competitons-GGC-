-- Beta 12.1: any group member can create/share a public leaderboard link.
-- The group admin still controls the publicLeaderboardsEnabled switch in the app.
create or replace function private.ggc_public_share_admin(p_competition_id text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor text; comp jsonb; grp jsonb; permitted boolean;
begin
 if auth.uid() is null then return false; end if;
 select record_id into actor from public.ggc_records
   where kind='players' and not deleted and data->>'authUserId'=auth.uid()::text
   order by updated_at desc limit 1;
 if actor is null then return false; end if;
 select data into comp from public.ggc_records
   where kind='comps' and record_id=p_competition_id and not deleted;
 if comp is null then return false; end if;
 select data into grp from public.ggc_records
   where kind='societies' and record_id=comp->>'societyId' and not deleted;
 if grp is null then return false; end if;
 if to_regclass('public.ggc_group_memberships') is not null then
   execute 'select exists(select 1 from public.ggc_group_memberships where group_id=$1 and player_id=$2)'
     into permitted using comp->>'societyId', actor;
   return permitted;
 end if;
 return coalesce(grp->>'ownerId'=actor
   or (coalesce(grp->'admins','[]') ? actor)
   or (coalesce(grp->'members','[]') ? actor)
   or (coalesce(comp->'entries','[]') ? actor),false);
end $$;
revoke all on function private.ggc_public_share_admin(text) from public,anon,authenticated;