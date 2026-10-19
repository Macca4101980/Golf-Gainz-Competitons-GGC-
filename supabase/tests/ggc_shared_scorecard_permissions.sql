-- Transactional integration check for Beta 7 shared scorecard permissions.
-- Run against the isolated test project; the fixture rows are rolled back.
begin;

insert into public.ggc_records(kind,record_id,data,deleted,version,owner_id)
values
 ('players','permission-test-member',jsonb_build_object('id','permission-test-member','authUserId','b3a16302-19ac-4efc-b780-1ba4e6bc39ba'),false,1,'b3a16302-19ac-4efc-b780-1ba4e6bc39ba'),
 ('societies','permission-test-society',jsonb_build_object('id','permission-test-society','ownerId','5630395f-6cea-4109-9bac-e8f4bae34dfd','admins',jsonb_build_array('5630395f-6cea-4109-9bac-e8f4bae34dfd'),'members',jsonb_build_array('permission-test-member','b3a16302-19ac-4efc-b780-1ba4e6bc39ba')),false,1,'5630395f-6cea-4109-9bac-e8f4bae34dfd'),
 ('comps','permission-test-comp',jsonb_build_object('id','permission-test-comp','societyId','permission-test-society','roundGroups',jsonb_build_array(jsonb_build_object('id','permission-test-round','playerIds',jsonb_build_array('target-player','permission-test-member')))),false,1,'5630395f-6cea-4109-9bac-e8f4bae34dfd'),
 ('cards','permission-test-allowed-card',jsonb_build_object('id','permission-test-allowed-card','societyId','permission-test-society','compId','permission-test-comp','playerId','target-player','gross',jsonb_build_array(5)),false,1,'5630395f-6cea-4109-9bac-e8f4bae34dfd'),
 ('cards','permission-test-denied-card',jsonb_build_object('id','permission-test-denied-card','societyId','permission-test-society','compId','permission-test-comp','playerId','target-player','gross',jsonb_build_array(6)),false,1,'5630395f-6cea-4109-9bac-e8f4bae34dfd');

set local role authenticated;
select set_config('request.jwt.claim.sub','b3a16302-19ac-4efc-b780-1ba4e6bc39ba',true);
select set_config('request.jwt.claims','{"sub":"b3a16302-19ac-4efc-b780-1ba4e6bc39ba","role":"authenticated"}',true);

do $test$
declare v bigint;
begin
 v:=public.ggc_patch_record('cards','permission-test-allowed-card','{"gross":[4]}'::jsonb,array['gross'],1,false);
 if v<>2 then raise exception 'Expected authorized same-round patch to advance version to 2'; end if;
 begin
  perform public.ggc_patch_record('cards','permission-test-allowed-card','{"gross":[3]}'::jsonb,array['gross'],1,false);
  raise exception 'Expected stale patch to fail';
 exception when others then
  if sqlerrm<>'GGC_VERSION_CONFLICT' then raise; end if;
 end;
end
$test$;

reset role;
update public.ggc_records set data=jsonb_set(data,'{roundGroups}','[]'::jsonb)
 where kind='comps' and record_id='permission-test-comp';
set local role authenticated;
select set_config('request.jwt.claim.sub','b3a16302-19ac-4efc-b780-1ba4e6bc39ba',true);
select set_config('request.jwt.claims','{"sub":"b3a16302-19ac-4efc-b780-1ba4e6bc39ba","role":"authenticated"}',true);

do $test$
begin
 begin
  perform public.ggc_patch_record('cards','permission-test-denied-card','{"gross":[1]}'::jsonb,array['gross'],1,false);
  raise exception 'Expected member outside the playing group to be denied';
 exception when others then
  if sqlerrm<>'GGC_ACCESS_DENIED' then raise; end if;
 end;
end
$test$;

reset role;
do $test$
declare d public.ggc_records%rowtype;
begin
 select * into d from public.ggc_records where kind='cards' and record_id='permission-test-denied-card';
 if d.version<>1 or d.data->'gross'<>'[6]'::jsonb then
  raise exception 'Denied scorecard patch changed stored data';
 end if;
end
$test$;

rollback;
