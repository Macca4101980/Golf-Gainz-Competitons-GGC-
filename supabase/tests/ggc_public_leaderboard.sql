-- Synthetic fixtures only. Always rolled back; never run against production.
begin;
insert into auth.users(id,email) values('b1200000-0000-4000-8000-000000000001','beta12-owner@example.invalid'),('b1200000-0000-4000-8000-000000000002','beta12-member@example.invalid');
insert into public.ggc_records(kind,record_id,data,owner_id,updated_by) values
('players','qa-beta12-owner','{"id":"qa-beta12-owner","name":"QA Owner","authUserId":"b1200000-0000-4000-8000-000000000001"}','b1200000-0000-4000-8000-000000000001','b1200000-0000-4000-8000-000000000001'),
('players','qa-beta12-member','{"id":"qa-beta12-member","name":"QA Private Name","authUserId":"b1200000-0000-4000-8000-000000000002","email":"secret@example.invalid"}','b1200000-0000-4000-8000-000000000002','b1200000-0000-4000-8000-000000000002'),
('societies','qa-beta12-group','{"id":"qa-beta12-group","ownerId":"qa-beta12-owner","admins":["qa-beta12-owner"],"members":["qa-beta12-owner","qa-beta12-member"],"publicLeaderboardsEnabled":true}','b1200000-0000-4000-8000-000000000001','b1200000-0000-4000-8000-000000000001'),
('comps','qa-beta12-comp','{"id":"qa-beta12-comp","societyId":"qa-beta12-group","name":"QA Beta 12","format":"stableford","entries":["qa-beta12-member"]}','b1200000-0000-4000-8000-000000000001','b1200000-0000-4000-8000-000000000001');
insert into public.ggc_group_memberships(group_id,player_id,role) values('qa-beta12-group','qa-beta12-owner','owner'),('qa-beta12-group','qa-beta12-member','member');
set local role authenticated;
select set_config('request.jwt.claim.sub','b1200000-0000-4000-8000-000000000001',true);
do $$declare answer jsonb; begin
 answer:=public.ggc_manage_public_share('qa-beta12-comp','publish',encode(extensions.digest(repeat('a',64),'sha256'),'hex'),'{"schemaVersion":1,"visibleThrough":18,"provisional":false,"email":"must-drop","rows":[{"memberIds":["qa-beta12-member"],"result":"36 pts","complete":18,"email":"must-drop"}]}',0);
 if answer->>'enabled' is distinct from 'true' or answer->>'version' is distinct from '1' then raise exception 'Publish failed';end if;
 -- Refresh must retain token and require a matching version.
 answer:=public.ggc_manage_public_share('qa-beta12-comp','refresh',null,'{"visibleThrough":18,"provisional":false,"rows":[{"memberIds":["qa-beta12-member"],"result":"37 pts","complete":18}]}',1);
 if answer->>'version' is distinct from '2' then raise exception 'Refresh failed';end if;
 begin perform public.ggc_manage_public_share('qa-beta12-comp','revoke',null,null,1);raise exception 'Stale version accepted';exception when raise_exception then if sqlerrm not like 'GGC_SHARE_CONFLICT%' then raise;end if;end;
end $$;

set local role service_role;
do $$declare source jsonb;answer jsonb;begin
 source:=public.ggc_public_leaderboard_source(repeat('a',64));
 if source->>'competitionId' is distinct from 'qa-beta12-comp' or jsonb_array_length(source->'records')<3 then raise exception 'Service source missing';end if;
 update public.ggc_records set version=version+1 where kind='comps' and record_id='qa-beta12-comp';
 begin perform public.ggc_commit_public_leaderboard(repeat('a',64),source->>'sourceVersion','{"visibleThrough":18,"provisional":false,"rows":[]}');raise exception 'Stale source committed';exception when raise_exception then if sqlerrm is distinct from 'GGC_PUBLIC_SOURCE_CHANGED' then raise;end if;end;
 source:=public.ggc_public_leaderboard_source(repeat('a',64));
 answer:=public.ggc_commit_public_leaderboard(repeat('a',64),source->>'sourceVersion','{"visibleThrough":18,"provisional":false,"rows":[{"memberIds":["qa-beta12-member"],"result":"37 pts","complete":18,"totalHoles":18}]}');
 if answer->'rows'->0->>'result' is distinct from '37 pts' then raise exception 'Service commit failed';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','b1200000-0000-4000-8000-000000000002',true);
