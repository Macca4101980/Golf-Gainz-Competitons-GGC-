-- Fixture setup is restricted to group organisers.
create table private.ggc_cross_course_fixtures (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  fixture jsonb not null,
  closes_at timestamptz not null,
  check (jsonb_typeof(fixture->'cards') = 'array' and jsonb_array_length(fixture->'cards') = 4),
  check ((fixture->>'length')::integer in (9, 18))
);

create table private.ggc_cross_course_hole_locks (
  fixture_id uuid not null references private.ggc_cross_course_fixtures(id),
  golfer_id text not null,
  hole_order integer not null check (hole_order between 1 and 18),
  gross integer not null check (gross between 0 and 999),
  primary key (fixture_id, golfer_id, hole_order)
);

create table private.ggc_cross_course_submissions (
  fixture_id uuid not null references private.ggc_cross_course_fixtures(id),
  golfer_id text not null,
  submitted_at timestamptz not null default now(),
  primary key (fixture_id, golfer_id)
);

alter table private.ggc_cross_course_submissions enable row level security;
revoke all on private.ggc_cross_course_submissions from public, anon, authenticated;
alter table private.ggc_cross_course_fixtures enable row level security;
alter table private.ggc_cross_course_hole_locks enable row level security;
revoke all on private.ggc_cross_course_fixtures, private.ggc_cross_course_hole_locks from public, anon, authenticated;

create function private.ggc_cross_course_group_access(p_group_id text, p_admin boolean)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.ggc_group_memberships member
    join public.ggc_records player on player.kind = 'players' and not player.deleted
      and player.record_id = member.player_id
    where member.group_id = p_group_id
      and player.data->>'authUserId' = auth.uid()::text
      and (not p_admin or member.role in ('owner', 'admin'))
  );
$$;
revoke execute on function private.ggc_cross_course_group_access(text, boolean) from public, anon, authenticated;

