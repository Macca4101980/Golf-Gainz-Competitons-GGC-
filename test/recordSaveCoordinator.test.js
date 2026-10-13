import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';
test('serializes rapid edits without losing intermediate version',async()=>{
 const calls=[],store={hasBaseline(){return true},async save(kind,id,data){calls.push(data.hi);await Promise.resolve();return calls.length}};
 const c=createRecordSaveCoordinator(store);c.initialize({players:[{id:'p',hi:10}]});
 await Promise.all([c.enqueue({players:[{id:'p',hi:9}]}),c.enqueue({players:[{id:'p',hi:8}]})]);
 assert.deepEqual(calls,[8]);
});
test('failed save does not advance baseline',async()=>{
 let fails=true;const calls=[],store={hasBaseline(){return true},async save(_kind,_id,data){calls.push(data.hi);if(fails)throw Error('conflict');return 2}};
 const c=createRecordSaveCoordinator(store);c.initialize({players:[{id:'p',hi:10}]});
 await assert.rejects(c.enqueue({players:[{id:'p',hi:9}]}),/conflict/);
 fails=false;
 await c.enqueue({players:[{id:'p',hi:9}]});
 assert.deepEqual(calls,[9,9]);
});
test('cannot save without verified baseline',async()=>{
 const c=createRecordSaveCoordinator({save:async()=>1});
 await assert.rejects(c.enqueue({players:[]}),/GGC_BASELINE_REQUIRED/);
});

test('partial failure preserves first confirmed save and retries only unsaved record',async()=>{
 const calls=[];let fail=true;
 const store={hasBaseline(){return true},async save(kind,id){calls.push(id);if(id==='b'&&fail){fail=false;throw Error('network offline');}return 1;}};
 const coordinator=createRecordSaveCoordinator(store);
 coordinator.initialize({players:[{id:'a',email:null},{id:'b',email:null}]});
 const desired={players:[{id:'a',email:'a@example.com'},{id:'b',email:'b@example.com'}]};
 await assert.rejects(coordinator.enqueue(desired),/network offline/);
 assert.equal(coordinator.getBaseline().players[0].email,'a@example.com');
 assert.equal(coordinator.getBaseline().players[1].email,null);
 await coordinator.enqueue(desired);
 assert.deepEqual(calls,['a','b','b']);
 assert.equal(coordinator.getBaseline().players[1].email,'b@example.com');
});

test('two devices editing different golfers preserve both changes',async()=>{
 const cloud=new Map([['a',{id:'a',hi:10}],['b',{id:'b',hi:20}]]);
 const writes=[];
 const store={hasBaseline(){return true},async save(kind,id,data){writes.push(id);cloud.set(id,structuredClone(data));return 1;}};
 const device1=createRecordSaveCoordinator(store),device2=createRecordSaveCoordinator(store);
 const initial={players:[...cloud.values()]};
 device1.initialize(initial);device2.initialize(initial);
 await device1.enqueue({players:[{id:'a',hi:9},{id:'b',hi:20}]});
 await device2.enqueue({players:[{id:'a',hi:10},{id:'b',hi:19}]});
 assert.deepEqual(writes,['a','b']);
 assert.equal(cloud.get('a').hi,9);assert.equal(cloud.get('b').hi,19);
});


test('cloud refresh cannot replace an initialized baseline containing unsaved edits',async()=>{
 const store={hasBaseline(){return true},async save(){throw Error('offline')}};
 const coordinator=createRecordSaveCoordinator(store);
 coordinator.initialize({players:[{id:'p',hi:10}]});
 await assert.rejects(coordinator.enqueue({players:[{id:'p',hi:9}]}),/offline/);
 await assert.rejects(coordinator.initializeFromCloud({players:[{id:'p',hi:10}]}),/GGC_BASELINE_ALREADY_INITIALIZED/);
 assert.equal(coordinator.getBaseline().players[0].hi,10);
});

test('empty isolated cloud can hydrate from authoritative record rows',async()=>{
 const store={async loadAll(kinds){return Object.fromEntries(kinds.map(k=>[k,k==='players'?[{id:'cloud-player',hi:12}]:[]]));},hasBaseline(){return true},async save(){return 1}};
 const coordinator=createRecordSaveCoordinator(store);
 const hydrated=await coordinator.initializeFromRecords({players:[{id:'stale-local',hi:20}],societies:[],comps:[],cards:[],leagues:[],courses:[]});
 assert.deepEqual(hydrated.players,[{id:'cloud-player',hi:12}]);
 assert.equal(coordinator.isInitialized(),true);
 assert.deepEqual(coordinator.getBaseline().players,hydrated.players);
 await assert.rejects(coordinator.initializeFromRecords(hydrated),/GGC_BASELINE_ALREADY_INITIALIZED/);
});
test('failed snapshot is retained and cleared only after a confirmed retry',async()=>{
 let offline=true;
 const store={hasBaseline(){return true},async save(){if(offline)throw Error('offline');return 2}};
 const coordinator=createRecordSaveCoordinator(store);
 coordinator.initialize({players:[{id:'p',hi:10}]});
 const desired={players:[{id:'p',hi:9}]};
 await assert.rejects(coordinator.enqueue(desired),/offline/);
 assert.deepEqual(coordinator.getFailedDesired(),desired);
 offline=false;await coordinator.enqueue(desired);
 assert.equal(coordinator.getFailedDesired(),null);
 assert.equal(coordinator.getLastFailure(),null);
});

