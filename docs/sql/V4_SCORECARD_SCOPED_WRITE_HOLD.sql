-- STAGED ONLY: isolated testing before production migration.
-- Scorecards are independently versioned; clients cannot directly write this table.
create table if not exists public.ggc_scorecards_v4 (
 id text primary key,
 comp_id text not null,
 group_id text not null references public.ggc_groups(id),
 golfer_id text not null references public.ggc_golfers(id),
 card jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
-- Competition-to-group mapping must be verified independently of caller-supplied card JSON.
create table if not exists public.ggc_competition_scope_v4 (
 comp_id text primary key,
 group_id text not null references public.ggc_groups(id)
);
alter table public.ggc_competition_scope_v4 enable row level security;
revoke all on public.ggc_competition_scope_v4 from anon,authenticated;
create index if not exists ggc_scorecards_v4_golfer_idx on public.ggc_scorecards_v4(golfer_id);
alter table public.ggc_scorecards_v4 enable row level security;
revoke all on public.ggc_scorecards_v4 from anon,authenticated;
-- An authenticated golfer may edit only their own card, with a required revision.
-- Group scoring on behalf of others uses explicit group-admin permission and the same revision guard.
create or replace function public.ggc_save_my_scorecard_v4(
 p_card_id text,p_comp_id text,p_group_id text,p_expected_revision bigint,p_card jsonb
) returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_golfer_id text; v_revision bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_card_id is null or length(p_card_id)=0 or p_comp_id is null or length(p_comp_id)=0 or p_group_id is null or length(p_group_id)=0
 or p_expected_revision is null or p_expected_revision<0
 or p_card is null or jsonb_typeof(p_card)<>'object'
 then raise exception 'Invalid scorecard' using errcode='22023'; end if;
 select id into v_golfer_id from public.ggc_golfers
 where auth_user_id=auth.uid() and placeholder=false;
 if v_golfer_id is null then raise exception 'No claimed golfer account' using errcode='42501'; end if;
 if p_card->>'id' is distinct from p_card_id
 or p_card->>'compId' is distinct from p_comp_id
 or p_card->>'societyId' is distinct from p_group_id
 or p_card->>'playerId' is distinct from v_golfer_id
 then raise exception 'Scorecard identity mismatch' using errcode='42501'; end if;
 if not exists(select 1 from public.ggc_memberships m where m.group_id=p_group_id and m.golfer_id=v_golfer_id and m.status='member') then raise exception 'Group membership required' using errcode='42501'; end if;
 if not exists(select 1 from public.ggc_competition_scope_v4 cs where cs.comp_id=p_comp_id and cs.group_id=p_group_id) then raise exception 'Competition group mismatch' using errcode='42501'; end if;
 if p_expected_revision=0 then
  insert into public.ggc_scorecards_v4(id,comp_id,group_id,golfer_id,card)
  values(p_card_id,p_comp_id,p_group_id,v_golfer_id,p_card)
  on conflict do nothing returning revision into v_revision;
 else
  update public.ggc_scorecards_v4
  set card=p_card,revision=revision+1,updated_at=clock_timestamp()
  where id=p_card_id and comp_id=p_comp_id and group_id=p_group_id and golfer_id=v_golfer_id
  and revision=p_expected_revision
  returning revision into v_revision;
 end if;
 if v_revision is null then raise exception 'Scorecard conflict or permission denied' using errcode='40001'; end if;
 return v_revision;
end $$;
revoke all on function public.ggc_save_my_scorecard_v4(text,text,text,bigint,jsonb) from public,anon;
grant execute on function public.ggc_save_my_scorecard_v4(text,text,text,bigint,jsonb) to authenticated;

-- Scoped delegated entry: only an active admin/owner of the scorecard's group.
-- The target golfer must be an active member of that same group.
create or replace function public.ggc_save_group_scorecard_v4(
 p_card_id text,p_comp_id text,p_group_id text,p_target_golfer_id text,
 p_expected_revision bigint,p_card jsonb
) returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor text; v_revision bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if coalesce(length(p_card_id),0)=0 or coalesce(length(p_comp_id),0)=0
 or coalesce(length(p_group_id),0)=0 or coalesce(length(p_target_golfer_id),0)=0
 or p_expected_revision is null or p_expected_revision<0
 or p_card is null or jsonb_typeof(p_card)<>'object'
 then raise exception 'Invalid scorecard' using errcode='22023'; end if;
 select id into v_actor from public.ggc_golfers
 where auth_user_id=auth.uid() and placeholder=false;
 if v_actor is null then raise exception 'No claimed golfer account' using errcode='42501'; end if;
 if not exists(
  select 1 from public.ggc_memberships m
  where m.group_id=p_group_id and m.golfer_id=v_actor
  and m.status='member' and m.role in ('admin','owner')
 ) or not exists(
  select 1 from public.ggc_memberships m
  where m.group_id=p_group_id and m.golfer_id=p_target_golfer_id and m.status='member'
 ) then raise exception 'Group scoring permission denied' using errcode='42501'; end if;
 if p_card->>'id' is distinct from p_card_id
 or p_card->>'compId' is distinct from p_comp_id
 or p_card->>'societyId' is distinct from p_group_id
 or p_card->>'playerId' is distinct from p_target_golfer_id
 then raise exception 'Scorecard identity mismatch' using errcode='42501'; end if;
 if p_expected_revision=0 then
  insert into public.ggc_scorecards_v4(id,comp_id,group_id,golfer_id,card)
  values(p_card_id,p_comp_id,p_group_id,p_target_golfer_id,p_card)
  on conflict do nothing returning revision into v_revision;
 else
  update public.ggc_scorecards_v4
  set card=p_card,revision=revision+1,updated_at=clock_timestamp()
  where id=p_card_id and comp_id=p_comp_id and group_id=p_group_id
  and golfer_id=p_target_golfer_id and revision=p_expected_revision
  returning revision into v_revision;
 end if;
 if v_revision is null then raise exception 'Scorecard conflict or permission denied' using errcode='40001'; end if;
 return v_revision;
end $$;
revoke all on function public.ggc_save_group_scorecard_v4(text,text,text,text,bigint,jsonb) from public,anon;
grant execute on function public.ggc_save_group_scorecard_v4(text,text,text,text,bigint,jsonb) to authenticated;

-- Scoped read for revision-aware editing; cards are visible only to their golfer
-- or an active admin/owner of the same group.
create or replace function public.ggc_read_scorecard_v4(p_card_id text)
returns table(card jsonb,revision bigint) language plpgsql security definer
set search_path=public,pg_temp as $$
declare v_actor text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select g.id into v_actor from public.ggc_golfers g where g.auth_user_id=auth.uid() and g.placeholder=false;
 if v_actor is null then raise exception 'No claimed golfer account' using errcode='42501'; end if;
 return query select s.card,s.revision from public.ggc_scorecards_v4 s
 where s.id=p_card_id and (
  (s.golfer_id=v_actor and exists(select 1 from public.ggc_memberships m where m.group_id=s.group_id and m.golfer_id=v_actor and m.status='member'))
  or exists(select 1 from public.ggc_memberships m where m.group_id=s.group_id and m.golfer_id=v_actor and m.status='member' and m.role in ('admin','owner'))
 );
end $$;
revoke all on function public.ggc_read_scorecard_v4(text) from public,anon;
grant execute on function public.ggc_read_scorecard_v4(text) to authenticated;
