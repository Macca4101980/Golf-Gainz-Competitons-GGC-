create function private.ggc_cross_course_roster(p_group_id text, p_search text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.ggc_cross_course_group_access(p_group_id, true) then
    raise exception 'Choose a group you manage';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(golfer) order by golfer.name, golfer.id)
    from (
      select p.record_id as id, p.data->>'name' as name, (p.data->>'hi')::numeric as hi
      from public.ggc_group_memberships m
      join public.ggc_records p on p.kind='players' and p.record_id=m.player_id and not p.deleted
      join auth.users u on u.id::text=p.data->>'authUserId'
      where m.group_id=p_group_id
        and jsonb_typeof(p.data->'hi')='number'
        and strpos(lower(p.data->>'name'), lower(trim(coalesce(p_search,'')))) > 0
      order by name, id limit 30
    ) golfer
  ), '[]'::jsonb);
end;
$$;

create function public.ggc_cross_course_roster(p_group_id text, p_search text default '')
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.ggc_cross_course_roster(p_group_id, p_search);
$$;
revoke execute on function private.ggc_cross_course_roster(text,text) from public, anon;
revoke execute on function public.ggc_cross_course_roster(text,text) from public, anon;
grant execute on function private.ggc_cross_course_roster(text,text) to authenticated;
grant execute on function public.ggc_cross_course_roster(text,text) to authenticated;
