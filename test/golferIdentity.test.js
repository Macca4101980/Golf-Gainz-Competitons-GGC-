import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileGolferIdentity} from '../src/golferIdentity.js';
const authId='uuid-registered';
const state=()=>({players:[
 {id:'wl-james',name:'James',email:'j@example.com',unclaimed:true},
 {id:authId,name:'James',email:'j@example.com',authUserId:authId}],
 societies:[{id:'group',ownerId:'wl-james',members:['wl-james'],admins:['wl-james']}],
 comps:[{id:'comp',entries:['wl-james'],invites:[],pairs:[],roundGroups:[]}],
 cards:[{id:'card',playerId:'wl-james',score:[4,3]}],
 leagues:[{id:'league',memberIds:['wl-james'],teams:[{memberIds:['wl-james']}],startingHandicaps:{'wl-james':12}}],
 contacts:{'wl-james':['friend']},hiddenContacts:{}});
test('joins an existing registered golfer with a unique email-linked historical golfer',()=>{
 const result=reconcileGolferIdentity(state(),{authId,email:'J@EXAMPLE.COM',profile:{display_name:'James'}});
 assert.equal(result.playerId,'wl-james');
 assert.equal(result.state.players.length,1);
 assert.deepEqual(result.state.societies[0].members,['wl-james']);
 assert.equal(result.state.societies[0].ownerId,'wl-james');
 assert.deepEqual(result.state.comps[0].entries,['wl-james']);
 assert.equal(result.state.cards[0].playerId,'wl-james');
 assert.deepEqual(result.state.cards[0].score,[4,3]);
 assert.equal(result.state.leagues[0].startingHandicaps['wl-james'],12);
 assert.equal(result.state.identityLinks[authId],'wl-james');
});
test('never merges a different authenticated account even with matching email',()=>{
 const s=state();s.players[0].authUserId='other-auth';
 const result=reconcileGolferIdentity(s,{authId,email:'j@example.com',profile:{display_name:'James'}});
 assert.equal(result.state.players.length,2);
 assert.equal(result.state.cards[0].playerId,'wl-james');
});
test('ambiguous email matches are not automatically merged',()=>{
 const s=state();s.players.push({id:'historic-other',email:'j@example.com',name:'J'});
 const result=reconcileGolferIdentity(s,{authId,email:'j@example.com',profile:{display_name:'James'}});
 assert.equal(result.ambiguous,true);
 assert.equal(result.state.players.length,3);
 assert.equal(result.state.cards[0].playerId,'wl-james');
});
test('same names with different emails remain separate',()=>{
 const s=state();s.players[0].email='other@example.com';
 const result=reconcileGolferIdentity(s,{authId,email:'j@example.com',profile:{display_name:'James'}});
 assert.equal(result.state.players.length,2);
});