create function private.ggc_cross_course_card(p_fixture_id uuid, p_hole_order integer, p_gross integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  fixture_row private.ggc_cross_course_fixtures%rowtype;
  golfer text;
  response jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to view your fixture'; end if;
  select * into fixture_row from private.ggc_cross_course_fixtures where id = p_fixture_id;
  select card->>'id' into golfer
    from jsonb_array_elements(fixture_row.fixture->'cards') as card
    join public.ggc_records player on player.kind = 'players'
      and player.record_id = card->>'id' and not player.deleted
    where player.data->>'authUserId' = auth.uid()::text;
  if golfer is null or not private.ggc_cross_course_group_access(fixture_row.group_id, false) then
    raise exception 'Fixture unavailable';
  end if;

  if p_hole_order = 0 and p_gross is null then
    if (select count(*) from private.ggc_cross_course_hole_locks
        where fixture_id = p_fixture_id and golfer_id = golfer) <> (fixture_row.fixture->>'length')::integer then
      raise exception 'Lock every hole before submitting the card';
    end if;
    insert into private.ggc_cross_course_submissions(fixture_id, golfer_id)
      values (p_fixture_id, golfer) on conflict do nothing;
  elsif p_hole_order is not null or p_gross is not null then
    if p_hole_order is null or p_gross is null or p_hole_order < 1
       or p_hole_order > (fixture_row.fixture->>'length')::integer
       or p_gross not between 0 and 999 then
      raise exception 'Enter a valid hole and score';
    end if;
    -- An identical retry succeeds even if the initial acknowledgement was lost.
    insert into private.ggc_cross_course_hole_locks(fixture_id, golfer_id, hole_order, gross)
      select p_fixture_id, golfer, p_hole_order, p_gross
      where clock_timestamp() < fixture_row.closes_at
      on conflict (fixture_id, golfer_id, hole_order) do nothing;
    if not exists (
      select 1 from private.ggc_cross_course_hole_locks
      where fixture_id = p_fixture_id and golfer_id = golfer
        and hole_order = p_hole_order and gross = p_gross
    ) then raise exception 'This hole is already locked or the fixture is closed'; end if;
  end if;

  -- Use one statement snapshot for the reveal boundary and the scores it returns.
  with locks as materialized (
    select golfer_id, hole_order, gross from private.ggc_cross_course_hole_locks
    where fixture_id = p_fixture_id
  ), boundary as (
    select min(hole) as first_pending
    from generate_series(1, (fixture_row.fixture->>'length')::integer) as hole
    where (select count(*) from locks where hole_order = hole) < 4
  )
  select jsonb_build_object(
    'fixture', fixture_row.fixture,
    'golferId', golfer,
    'closesAt', fixture_row.closes_at,
    'submitted', exists (select 1 from private.ggc_cross_course_submissions
      where fixture_id = p_fixture_id and golfer_id = golfer),
    'locks', coalesce((
      select jsonb_agg(jsonb_build_object('golferId', golfer_id, 'holeOrder', hole_order, 'gross', gross)
        order by hole_order, golfer_id)
      from locks where golfer_id = golfer or hole_order < coalesce(boundary.first_pending, 19)
    ), '[]'::jsonb),
    'lockCounts', (
      select jsonb_agg((select count(*) from locks where hole_order = hole) order by hole)
      from generate_series(1, (fixture_row.fixture->>'length')::integer) as hole
    )
  ) into strict response from boundary;
  return response;
end;
$$;

create function public.ggc_cross_course_card(p_fixture_id uuid, p_hole_order integer default null, p_gross integer default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.ggc_cross_course_card(p_fixture_id, p_hole_order, p_gross);
$$;

revoke execute on function private.ggc_cross_course_card(uuid, integer, integer) from public, anon;
revoke execute on function public.ggc_cross_course_card(uuid, integer, integer) from public, anon;
grant execute on function private.ggc_cross_course_card(uuid, integer, integer) to authenticated;
grant execute on function public.ggc_cross_course_card(uuid, integer, integer) to authenticated;

create function private.ggc_cross_course_fixtures(p_group_id text, p_fixture jsonb, p_closes_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare created_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_fixture is not null then
    if not private.ggc_cross_course_group_access(p_group_id, true) or p_closes_at is null or p_closes_at <= now() then
      raise exception 'Choose a group you manage and a future deadline';
    end if;
    if (select count(distinct player.data->>'authUserId')
        from jsonb_array_elements(p_fixture->'cards') card
        join public.ggc_records player on player.kind = 'players' and not player.deleted
          and player.record_id = card->>'id'
        join public.ggc_group_memberships member on member.group_id = p_group_id
          and member.player_id = player.record_id) <> 4 then
      raise exception 'Choose four distinct signed-in group golfers';
    end if;
    insert into private.ggc_cross_course_fixtures(group_id, fixture, closes_at)
      values (p_group_id, p_fixture, p_closes_at) returning id into created_id;
    return jsonb_build_object('id', created_id);
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.fixture->>'name', 'closesAt', f.closes_at)
      order by f.closes_at desc)
    from private.ggc_cross_course_fixtures f
    where private.ggc_cross_course_group_access(f.group_id, false)
      and exists (
        select 1 from jsonb_array_elements(f.fixture->'cards') card
        join public.ggc_records player on player.kind = 'players' and not player.deleted
          and player.record_id = card->>'id'
        where player.data->>'authUserId' = auth.uid()::text
      )
  ), '[]'::jsonb);
end;
$$;

create function public.ggc_cross_course_fixtures(p_group_id text default null, p_fixture jsonb default null, p_closes_at timestamptz default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.ggc_cross_course_fixtures(p_group_id, p_fixture, p_closes_at);
$$;

revoke execute on function private.ggc_cross_course_fixtures(text, jsonb, timestamptz) from public, anon;
revoke execute on function public.ggc_cross_course_fixtures(text, jsonb, timestamptz) from public, anon;
grant execute on function private.ggc_cross_course_fixtures(text, jsonb, timestamptz) to authenticated;
grant execute on function public.ggc_cross_course_fixtures(text, jsonb, timestamptz) to authenticated;
