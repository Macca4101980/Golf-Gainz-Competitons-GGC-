import test from 'node:test';
import assert from 'node:assert/strict';
import {planV4Migration} from '../scripts/v4-migration-plan.mjs';

function makeFixture(){
 const names=['Aaron','Dave Malings','Fatty','James Woolgrove','Jonesy','Kev Collins','Summy'];
 const players=names.flatMap((name,i)=>[
  {id:'wl-'+i,name,placeholder:true,unclaimed:true},
  {id:'registered-'+i,name,placeholder:false,authUserId:'auth-'+i}
 ]);
 const societies=[
  {id:'wl25',name:'Winter League 25/26',members:names.slice(0,5).map((_,i)=>'wl-'+i),admins:['wl-3']},
  {id:'wl26',name:'Winter League 26/27',members:names.map((_,i)=>'wl-'+i),admins:['wl-3']},
  {id:'test',name:'Test Group',members:['missing-golfer']}
 ];
 return {players,societies,comps:[{id:'competition',name:'Historic competition'}],cards:[{id:'scorecard',playerId:'wl-3',points:42}],leagues:[{id:'league'}]};
}
test('seven same-name pairs remain fourteen separate identities until verified',()=>{
 const f=makeFixture();const p=planV4Migration(f);
 assert.equal(p.golfers.length,14);
 assert.equal(p.golfers.filter(x=>x.auth_user_id).length,7);
 assert.equal(p.golfers.filter(x=>x.placeholder).length,7);
 assert.equal(p.issues.length,1);
 assert.equal(p.issues[0].golferId,'missing-golfer');
});
test('historical league, competition and scorecard remain unchanged by planning',()=>{
 const f=makeFixture(),original=structuredClone(f);
 const p=planV4Migration(f);
 assert.deepEqual(f,original);
 assert.deepEqual(p.preserved,{competitions:1,cards:1,leagues:1});
});
test('admin membership is preserved and deduplicated for James',()=>{
 const p=planV4Migration(makeFixture());
 assert.deepEqual(p.memberships.filter(x=>x.golfer_id==='wl-3').map(x=>[x.group_id,x.role]),[['wl25','admin'],['wl26','admin']]);
});
test('migration is blocked until all orphan references are resolved',()=>{
 const p=planV4Migration(makeFixture());
 assert.equal(p.ready,false);
 assert.equal(p.issues.some(x=>x.type==='unresolved_reference'),true);
});
