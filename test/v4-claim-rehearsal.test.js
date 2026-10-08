import test from 'node:test';
import assert from 'node:assert/strict';

// In-memory migration rehearsal only. Not a PostgreSQL/RLS or RPC integration test.
const snapshot={
 players:[{id:'placeholder-james',name:'James',placeholder:true},{id:'registered-james',name:'James',authUserId:'user-james',placeholder:false}],
 societies:[{id:'wl25',members:['placeholder-james']},{id:'wl26',members:['placeholder-james']}],
 cards:[{id:'historic-card',playerId:'placeholder-james',points:39}]
};
function claim(state,{oldId,newId,verified}){
 if(!verified)throw Error('proof required');
 const old=state.players.find(p=>p.id===oldId);
 const target=state.players.find(p=>p.id===newId);
 if(!old?.placeholder||!target?.authUserId)throw Error('invalid identity');
 const links={...state.links};
 if(links[oldId]&&links[oldId]!==newId)throw Error('already linked');
 links[oldId]=newId;
 return {...state,links,societies:state.societies.map(g=>({...g,members:[...new Set(g.members.map(id=>links[id]||id))]}))};
}
test('a verified claim transfers both Winter League memberships and preserves scores',()=>{
 const after=claim(snapshot,{oldId:'placeholder-james',newId:'registered-james',verified:true});
 assert.deepEqual(after.societies.map(g=>g.members),[['registered-james'],['registered-james']]);
 assert.deepEqual(after.cards,snapshot.cards);
 assert.deepEqual(snapshot.societies.map(g=>g.members),[['placeholder-james'],['placeholder-james']]);
});
test('unverified claims are refused',()=>assert.throws(()=>claim(snapshot,{oldId:'placeholder-james',newId:'registered-james',verified:false}),/proof/));
test('claim retry does not duplicate memberships',()=>{
 const once=claim(snapshot,{oldId:'placeholder-james',newId:'registered-james',verified:true});
 const twice=claim(once,{oldId:'placeholder-james',newId:'registered-james',verified:true});
 assert.deepEqual(twice.societies,once.societies);
});
test('competing claim is refused',()=>{
 const once=claim(snapshot,{oldId:'placeholder-james',newId:'registered-james',verified:true});
 assert.throws(()=>claim({...once,players:[...once.players,{id:'other',authUserId:'other-user',placeholder:false}]},{oldId:'placeholder-james',newId:'other',verified:true}),/already linked/);
});