do $$begin
 begin perform public.ggc_manage_public_share('qa-beta12-comp','revoke',null,null,2);raise exception 'Member managed share';exception when raise_exception then if sqlerrm is distinct from 'GGC_GROUP_ADMIN_REQUIRED' then raise;end if;end;
 if not public.ggc_public_identity(null) then raise exception 'Names are not enabled by default';end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$declare answer jsonb;begin
 answer:=public.get_public_leaderboard(repeat('a',64));
 if answer->'rows'->0->>'name' is distinct from 'QA Private Name' or answer->'rows'->0->>'result' is distinct from '37 pts' then raise exception 'Default name/result wrong: %',answer;end if;
 if answer::text ~ 'secret|must-drop|memberIds|competition_id|group_id|token_hash' then raise exception 'Private data exposed';end if;
 if public.get_public_leaderboard('bad') is not null or public.get_public_leaderboard(repeat('c',64)) is not null then raise exception 'Invalid token accepted';end if;
 begin perform public.ggc_public_leaderboard_source(repeat('a',64));raise exception 'Anonymous source access allowed';exception when insufficient_privilege then null;end;
 begin perform 1 from public.ggc_public_shares;raise exception 'Direct table read allowed';exception when insufficient_privilege then null;end;
 begin perform public.ggc_manage_public_share('qa-beta12-comp','revoke',null,null,2);raise exception 'Anonymous manage allowed';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','b1200000-0000-4000-8000-000000000001',true);
update public.ggc_records set data=jsonb_set(data,'{publicLeaderboardsEnabled}','false'::jsonb),version=version+1 where kind='societies' and record_id='qa-beta12-group';
select public.ggc_public_identity(true);
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin if public.get_public_leaderboard(repeat('a',64)) is not null then raise exception 'Disabled group still publicly readable';end if;end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','b1200000-0000-4000-8000-000000000001',true);
update public.ggc_records set data=jsonb_set(data,'{publicLeaderboardsEnabled}','true'::jsonb),version=version+1 where kind='societies' and record_id='qa-beta12-group';
select public.ggc_public_identity(true);
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin if public.get_public_leaderboard(repeat('a',64))->'rows'->0->>'name' is distinct from 'QA Private Name' then raise exception 'Opt in failed';end if;end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','b1200000-0000-4000-8000-000000000002',true);
select public.ggc_public_identity(false);
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin if public.get_public_leaderboard(repeat('a',64))->'rows'->0->>'name' is distinct from 'Anonymous golfer 1' then raise exception 'Opt out not immediate';end if;end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','b1200000-0000-4000-8000-000000000001',true);
select public.ggc_manage_public_share('qa-beta12-comp','rotate',encode(extensions.digest(repeat('b',64),'sha256'),'hex'),'{"visibleThrough":18,"provisional":false,"rows":[]}',2);
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin if public.get_public_leaderboard(repeat('a',64)) is not null or public.get_public_leaderboard(repeat('b',64)) is null then raise exception 'Rotation failed';end if;end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','b1200000-0000-4000-8000-000000000001',true);
select public.ggc_manage_public_share('qa-beta12-comp','revoke',null,null,3);
-- An automatic refresh cannot re-enable a revoked link.
do $$begin
 begin perform public.ggc_manage_public_share('qa-beta12-comp','refresh',null,'{"visibleThrough":18,"provisional":false,"rows":[]}',4);raise exception 'Refresh re-enabled revoked link';exception when raise_exception then if sqlerrm is distinct from 'GGC_SHARE_DISABLED' then raise;end if;end;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin if public.get_public_leaderboard(repeat('b',64)) is not null then raise exception 'Revocation failed';end if;end $$;
reset role;
rollback;
select 'Public leaderboard role, privacy, rotation, refresh, conflict and revocation checks passed; fixtures rolled back' as result;
