import test from 'node:test';import assert from 'node:assert/strict';
import {loadV4Memberships,resolveV4Memberships} from '../src/lib/v4MembershipShadow.js';
test('disabled adapter never calls Supabase',async()=>{const result=await loadV4Memberships(null);assert.equal(result.enabled,false)});
test('requires authenticated identity when enabled',async()=>{await assert.rejects(loadV4Memberships({}, {enabled:true}),/Authenticated/)});
test('shadow data never changes legacy ownership',()=>{const groups=[{id:'a',name:'WL',ownerId:'original',members:['original']}];const before=structuredClone(groups);const result=resolveV4Memberships(groups,{enabled:true,memberships:[{group_id:'a',golfer_id:'new',role:'admin',status:'member'}]});assert.deepEqual(groups,before);assert.equal(result[0].ownerId,'original');assert.deepEqual(result[0].members,['original']);assert.equal(result[0].v4ShadowMemberships[0].golferId,'new')});
test('RPC errors fail closed',async()=>{await assert.rejects(loadV4Memberships({rpc:async()=>({error:new Error('Denied')})},{enabled:true,authUserId:'x'}),/Denied/)});
