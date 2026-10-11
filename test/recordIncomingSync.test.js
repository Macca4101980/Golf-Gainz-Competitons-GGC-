import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';
const kinds=['players','societies','comps','cards','leagues','courses'];
const snapshot=name=>Object.fromEntries(kinds.map(k=>[k,k==='players'?[{id:'p1',name,hi:28}]:[]]));
function mockStore(){let cloud=snapshot('Mickey Mouse');let versions=new Map([['players:p1',9]]);return {setCloud:name=>{cloud=snapshot(name);versions.set('players:p1',10)},loadAll:async(_,{commitVersions=true}={})=>commitVersions?structuredClone(cloud):{records:structuredClone(cloud),versions:new Map(versions)},commitLoadedVersions:()=>{},load:async(kind,id)=>kind==='players'&&id==='p1'?structuredClone(cloud.players[0]):null,hasBaseline:()=>true,save:async()=>11};}
test('cloud reconciliation receives iPhone name change on laptop',async()=>{const store=mockStore();const coordinator=createRecordSaveCoordinator(store);coordinator.initialize(snapshot('Mickey Mouse'));store.setCloud('John Wick');const next=await coordinator.catchUpFromCloud();assert.equal(next.players[0].name,'John Wick');});
test('unacknowledged local edits block unsafe replacement',async()=>{const store=mockStore();const coordinator=createRecordSaveCoordinator(store);coordinator.initialize(snapshot('Mickey Mouse'));coordinator.enqueue(snapshot('Locally edited'));store.setCloud('John Wick');const next=await coordinator.catchUpFromCloud();assert.equal(next,null);});
