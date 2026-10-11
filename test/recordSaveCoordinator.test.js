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
