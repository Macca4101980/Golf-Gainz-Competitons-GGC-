-- Cross-group insert/update denial, direct RLS denial, and legitimate admin creation.
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
do $test$
begin
 begin
  insert into public.ggc_records(kind,record_id,data,owner_id) values('comps','access-boundary-direct','{"id":"access-boundary-direct","societyId":"access-boundary-private"}',auth.uid());
  raise exception 'TEST_FAILED: direct insert bypassed group permission';
 exception when insufficient_privilege then null;
 end;
end $test$;
reset role;
insert into public.ggc_records(kind,record_id,data,owner_id) values
 ('societies','access-boundary-owned','{"id":"access-boundary-owned","ownerId":"b3a16302-19ac-4efc-b780-1ba4e6bc39ba","members":["b3a16302-19ac-4efc-b780-1ba4e6bc39ba"]}','b3a16302-19ac-4efc-b780-1ba4e6bc39ba');
set local role authenticated;
do $test$
begin
 if public.ggc_save_record('comps','access-boundary-allowed','{"id":"access-boundary-allowed","societyId":"access-boundary-owned"}',null,false)<>1 then raise exception 'Admin creation failed'; end if;
 begin
  perform public.ggc_patch_record('comps','access-boundary-allowed','{"societyId":"access-boundary-private"}',array['societyId'],1,false);
  raise exception 'TEST_FAILED: owner moved record into another private group';
 exception when others then if sqlerrm<>'GGC_ACCESS_DENIED' then raise; end if;
 end;
 begin
  perform public.ggc_save_record('comps','access-boundary-allowed','{"id":"access-boundary-allowed","societyId":"access-boundary-private"}',1,false);
  raise exception 'TEST_FAILED: full save moved record into private group';
 exception when others then if sqlerrm<>'GGC_ACCESS_DENIED' then raise; end if;
 end;
 if public.ggc_patch_record('comps','access-boundary-allowed','{"name":"Allowed edit"}',array['name'],1,false)<>2 then raise exception 'Admin patch failed'; end if;
end $test$;
reset role;
select 'Cross-group RPC/direct inserts and moves denied; admin creates and edits allowed' result;
rollback;
