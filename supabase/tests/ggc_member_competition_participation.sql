-- Ordinary members may join and maintain only the playing group containing
-- their own player identity. Run only against an isolated test database.
begin;
insert into public.ggc_records(kind,record_id,data,owner_id) values
 ('players','member-transition-peer','{"id":"member-transition-peer","name":"Peer"}','5630395f-6cea-4109-9bac-e8f4bae34dfd'),
 ('societies','member-transition-group','{"id":"member-transition-group","ownerId":"5630395f-6cea-4109-9bac-e8f4bae34dfd","members":["5630395f-6cea-4109-9bac-e8f4bae34dfd","b3a16302-19ac-4efc-b780-1ba4e6bc39ba","member-transition-peer"],"admins":["5630395f-6cea-4109-9bac-e8f4bae34dfd"]}','5630395f-6cea-4109-9bac-e8f4bae34dfd'),
 ('comps','member-transition-comp','{"id":"member-transition-comp","societyId":"member-transition-group","name":"Member transition test","entries":[],"invites":["b3a16302-19ac-4efc-b780-1ba4e6bc39ba"],"roundGroups":[{"id":"other-group","playerIds":["5630395f-6cea-4109-9bac-e8f4bae34dfd","member-transition-peer"]}]}','5630395f-6cea-4109-9bac-e8f4bae34dfd');

set local role authenticated;
select set_config('request.jwt.claim.sub','b3a16302-19ac-4efc-b780-1ba4e6bc39ba',true);
select set_config('request.jwt.claims','{"sub":"b3a16302-19ac-4efc-b780-1ba4e6bc39ba","role":"authenticated"}',true);

do $test$
declare v bigint;
begin
 v:=public.ggc_patch_record(
  'comps','member-transition-comp',
  '{"entries":["b3a16302-19ac-4efc-b780-1ba4e6bc39ba"],"invites":[],"roundGroups":[{"id":"other-group","playerIds":["5630395f-6cea-4109-9bac-e8f4bae34dfd","member-transition-peer"]},{"id":"my-group","playerIds":["b3a16302-19ac-4efc-b780-1ba4e6bc39ba"]}]}'::jsonb,
  array['entries','invites','roundGroups'],1,false
 );
 if v<>2 then raise exception 'Member participation patch did not save'; end if;

 begin
  perform public.ggc_patch_record('comps','member-transition-comp','{"name":"Hijacked"}'::jsonb,array['name'],2,false);
  raise exception 'TEST_FAILED: member changed competition settings';
 exception when others then if sqlerrm<>'GGC_ACCESS_DENIED' then raise; end if; end;

 begin
  perform public.ggc_patch_record('comps','member-transition-comp','{"roundGroups":[{"id":"my-group","playerIds":["b3a16302-19ac-4efc-b780-1ba4e6bc39ba"]}]}'::jsonb,array['roundGroups'],2,false);
  raise exception 'TEST_FAILED: member removed another playing group';
 exception when others then if sqlerrm<>'GGC_ACCESS_DENIED' then raise; end if; end;
end $test$;

reset role;
select 'Member joins safely; competition settings and other playing groups remain protected' result;
rollback;
