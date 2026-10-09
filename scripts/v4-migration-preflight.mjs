// Dry-run only: read a JSON export and report unresolved references.
// Usage: node scripts/v4-migration-preflight.mjs path/to/backup.json
import fs from 'node:fs';
const file=process.argv[2];
if(!file){console.error('Usage: node scripts/v4-migration-preflight.mjs backup.json');process.exit(2)}
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const state=raw.payload??raw;
const players=state.players??[], groups=state.societies??[];
const ids=new Set(players.map(p=>String(p.id)));
const groupIds=new Set(groups.map(g=>String(g.id)));
const issues=[];
if(ids.size!==players.length)issues.push({type:'duplicate_golfer_ids',count:players.length-ids.size});
if(groupIds.size!==groups.length)issues.push({type:'duplicate_group_ids',count:groups.length-groupIds.size});
for(const g of groups){
 for(const memberId of g.members??[]){
  if(!ids.has(String(memberId)))issues.push({type:'unresolved_member',groupId:g.id,golferId:memberId});
 }
 for(const adminId of g.admins??[]){
  if(!ids.has(String(adminId)))issues.push({type:'unresolved_admin',groupId:g.id,golferId:adminId});
 }
}
const result={golfers:players.length,groups:groups.length,competitions:(state.comps??[]).length,cards:(state.cards??[]).length,issues,ready:issues.length===0};
console.log(JSON.stringify(result,null,2));
if(!result.ready)process.exitCode=1;
