import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import {parseSync} from 'rolldown/utils';

const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261021154500_allow_member_competition_participation.sql',import.meta.url),'utf8');

test('ordinary members keep competition pair definitions unchanged when starting a card',()=>{
 const parsed=parseSync('main.jsx',main,{lang:'jsx'});
 assert.deepEqual(parsed.errors,[]);
 const guards=[];
 function visit(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='IfStatement'&&node.consequent?.type==='BlockStatement'&&node.consequent.body.some(s=>s.type==='ExpressionStatement'&&s.expression?.type==='AssignmentExpression'&&s.expression.left?.name==='pairs'))guards.push(node.test);
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
 }
 visit(parsed.program);
 assert.equal(guards.length,1,'pair reassignment must have one explicit permission guard');
 const guard=guards[0];
 const mayChangePairs=new Function('admin','pairFormat','fixedLeagueTeams','ids',`return (${main.slice(guard.start,guard.end)});`);
 for(const admin of [false,true])for(const pairFormat of [false,true])for(const fixedLeagueTeams of [false,true])for(const size of [1,2,4]){
  assert.equal(mayChangePairs(admin,pairFormat,fixedLeagueTeams,Array(size).fill('golfer')),admin&&pairFormat&&!fixedLeagueTeams&&size>=2,
   `admin=${admin}, pairs=${pairFormat}, fixed League teams=${fixedLeagueTeams}, golfers=${size}`);
 }
 assert.match(main,/pairs=\(c\.pairs\|\|\[\]\)\.filter\(pair=>!\(pair\.ids\|\|\[\]\)\.some\(id=>selected\.has\(id\)\)\)/);
});

test('member competition updates are restricted to entry, invite and own round-group fields',()=>{
 assert.match(migration,/current_data-array\['entries','invites','roundGroups'\]/);
 assert.match(migration,/Existing entrants cannot be removed/);
 assert.match(migration,/not e=any\(myplayerids\)/);
 assert.match(migration,/preserve every playing group that does not contain them/);
 assert.match(migration,/not coalesce\(old_group->'playerIds' \?\| myplayerids,false\)/);
 assert.match(migration,/No golfer can be placed in two live groups/);
});

test('RLS and both versioned write RPCs use the same transition guard',()=>{
 assert.match(migration,/using \(private\.ggc_can_update_record\(kind,record_id,data,owner_id\)\)/);
 assert.match(migration,/with check \(private\.ggc_can_update_record\(kind,record_id,data,owner_id\)\)/);
 assert.equal((migration.match(/private\.ggc_can_update_record\(p_kind,p_id/g)||[]).length,2);
 assert.match(migration,/security definer/);
 assert.match(migration,/revoke all on function private\.ggc_can_update_record/);
});
