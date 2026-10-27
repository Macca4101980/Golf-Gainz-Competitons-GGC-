import test from 'node:test';
import assert from 'node:assert/strict';
import {commitStateUpdate} from '../src/stateCommit.js';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';

test('local input protects state from an in-flight refresh before the render or save debounce',async()=>{
 const initial={cards:[{id:'card',gross:['4','']}]};
 const stateRef={current:structuredClone(initial)},renders=[];
 let finishRead;
 const read=new Promise(resolve=>{finishRead=resolve});
 const coordinator=createRecordSaveCoordinator({load:()=>read});
 coordinator.initialize(initial);
 await coordinator.enqueue(initial);
 const refresh=coordinator.acceptRemoteRecord('cards','card',{
  canCommit:()=>JSON.stringify(stateRef.current)===JSON.stringify(coordinator.getDesired()),
 });
 commitStateUpdate(stateRef,next=>renders.push(next),previous=>({cards:previous.cards.map(card=>({...card,gross:['4','5']}))}));
 finishRead(initial.cards[0]);
 assert.equal(await refresh,null);
 assert.deepEqual(stateRef.current.cards[0].gross,['4','5']);
 assert.deepEqual(renders[0],stateRef.current);
 // Another batched edit must start with the latest local state, not last render.
 commitStateUpdate(stateRef,next=>renders.push(next),previous=>({cards:previous.cards.map(card=>({...card,gross:['6',card.gross[1]]}))}));
 assert.deepEqual(stateRef.current.cards[0].gross,['6','5']);
});
