import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';
test('serializes rapid edits without losing intermediate version',async()=>{
 const calls=[],store={async save(kind,id,data){calls.push(data.hi);await Promise.resolve();return calls.length}};
 const c=createRecordSaveCoordinator(store);c.initialize({players:[{id:'p',hi:10}]});
 await Promise.all([c.enqueue({players:[{id:'p',hi:9}]}),c.enqueue({players:[{id:'p',hi:8}]})]);
 assert.deepEqual(calls,[9,8]);
});
test('failed save does not advance baseline',async()=>{
 let fails=true;const calls=[],store={async save(_kind,_id,data){calls.push(data.hi);if(fails)throw Error('conflict');return 2}};
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
