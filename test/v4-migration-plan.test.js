import test from 'node:test';
import assert from 'node:assert/strict';
import {planV4Migration} from '../scripts/v4-migration-plan.mjs';
test('deduplicates overlapping membership roles and retains highest privilege',()=>{
 const p=planV4Migration({players:[{id:'a',name:'Alice'}],societies:[{id:'g',name:'Golf',members:['a','a'],admins:['a'],ownerId:'a'}],cards:[{id:'c'}],leagues:[{id:'l'}]});
 assert.equal(p.ready,true);assert.equal(p.memberships.length,1);assert.equal(p.memberships[0].role,'owner');
 assert.deepEqual(p.preserved,{competitions:0,cards:1,leagues:1});
});
test('quarantines missing golfer references instead of fabricating or dropping identities silently',()=>{
 const p=planV4Migration({players:[{id:'a',name:'Alice'}],societies:[{id:'g',name:'Golf',members:['missing'],admins:['a']}]});
 assert.equal(p.ready,false);assert.equal(p.issues.length,1);assert.equal(p.issues[0].golferId,'missing');
 assert.equal(p.memberships.length,1);
});
test('keeps same-name registered and placeholder golfers separate',()=>{
 const p=planV4Migration({players:[{id:'old',name:'James',placeholder:true},{id:'new',name:'James',authUserId:'123'}],societies:[]});
 assert.equal(p.ready,true);assert.equal(p.golfers.length,2);assert.equal(p.golfers[0].id,'old');assert.equal(p.golfers[1].id,'new');
});
test('does not mutate input or historical data',()=>{
 const s={players:[{id:'a',name:'Alice'}],societies:[],cards:[{id:'c',points:40}]};
 const before=JSON.stringify(s);planV4Migration(s);assert.equal(JSON.stringify(s),before);
});

test('refuses duplicate group IDs even if duplicate is in excluded test group',()=>{
 const state={players:[{id:'a',name:'Alice'}],societies:[{id:'g',name:'Active',members:['a']},{id:'g',name:'Teat'}]};
 const plan=planV4Migration(state,{excludedGroupIds:['g']});
 assert.equal(plan.ready,false);
 assert.ok(plan.issues.some(issue=>issue.type==='duplicate_group_ids'));
});
test('normalizes numeric excluded group IDs to strings',()=>{
 const state={players:[],societies:[{id:42,name:'Teat'}]};
 const plan=planV4Migration(state,{excludedGroupIds:[42]});
 assert.equal(plan.ready,true);
 assert.equal(plan.groups.length,0);
 assert.equal(plan.excludedGroups.length,1);
});
