// Isolated PostgreSQL only. Never use against a production database.
// Usage: GGC_V4_TEST_DATABASE=1 DATABASE_URL=... node scripts/v4-rehearse-import.mjs snapshot.json
import fs from 'node:fs';
import pg from 'pg';
import {planV4Migration} from './v4-migration-plan.mjs';
import {planV4ScorecardMigration} from './v4-scorecard-migration-plan.mjs';
function sortJson(value){
 if(Array.isArray(value))return value.map(sortJson);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sortJson(value[key])]));
 return value;
}
const file=process.argv[2];
if(!file||process.env.GGC_V4_TEST_DATABASE!=='1'||!process.env.DATABASE_URL){
 console.error('Requires snapshot file, DATABASE_URL and GGC_V4_TEST_DATABASE=1');process.exit(2);
}
const url=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1','::1'].includes(url.hostname)){
 console.error('Refusing non-local database host');process.exit(2);
}
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
// A production backup export may be a single row or an array containing one row.
const snapshot=Array.isArray(raw)?(raw.length===1?raw[0]:null):raw;
if(!snapshot||typeof snapshot!=='object'){
 console.error('Refusing rehearsal: expected one backup snapshot object');process.exit(2);
}
const state=snapshot.payload??snapshot;
if(!state||typeof state!=='object'||Array.isArray(state)||!Array.isArray(state.players)||!Array.isArray(state.societies)||!Array.isArray(state.comps)||!Array.isArray(state.cards)){
 console.error('Refusing rehearsal: snapshot missing required players, societies, comps or cards arrays');process.exit(2);
}
const excludedGroupIds=(process.env.GGC_V4_EXCLUDED_GROUP_IDS??'').split(',').map(x=>x.trim()).filter(Boolean);
const requestedExclusions=new Set(excludedGroupIds);
const matchedExclusions=new Set((state.societies??[]).filter(g=>requestedExclusions.has(String(g.id))).map(g=>String(g.id)));
const missingExclusions=excludedGroupIds.filter(id=>!matchedExclusions.has(id));
if(missingExclusions.length){
 console.error('Refusing rehearsal: excluded group IDs not found in snapshot: '+missingExclusions.join(','));
 process.exit(2);
}
const plan=planV4Migration(state,{excludedGroupIds});
const scorePlan=planV4ScorecardMigration(state,{excludedGroupIds});
const report={ready:plan.ready&&scorePlan.ready,excludedGroups:plan.excludedGroups,excludedScorecards:scorePlan.excludedCards,issues:[...plan.issues,...scorePlan.issues],counts:{golfers:plan.golfers.length,groups:plan.groups.length,memberships:plan.memberships.length,competitionScopes:scorePlan.scope.length,scorecards:scorePlan.cards.length,...plan.preserved}};
// Optional explicit count gate for a known protected backup. Never infer expected totals.
const expectedCountsRaw=process.env.GGC_V4_EXPECTED_COUNTS;
if(expectedCountsRaw){
 let expectedCounts;
 try{expectedCounts=JSON.parse(expectedCountsRaw);}catch{console.error('Invalid GGC_V4_EXPECTED_COUNTS JSON');process.exit(2);}
 const keys=['golfers','groups','memberships','competitionScopes','scorecards'];
 if(!expectedCounts||Array.isArray(expectedCounts)||typeof expectedCounts!=='object'
  ||keys.some(k=>!Number.isSafeInteger(expectedCounts[k])||expectedCounts[k]<0)){
  console.error('GGC_V4_EXPECTED_COUNTS requires nonnegative integer golfers, groups, memberships, competitionScopes and scorecards');
  process.exit(2);
 }
 const mismatches=keys.filter(k=>report.counts[k]!==expectedCounts[k]);
 if(mismatches.length){
  console.error('Refusing rehearsal: snapshot count mismatch for '+mismatches.join(', '));
  process.exit(1);
 }
}
if(!report.ready){console.log(JSON.stringify(report,null,2));process.exit(1);}
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try{
 // Fail closed on a reused or populated local database. Never mix a rehearsal with existing records.
 const preflight=await client.query("select (select count(*)::int from public.ggc_golfers) golfers,(select count(*)::int from public.ggc_groups) groups,(select count(*)::int from public.ggc_memberships) memberships,(select count(*)::int from public.ggc_competition_scope_v4) competition_scopes,(select count(*)::int from public.ggc_scorecards_v4) scorecards");
 if(Object.values(preflight.rows[0]).some(n=>n!==0))throw Error('Refusing rehearsal: local V4 target tables are not empty');
 await client.query('begin');
 for(const g of plan.golfers){
  await client.query('insert into public.ggc_golfers(id,display_name,placeholder) values($1,$2,$3)',[g.id,g.display_name,g.placeholder]);
 }
 for(const g of plan.groups){
  await client.query('insert into public.ggc_groups(id,name) values($1,$2)',[g.id,g.name]);
 }
 for(const m of plan.memberships){
  await client.query('insert into public.ggc_memberships(group_id,golfer_id,role,status) values($1,$2,$3,$4)',[m.group_id,m.golfer_id,m.role,m.status]);
 }
 for(const scope of scorePlan.scope){
  await client.query('insert into public.ggc_competition_scope_v4(comp_id,group_id) values($1,$2)',[scope.comp_id,scope.group_id]);
 }
 for(const card of scorePlan.cards){
  await client.query('insert into public.ggc_scorecards_v4(id,comp_id,group_id,golfer_id,card,revision) values($1,$2,$3,$4,$5::jsonb,$6)',[card.id,card.comp_id,card.group_id,card.golfer_id,JSON.stringify(card.card),card.revision]);
 }
 // Verify the normalized records themselves, not only aggregate counts.
 const storedGolfers=await client.query('select id,display_name,placeholder from public.ggc_golfers order by id');
 const storedGroups=await client.query('select id,name from public.ggc_groups order by id');
 const storedMemberships=await client.query('select group_id,golfer_id,role,status from public.ggc_memberships order by group_id,golfer_id');
 const storedScopes=await client.query('select comp_id,group_id from public.ggc_competition_scope_v4 order by comp_id');
 const verifyRows=(actual,expected,label)=>{
  const stable=rows=>JSON.stringify(rows.map(sortJson).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  if(stable(actual)!==stable(expected))throw Error('Migrated '+label+' content mismatch');
 };
 verifyRows(storedGolfers.rows,plan.golfers.map(g=>({id:g.id,display_name:g.display_name,placeholder:g.placeholder})),'golfers');
 verifyRows(storedGroups.rows,plan.groups,'groups');
 verifyRows(storedMemberships.rows,plan.memberships,'memberships');
 verifyRows(storedScopes.rows,scorePlan.scope,'competition scopes');
 const counts=await client.query("select (select count(*)::int from public.ggc_golfers) golfers,(select count(*)::int from public.ggc_groups) groups,(select count(*)::int from public.ggc_memberships) memberships,(select count(*)::int from public.ggc_competition_scope_v4) competition_scopes,(select count(*)::int from public.ggc_scorecards_v4) scorecards");
 for(const k of ['golfers','groups','memberships','competitionScopes','scorecards']){
  if(counts.rows[0][k==='competitionScopes'?'competition_scopes':k]!==report.counts[k])throw Error('Count mismatch: '+k);
 }
 // Verify each stored card's identity and complete JSON content, not just row totals.
 // This catches a successful-looking migration that silently changed a golfer's scores.
 const storedCards=await client.query('select id,comp_id,group_id,golfer_id,revision,card from public.ggc_scorecards_v4 order by id');
 const expectedCards=new Map(scorePlan.cards.map(card=>[card.id,card]));
 if(storedCards.rows.length!==expectedCards.size)throw Error('Scorecard row mismatch');
 for(const row of storedCards.rows){
  const expected=expectedCards.get(row.id);
  if(!expected||row.comp_id!==expected.comp_id||row.group_id!==expected.group_id
   ||row.golfer_id!==expected.golfer_id||Number(row.revision)!==expected.revision
   ||JSON.stringify(sortJson(row.card))!==JSON.stringify(sortJson(expected.card)))
   throw Error('Scorecard content mismatch: '+row.id);
 }
 // A rehearsal is always rolled back. No live state is changed or stored.
 await client.query('rollback');
 const afterRollback=await client.query("select (select count(*)::int from public.ggc_golfers) golfers,(select count(*)::int from public.ggc_groups) groups,(select count(*)::int from public.ggc_memberships) memberships,(select count(*)::int from public.ggc_competition_scope_v4) competition_scopes,(select count(*)::int from public.ggc_scorecards_v4) scorecards");
 if(Object.values(afterRollback.rows[0]).some(n=>n!==0))throw Error('Rollback verification failed: V4 tables are not empty');
 console.log(JSON.stringify({...report,transaction:'ROLLED_BACK',rollbackVerified:true,verifiedNormalizedContents:true,verifiedScorecardContents:storedCards.rows.length,databaseCounts:counts.rows[0]},null,2));
}catch(e){await client.query('rollback');throw e;}finally{await client.end();}
