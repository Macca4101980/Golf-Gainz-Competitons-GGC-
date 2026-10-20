-- Test-project only. Fixtures and attempted patches are rolled back.
begin;
insert into public.ggc_records(kind,record_id,data,deleted,version,owner_id)
select kind,id,data,false,1,'5630395f-6cea-4109-9bac-e8f4bae34dfd'::uuid
from (values
 ('societies','related-test-group','{"id":"related-test-group","ownerId":"5630395f-6cea-4109-9bac-e8f4bae34dfd","members":["b3a16302-19ac-4efc-b780-1ba4e6bc39ba"]}'::jsonb),
 ('comps','related-test-comp','{"id":"related-test-comp","societyId":"related-test-group","course":"related-test-course"}'::jsonb),
 ('courses','related-test-course','{"id":"related-test-course","name":"Shared course"}'::jsonb),
 ('courses','related-test-card-course','{"id":"related-test-card-course","name":"Card-specific course"}'::jsonb),
 ('cards','related-test-card','{"id":"related-test-card","compId":"related-test-comp","societyId":"related-test-group","courseId":"related-test-card-course","playerId":"b3a16302-19ac-4efc-b780-1ba4e6bc39ba"}'::jsonb),
 ('courses','related-test-private-course','{"id":"related-test-private-course","name":"Unreferenced course"}'::jsonb),
 ('leagues','related-test-league','{"id":"related-test-league","societyId":"related-test-group","name":"Shared league"}'::jsonb),
 ('audit','related-test-audit','{"id":"related-test-audit","societyId":"related-test-group"}'::jsonb),
 ('appFields','related-test-oom','{"id":"related-test-oom","scope":"society","societyId":"related-test-group","field":"oom","subjectId":"bestCount","value":8}'::jsonb),
 ('appFields','related-test-private-setting','{"id":"related-test-private-setting","scope":"user","userId":"5630395f-6cea-4109-9bac-e8f4bae34dfd","field":"setting","subjectId":"theme","value":"dark"}'::jsonb),
 ('societyInvites','related-test-invite','{"id":"related-test-invite","societyId":"related-test-group"}'::jsonb)
) as fixtures(kind,id,data);
set local role authenticated;
select set_config('request.jwt.claim.sub','b3a16302-19ac-4efc-b780-1ba4e6bc39ba',true);
do $test$
begin
 if (select count(*) from public.ggc_records where record_id in ('related-test-league','related-test-course','related-test-audit','related-test-oom','related-test-card-course'))<>5 then raise exception 'Member cannot read related group records'; end if;
 if exists(select 1 from public.ggc_records where record_id in ('related-test-private-course','related-test-private-setting','related-test-invite')) then raise exception 'Member can read private unrelated records'; end if;
 begin
  perform public.ggc_patch_record('leagues','related-test-league','{"name":"Forbidden"}'::jsonb,array['name'],1,false);
  raise exception 'Member unexpectedly edited league';
 exception when others then if sqlerrm<>'GGC_ACCESS_DENIED' then raise; end if;
 end;
 begin
  perform public.ggc_patch_record('courses','related-test-course','{"name":"Forbidden"}'::jsonb,array['name'],1,false);
  raise exception 'Member unexpectedly edited shared course';
 exception when others then if sqlerrm<>'GGC_ACCESS_DENIED' then raise; end if;
 end;
end
$test$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $test$
begin
 if exists(select 1 from public.ggc_records where record_id like 'related-test-%') then raise exception 'Outsider can read group records'; end if;
end
$test$;
select set_config('request.jwt.claim.sub','5630395f-6cea-4109-9bac-e8f4bae34dfd',true);
do $test$
begin
 if (select count(*) from public.ggc_records where record_id like 'related-test-%')<>11 then raise exception 'Owner lost record access'; end if;
 if public.ggc_patch_record('leagues','related-test-league','{"name":"Owner change"}'::jsonb,array['name'],1,false)<>2 then raise exception 'Owner cannot edit league'; end if;
end
$test$;
reset role;
select 'Related reads: member allow, outsider deny, private records deny, writes unchanged' as result;
rollback;
