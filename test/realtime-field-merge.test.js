import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';

const card=(gross)=>({id:'card1',playerId:'player1',compId:'comp1',gross:[...gross],updatedAt:'2026-10-26T00:00:00.000Z'});
const snapshot=(value)=>({cards:[value]});

test('realtime card merge preserves the active local hole and accepts another remote hole',async()=>{
 const base=card(Array(18).fill('5'));
 const remote=card(Array(18).fill('5'));
 remote.gross[17]='4';
 const store={load:async(kind,id)=>kind==='cards'&&id==='card1'?structuredClone(remote):null};
 const coordinator=createRecordSaveCoordinator(store);
 coordinator.initialize(snapshot(base));
 const local=snapshot(card(Array(18).fill('5')));
 local.cards[0].gross[0]='6';

 const next=await coordinator.acceptRemoteRecord('cards','card1',{currentSnapshot:local});

 assert.equal(next.cards[0].gross[0],'6');
 assert.equal(next.cards[0].gross[17],'4');
 assert.equal(next.cards[0].gross[1],'5');
});

test('realtime card merge requires review when both devices edit the same hole',async()=>{
 const base=card(Array(18).fill('5'));
 const remote=card(Array(18).fill('5'));
 remote.gross[0]='4';
 const store={load:async()=>structuredClone(remote)};
 const coordinator=createRecordSaveCoordinator(store);
 coordinator.initialize(snapshot(base));
 const local=snapshot(card(Array(18).fill('5')));
 local.cards[0].gross[0]='6';

 const result=await coordinator.acceptRemoteRecord('cards','card1',{currentSnapshot:local});

 assert.deepEqual(result.conflicts,['cards/card1/gross[0]']);
});
