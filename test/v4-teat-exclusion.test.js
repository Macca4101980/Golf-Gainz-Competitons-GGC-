import test from 'node:test';import assert from 'node:assert/strict';import {planV4Migration} from '../scripts/v4-migration-plan.mjs';
const gid='75eea654-ebc2-4e8a-8479-0acaa8a91c2d';
const missing='d68bac83-dcd4-4f36-acfb-df859c2a34cc';
const state={players:[{id:'good',name:'Golfer'}],societies:[{id:'keep',name:'Winter League',members:['good']},{id:gid,name:'Teat',ownerId:missing,members:[missing],admins:[missing]}],comps:[{id:'test-comp',groupId:gid}],cards:[{id:'test-card'}],leagues:[{id:'wl'}]};
test('missing Teat owner blocks migration without explicit exclusion',()=>{const p=planV4Migration(state);assert.equal(p.ready,false);assert.equal(p.issues[0].type,'unresolved_reference')});
test('explicit exclusion removes only Teat from normalized memberships, retaining other records',()=>{const original=structuredClone(state);const p=planV4Migration(state,{excludedGroupIds:[gid]});assert.equal(p.ready,true);assert.deepEqual(p.excludedGroups,[{id:gid,name:'Teat'}]);assert.deepEqual(p.groups,[{id:'keep',name:'Winter League'}]);assert.equal(p.memberships.length,1);assert.equal(p.preserved.competitions,1);assert.equal(p.preserved.cards,1);assert.deepEqual(state,original)});
