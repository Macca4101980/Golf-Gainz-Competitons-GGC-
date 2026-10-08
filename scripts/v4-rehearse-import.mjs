// Isolated PostgreSQL only. Never use against a production database.
// Usage: GGC_V4_TEST_DATABASE=1 DATABASE_URL=... node scripts/v4-rehearse-import.mjs snapshot.json
import fs from 'node:fs';
import pg from 'pg';
import {planV4Migration} from './v4-migration-plan.mjs';
import {planV4ScorecardMigration} from './v4-scorecard-migration-plan.mjs';
const file=process.argv[2];
if(!file||process.env.GGC_V4_TEST_DATABASE!=='1'||!process.env.DATABASE_URL){
 console.error('Requires snapshot file, DATABASE_URL and GGC_V4_TEST_DATABASE=1');process.exit(2);
}
const url=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1','::1'].includes(url.hostname)){
 console.error('Refusing non-local database host');process.exit(2);
}
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const state=raw.payload??raw;
const excludedGroupIds=(process.env.GGC_V4_EXCLUDED_GROUP_IDS??'').split(',').map(x=>x.trim()).filter(Boolean);
const plan=planV4Migration(state,{excludedGroupIds});
const scorePlan=planV4ScorecardMigration(state,{excludedGroupIds});
const report={ready:plan.ready&&scorePlan.ready,excludedGroups:plan.excludedGroups,excludedScorecards:scorePlan.excludedCards,issues:[...plan.issues,...scorePlan.issues],counts:{golfers:plan.golfers.length,groups:plan.groups.length,memberships:plan.memberships.length,competitionScopes:scorePlan.scope.length,scorecards:scorePlan.cards.length,...plan.preserved}};
if(!report.ready){console.log(JSON.stringify(report,null,2));process.exit(1);}
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try{
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
 const counts=await client.query("select (select count(*)::int from public.ggc_golfers) golfers,(select count(*)::int from public.ggc_groups) groups,(select count(*)::int from public.ggc_memberships) memberships,(select count(*)::int from public.ggc_competition_scope_v4) competition_scopes,(select count(*)::int from public.ggc_scorecards_v4) scorecards");
 for(const k of ['golfers','groups','memberships','competitionScopes','scorecards']){
  if(counts.rows[0][k==='competitionScopes'?'competition_scopes':k]!==report.counts[k])throw Error('Count mismatch: '+k);
 }
 // A rehearsal is always rolled back. No live state is changed or stored.
 await client.query('rollback');
 console.log(JSON.stringify({...report,transaction:'ROLLED_BACK',databaseCounts:counts.rows[0]},null,2));
}catch(e){await client.query('rollback');throw e;}finally{await client.end();}
