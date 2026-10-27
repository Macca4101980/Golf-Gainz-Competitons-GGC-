import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';

test('conflict recovery cannot replace a newer input still waiting for the save debounce',async()=>{
 const initial={cards:[{id:'card',gross:['4','','']}]};
 const queued={cards:[{id:'card',gross:['4','5','']}]};
 let finishRead;
 const read=new Promise(resolve=>{finishRead=resolve});
 const coordinator=createRecordSaveCoordinator({
  hasBaseline:()=>true,
  saveFields:async()=>{throw Error('GGC_VERSION_CONFLICT');},
  load:()=>read,
 });
 coordinator.initialize(initial);
 await assert.rejects(coordinator.enqueue(queued),/GGC_VERSION_CONFLICT/);
 let current=queued;
 const recovery=coordinator.recoverVersionConflict(queued,{
  canCommit:()=>JSON.stringify(current)===JSON.stringify(queued),
 });
 // This input is visible locally, but its debounce has not enqueued it yet.
 current={cards:[{id:'card',gross:['4','5','6']}]};
 finishRead(initial.cards[0]);
 assert.equal(await recovery,null);
 assert.deepEqual(coordinator.getBaseline(),initial);
 assert.ok(coordinator.getLastFailure(),'retry must remain available');
});
