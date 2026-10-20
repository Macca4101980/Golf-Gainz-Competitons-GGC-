-- Expected-denial regression. This currently exposes a release blocker.
-- Isolated test project only; all fixture/probe writes roll back on failure.
begin;
insert into public.ggc_records(kind,record_id,data,version,deleted,owner_id)
values('societies','access-boundary-private','{"id":"access-boundary-private","ownerId":"5630395f-6cea-4109-9bac-e8f4bae34dfd","members":["5630395f-6cea-4109-9bac-e8f4bae34dfd"],"admins":["5630395f-6cea-4109-9bac-e8f4bae34dfd"]}',1,false,'5630395f-6cea-4109-9bac-e8f4bae34dfd');
set local role authenticated;
select set_config('request.jwt.claim.sub','b3a16302-19ac-4efc-b780-1ba4e6bc39ba',true);
select set_config('request.jwt.claims','{"sub":"b3a16302-19ac-4efc-b780-1ba4e6bc39ba","role":"authenticated"}',true);
do $test$
begin
 begin
  perform public.ggc_save_record('comps','access-boundary-forged-comp','{"id":"access-boundary-forged-comp","societyId":"access-boundary-private","name":"Permission probe"}',null,false);
  raise exception 'TEST_FAILED: outsider created a competition in a private group';
 exception when others then
  if sqlerrm<>'GGC_ACCESS_DENIED' then raise; end if;
 end;
end
$test$;
rollback;
