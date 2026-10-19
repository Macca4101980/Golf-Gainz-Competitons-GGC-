import test from 'node:test';
import assert from 'node:assert/strict';
import {toRecordSnapshot,mergeRecordSnapshotIntoAppState} from '../src/recordModel.js';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';
import {planRecordChanges,RECORD_COLLECTIONS} from '../src/recordChanges.js';
import {createRecordStore} from '../src/recordStore.js';

function mockStore(initial){
 const records=new Map(),versions=new Map(),writes=[];let rejectNext=false;
 for(const [kind,items] of Object.entries(initial))for(const item of items||[]){records.set(kind+':'+item.id,structuredClone(item));versions.set(kind+':'+item.id,1)}
 return {
  writes,
  setRemote(kind,id,data,version){records.set(kind+':'+id,structuredClone(data));versions.set(kind+':'+id,version)},
  hasBaseline:(kind,id)=>versions.has(kind+':'+id),
  async load(kind,id){const key=kind+':'+id;return structuredClone(records.get(key)||null)},
  async loadAll(kinds){return Object.fromEntries(kinds.map(kind=>[kind,[...records.entries()].filter(([key])=>key.startsWith(kind+':')).map(([,value])=>structuredClone(value))]))},
  rejectNextSave(){rejectNext=true},
  async save(kind,id,data,{deleted=false}={}){const key=kind+':'+id;writes.push({kind,id,data:structuredClone(data),deleted,fields:null});if(rejectNext){rejectNext=false;throw Error('GGC_VERSION_CONFLICT')}const version=(versions.get(key)||0)+1;versions.set(key,version);if(deleted)records.delete(key);else records.set(key,structuredClone(data));return version},
  async saveFields(kind,id,data,fields,{deleted=false}={}){const key=kind+':'+id,patch=Object.fromEntries(fields.map(field=>[field,structuredClone(data[field])]));writes.push({kind,id,data:patch,deleted,fields:[...fields]});if(rejectNext){rejectNext=false;throw Error('GGC_VERSION_CONFLICT')}const version=(versions.get(key)||0)+1;versions.set(key,version);if(deleted)records.delete(key);else records.set(key,{...records.get(key),...patch});return version},
 };
}

test('all persistent collections are on the record-level path',()=>{
 for(const kind of ['players','societies','comps','cards','leagues','courses','audit','societyInvites','appFields'])assert.ok(RECORD_COLLECTIONS.includes(kind));
 const changes=planRecordChanges({players:[{id:'p1',name:'A',hi:4}],cards:[{id:'c1',gross:[4]}]},{players:[{id:'p1',name:'A',hi:5}],cards:[{id:'c1',gross:[4]}]});
 assert.deepEqual(changes.map(({kind,id})=>({kind,id})),[{kind:'players',id:'p1'}]);
});

test('one changed control sends only that field to the record patch RPC',async()=>{
 const initial={players:[{id:'p1',name:'A',hi:4}],societies:[],comps:[],cards:[],leagues:[],courses:[],audit:[],societyInvites:[],appFields:[]};
 const store=mockStore(initial),coordinator=createRecordSaveCoordinator(store);coordinator.initialize(initial);
 const changed=structuredClone(initial);changed.players[0].hi=5;
 await coordinator.enqueue(changed);
 assert.deepEqual(store.writes[0].fields,['hi']);
 assert.deepEqual(store.writes[0].data,{hi:5});
});

test('record store sends only the changed field with the expected version',async()=>{
 let call;
 const store=createRecordStore({rpc:async(name,args)=>{call={name,args};return {data:8,error:null}}});
 store.seedVersions([{kind:'players',id:'p1',version:7}]);
 await store.saveFields('players','p1',{id:'p1',name:'A',hi:5},['hi']);
 assert.equal(call.name,'ggc_patch_record');
 assert.deepEqual(call.args,{p_kind:'players',p_id:'p1',p_patch:{hi:5},p_fields:['hi'],p_expected_version:7,p_deleted:false});
});

test('root controls become independent field records and round-trip without an app snapshot write',()=>{
 const state={players:[{id:'p1',name:'A'}],societies:[{id:'s1'}],oom:{s1:{bestCount:8,mode:'position'}},settings:{adminPin:'1234',theme:'dark'},contacts:{p1:['p2']},hiddenContacts:{p1:['p3']},currentSocietyId:'s1'};
 const records=toRecordSnapshot(state,{userId:'u1',mayAdministerSociety:()=>true});
 assert.equal(records.appFields.find(x=>x.field==='setting'&&x.subjectId==='adminPin').value,'1234');
 assert.equal(records.appFields.find(x=>x.field==='oom'&&x.subjectId==='bestCount').value,8);
 const changed=structuredClone(state);changed.settings.theme='light';
 const after=toRecordSnapshot(changed,{userId:'u1',mayAdministerSociety:()=>true});
 const changes=planRecordChanges(records,after);
 assert.deepEqual(changes.map(x=>x.id),['user:u1:setting:theme']);
 const roundTrip=mergeRecordSnapshotIntoAppState(state,records,{userId:'u1'});
 assert.equal(roundTrip.settings.adminPin,'1234');
 assert.equal(roundTrip.oom.s1.bestCount,8);
 assert.deepEqual(roundTrip.contacts.p1,['p2']);
});

test('a remote edit to another field is merged and the pending local field is saved alone',async()=>{
 const initial={players:[{id:'p1',name:'Old',hi:4}],societies:[],comps:[],cards:[],leagues:[],courses:[],audit:[],societyInvites:[],appFields:[]};
 const store=mockStore(initial),coordinator=createRecordSaveCoordinator(store);coordinator.initialize(initial);
 const local=structuredClone(initial);local.players[0].name='Local name';store.rejectNextSave();
 await assert.rejects(coordinator.enqueue(local),/GGC_VERSION_CONFLICT/);
 const remote={id:'p1',name:'Old',hi:5};store.setRemote('players','p1',remote,2);
 const result=await coordinator.recoverVersionConflict(local);
 assert.deepEqual(result.conflicts,[]);
 const merged=result.snapshot;
 assert.equal(merged.players[0].name,'Local name');
 assert.equal(merged.players[0].hi,5);
 await coordinator.enqueue(merged);
 assert.equal(store.writes.length,2);
 assert.deepEqual(store.writes[1].fields,['name']);
 assert.deepEqual(store.writes[1].data,{name:'Local name'});
 assert.deepEqual(await store.load('players','p1'),{id:'p1',name:'Local name',hi:5});
});

test('same-field edits are surfaced as conflicts without replacing either value',async()=>{
 const initial={players:[{id:'p1',name:'Old',hi:4}],societies:[],comps:[],cards:[],leagues:[],courses:[],audit:[],societyInvites:[],appFields:[]};
 const store=mockStore(initial),coordinator=createRecordSaveCoordinator(store);coordinator.initialize(initial);
 const local=structuredClone(initial);local.players[0].name='Local name';store.rejectNextSave();
 await assert.rejects(coordinator.enqueue(local),/GGC_VERSION_CONFLICT/);
 store.setRemote('players','p1',{id:'p1',name:'Remote name',hi:4},3);
 const result=await coordinator.recoverVersionConflict(local);
 assert.deepEqual(result.conflicts,['players/p1/name']);
 assert.equal(coordinator.getDesired().players[0].name,'Local name');
 assert.equal((await store.load('players','p1')).name,'Remote name');
});
