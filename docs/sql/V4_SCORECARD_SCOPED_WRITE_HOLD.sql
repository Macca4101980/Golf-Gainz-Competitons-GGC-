-- STAGED ONLY: isolated testing before production migration.
-- Scorecards are independently versioned; clients cannot directly write this table.
create table if not exists public.ggc_scorecards_v4 (
 id text primary key,
 comp_id text not null,
 golfer_id text not null references public.ggc_golfers(id),
 card jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
create index if not exists ggc_scorecards_v4_golfer_idx on public.ggc_scorecards_v4(golfer_id);
alter table public.ggc_scorecards_v4 enable row level security;
revoke all on public.ggc_scorecards_v4 from anon,authenticated;
-- An authenticated golfer may edit only their own card, with a required revision.
-- Group scoring on behalf of others needs a separate explicit delegation API.
create or replace function public.ggc_save_my_scorecard_v4(
 p_card_id text,p_comp_id text,p_expected_revision bigint,p_card jsonb
) returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_golfer_id text; v_revision bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_card_id is null or length(p_card_id)=0 or p_comp_id is null or length(p_comp_id)=0
 or p_expected_revision is null or p_expected_revision<0
 or p_card is null or jsonb_typeof(p_card)<>'object'
 then raise exception 'Invalid scorecard' using errcode='22023'; end if;
 select id into v_golfer_id from public.ggc_golfers
 where auth_user_id=auth.uid() and placeholder=false;
 if v_golfer_id is null then raise exception 'No claimed golfer account' using errcode='42501'; end if;
 if p_card->>'id' is distinct from p_card_id
 or p_card->>'compId' is distinct from p_comp_id
 or p_card->>'playerId' is distinct from v_golfer_id
 then raise exception 'Scorecard identity mismatch' using errcode='42501'; end if;
 if p_expected_revision=0 then
  insert into public.ggc_scorecards_v4(id,comp_id,golfer_id,card)
  values(p_card_id,p_comp_id,v_golfer_id,p_card)
  on conflict do nothing returning revision into v_revision;
 else
  update public.ggc_scorecards_v4
  set card=p_card,revision=revision+1,updated_at=clock_timestamp()
  where id=p_card_id and comp_id=p_comp_id and golfer_id=v_golfer_id
  and revision=p_expected_revision
  returning revision into v_revision;
 end if;
 if v_revision is null then raise exception 'Scorecard conflict or permission denied' using errcode='40001'; end if;
 return v_revision;
end $$;
revoke all on function public.ggc_save_my_scorecard_v4(text,text,bigint,jsonb) from public,anon;
grant execute on function public.ggc_save_my_scorecard_v4(text,text,bigint,jsonb) to authenticated;