test('verified baseline cannot be replaced by a later stale snapshot',async()=>{
 const c=createRecordSaveCoordinator({hasBaseline(){return true},async save(){return 2}});
 c.initialize({players:[{id:'p',hi:10}]});
 assert.throws(()=>c.initialize({players:[{id:'p',hi:30}]}),/GGC_BASELINE_ALREADY_INITIALIZED/);
 assert.equal(c.getBaseline().players[0].hi,10);
 await c.enqueue({players:[{id:'p',hi:9}]});
 assert.equal(c.getBaseline().players[0].hi,9);
});

test('version conflict retains local edits and does not advance cloud baseline',async()=>{
 const c=createRecordSaveCoordinator({hasBaseline(){return true},async save(){throw Error('GGC_VERSION_CONFLICT');}});
 const initial={players:[{id:'p',hi:10}]};
 const edited={players:[{id:'p',hi:8}]};
 c.initialize(initial);
 await assert.rejects(c.enqueue(edited),/GGC_VERSION_CONFLICT/);
 assert.deepEqual(c.getBaseline(),initial);
 assert.deepEqual(c.getFailedDesired(),edited);
 assert.match(c.getLastFailure().message,/GGC_VERSION_CONFLICT/);
});

test('field-level reconciliation keeps local score and merges independent cloud fields for all record kinds',async()=>{
 const kinds=['players','societies','comps','cards','leagues','courses'];
 for(const kind of kinds){
  const initial={id:'r1',score:4,label:'original'};
  const mine={id:'r1',score:3,label:'original'};
  const theirs={id:'r1',score:4,label:'cloud'};
  const initialState=Object.fromEntries(kinds.map(k=>[k,k===kind?[initial]:[]]));
  const localState={...initialState,[kind]:[mine]};
  const versions=new Map([[kind+':r1',2]]);
  const store={async loadAll(){return {records:Object.fromEntries(kinds.map(k=>[k,k===kind?[theirs]:[]])),versions};},commitLoadedVersions(){}};
  const coordinator=createRecordSaveCoordinator(store);
  coordinator.initialize(initialState);
  const result=await coordinator.reconcileRecordsFromCloud(localState);
  assert.equal(result.snapshot[kind][0].score,3,kind+' local edit');
  assert.equal(result.snapshot[kind][0].label,'cloud',kind+' independent remote edit');
  assert.equal(coordinator.getBaseline()[kind][0].score,4,kind+' unacknowledged baseline');
  assert.equal(result.protectedRecords,1,kind);
  assert.deepEqual(result.protectedDetails[0].conflicts,[],kind);
 }
});

test('field-level reconciliation reports concurrent changes to the same score',async()=>{
 const kinds=['players','societies','comps','cards','leagues','courses'];
 const initial={players:[{id:'p',score:4}],societies:[],comps:[],cards:[],leagues:[],courses:[]};
 const local={...initial,players:[{id:'p',score:3}]};
 const store={async loadAll(){return {records:{...initial,players:[{id:'p',score:5}]},versions:new Map()};},commitLoadedVersions(){}};
 const c=createRecordSaveCoordinator(store);c.initialize(initial);
 const result=await c.reconcileRecordsFromCloud(local);
 assert.equal(result.snapshot.players[0].score,3);
 assert.deepEqual(result.protectedDetails[0].conflicts,['score']);
});

test('remote fetch cannot advance baseline when a form becomes dirty during request',async()=>{
 let resolveLoad;
 const store={async load(){return await new Promise(resolve=>{resolveLoad=resolve;});}};
 const c=createRecordSaveCoordinator(store);
 c.initialize({players:[{id:'p',score:4}]});
 let canCommit=true;
 const request=c.acceptRemoteRecord('players','p',{canCommit:()=>canCommit});
 canCommit=false;
 resolveLoad({id:'p',score:5});
 assert.equal(await request,null);
 assert.equal(c.getBaseline().players[0].score,4);
});
