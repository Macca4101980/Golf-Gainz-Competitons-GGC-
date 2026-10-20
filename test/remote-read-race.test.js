import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';

test('a remote read cannot replace a score entered while that read was in flight',async()=>{
 const initial={cards:[{id:'card',gross:['4','']}]};
 let finishRead,finishSave;
 const reading=new Promise(resolve=>{finishRead=resolve});
 const saving=new Promise(resolve=>{finishSave=resolve});
 const coordinator=createRecordSaveCoordinator({
  hasBaseline:()=>true,
  load:()=>reading,
  saveFields:()=>saving,
 });
 coordinator.initialize(initial);
 await coordinator.enqueue(initial);
 const refresh=coordinator.acceptRemoteRecord('cards','card');
 const edited={cards:[{id:'card',gross:['4','5']}]};
 const write=coordinator.enqueue(edited);
 finishRead(initial.cards[0]);
 const incoming=await refresh;
 finishSave(2);
 await write;
 assert.equal(incoming,null,'stale remote snapshot must be deferred');
 assert.deepEqual(coordinator.getDesired(),edited,'new score must stay pending/acknowledged');
 assert.deepEqual(coordinator.getBaseline(),edited);
});
