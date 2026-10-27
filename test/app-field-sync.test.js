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

function readClient(initial){
 const api={reads:0,writes:0,fail:false,
  from(){let kind;return {select(){return this},eq(_key,value){kind=value;return this},order(){return this},async range(){api.reads++;if(api.fail)return {data:null,error:Error('offline')};return {data:(initial[kind]||[]).map(data=>({record_id:data.id,data,version:3,deleted:false})),error:null}}}},
  async rpc(){api.writes++;throw Error('Startup must not write any records')}
 };return api;
}

const {createAppRecordSession}=await import('../src/appRecordSync.js');

test('record startup reads real groups without importing hidden default IDs or stale settings',async()=>{
 const client=readClient({societies:[{id:'real-group',name:'Winter League'}],appFields:[{id:'user:u1:setting:theme',scope:'user',userId:'u1',field:'setting',subjectId:'theme',value:'dark'}]});
 const session=createAppRecordSession(client);
 const local={societies:[{id:'default-society'}],courses:[{id:'harlestone'}],settings:{adminPin:'stale'},contacts:{other:['private']},oom:{other:{bestCount:5}},deletedSocietyIds:['real-group']};
 const before=structuredClone(local);
 const result=await session.load(local,{userId:'u1'});
 assert.deepEqual(result.snapshot.societies,[{id:'real-group',name:'Winter League'}]);
 assert.deepEqual(result.snapshot.courses,[]);
 assert.deepEqual(result.snapshot.settings,{theme:'dark'});
 assert.deepEqual(result.snapshot.contacts,{});
 assert.deepEqual(result.snapshot.oom,{});
 assert.deepEqual(result.snapshot.deletedSocietyIds,[]);
 assert.deepEqual(local,before);
 assert.equal(client.writes,0);
 assert.equal(session.store.getVersion('societies','real-group'),3);
});

test('concurrent startup and token refresh share one load and preserve pending local changes',async()=>{
 const client=readClient({players:[{id:'p1',name:'Original'}]});
 const session=createAppRecordSession(client);
 const [a,b]=await Promise.all([session.load({}, {userId:'u1'}),session.load({}, {userId:'u1'})]);
 assert.equal(client.reads,9);
 a.snapshot.players[0].name='Local edit';
 assert.equal(b.snapshot.players[0].name,'Original');
 const desired=structuredClone(session.coordinator.getBaseline());desired.players[0].name='Pending edit';
 await assert.rejects(session.coordinator.enqueue(desired),/Startup must not write/);
 await session.load({}, {userId:'u1'});
 assert.equal(client.reads,9);
 assert.equal(session.coordinator.getDesired().players[0].name,'Pending edit');
 const other=createAppRecordSession(readClient({players:[{id:'p2',name:'Other'}]}));
 await other.load({}, {userId:'u2'});
 assert.equal(other.store.getVersion('players','p1'),null);
 assert.equal(other.coordinator.getBaseline().players[0].id,'p2');
});

test('failed startup leaves coordinator uninitialized and permits a read-only retry',async()=>{
 const client=readClient({societies:[{id:'s1'}]});client.fail=true;
 const session=createAppRecordSession(client);
 await assert.rejects(session.load({societies:[{id:'local'}]}),/offline/);
 assert.equal(session.coordinator.isInitialized(),false);
 assert.equal(client.writes,0);
 client.fail=false;
 const result=await session.load({societies:[{id:'local'}]});
 assert.equal(result.snapshot.societies[0].id,'s1');
 assert.equal(session.coordinator.isInitialized(),true);
 assert.equal(client.writes,0);
});
