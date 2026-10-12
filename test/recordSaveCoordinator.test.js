import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';
test('serializes rapid edits without losing intermediate version',async()=>{
 const calls=[],store={async save(kind,id,data){calls.push(data.hi);await Promise.resolve();return calls.length}};
 const c=createRecordSaveCoordinator(store);c.initialize({players:[{id:'p',hi:10}]});
 await Promise.all([c.enqueue({players:[{id:'p',hi:9}]}),c.enqueue({players:[{id:'p',hi:8}]})]);
 assert.deepEqual(calls,[9,8]);
});
test('failed save blocks retry until baseline is reconciled',async()=>{
 let fails=true;const calls=[],store={async save(_kind,_id,data){calls.push(data.hi);if(fails)throw Error('conflict');return 2}};
 const c=createRecordSaveCoordinator(store);c.initialize({players:[{id:'p',hi:10}]});
 await assert.rejects(c.enqueue({players:[{id:'p',hi:9}]}),/conflict/);
 assert.equal(c.isBlocked(),true);
 await assert.rejects(c.enqueue({players:[{id:'p',hi:9}]}),/GGC_PARTIAL_RECORD_SAVE/);
 fails=false;
 c.initialize({players:[{id:'p',hi:10}]});
 await c.enqueue({players:[{id:'p',hi:9}]});
 assert.deepEqual(calls,[9,9]);
});
test('cannot save without verified baseline',async()=>{
 const c=createRecordSaveCoordinator({save:async()=>1});
 await assert.rejects(c.enqueue({players:[]}),/GGC_BASELINE_REQUIRED/);
});

test('partial batch failure cannot silently replay already saved records',async()=>{
 const calls=[];let failSecond=true;
 const store={async save(_kind,id){calls.push(id);if(id==='b'&&failSecond)throw Error('network failure');return 1}};
 const c=createRecordSaveCoordinator(store);
 c.initialize({players:[{id:'a',hi:10},{id:'b',hi:10}]});
 const desired={players:[{id:'a',hi:9},{id:'b',hi:9}]};
 await assert.rejects(c.enqueue(desired),/network failure/);
 assert.deepEqual(calls,['a','b']);
 await assert.rejects(c.enqueue(desired),/GGC_PARTIAL_RECORD_SAVE/);
 assert.deepEqual(calls,['a','b']);
 failSecond=false;
 c.initialize({players:[{id:'a',hi:9},{id:'b',hi:10}]});
 await c.enqueue(desired);
 assert.deepEqual(calls,['a','b','b']);
});

test('baseline cannot be reset while a save is in flight',async()=>{
 let release,started;
 const entered=new Promise(resolve=>{started=resolve});
 const gate=new Promise(resolve=>{release=resolve});
 const calls=[];
 const c=createRecordSaveCoordinator({async save(_kind,_id,data){
  calls.push(data.hi);started();await gate;return 2;
 }});
 c.initialize({players:[{id:'p',hi:10}]});
 const saving=c.enqueue({players:[{id:'p',hi:9}]});
 await entered;
 assert.throws(()=>c.initialize({players:[{id:'p',hi:20}]}),/GGC_REINITIALIZE_DURING_SAVE/);
 release();
 await saving;
 c.initialize({players:[{id:'p',hi:9}]});
 await c.enqueue({players:[{id:'p',hi:8}]});
 assert.deepEqual(calls,[9,8]);
});
test('queued saves also prevent a premature baseline reset',async()=>{
 const c=createRecordSaveCoordinator({async save(){return 1}});
 c.initialize({players:[{id:'p',hi:10}]});
 const saving=c.enqueue({players:[{id:'p',hi:9}]});
 assert.throws(()=>c.initialize({players:[{id:'p',hi:10}]}),/GGC_REINITIALIZE_DURING_SAVE/);
 await saving;
 assert.doesNotThrow(()=>c.initialize({players:[{id:'p',hi:9}]}));
});
