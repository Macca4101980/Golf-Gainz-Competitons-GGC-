import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordStore} from '../src/recordStore.js';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';

test('rejected refresh cannot advance the version and authorize overwriting a remote hole',async()=>{
 const initial={id:'card',gross:['4','4']};
 let row={data:structuredClone(initial),version:1,deleted:false};
 const client={
  from(){const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:structuredClone(row),error:null})};return query;},
  async rpc(_name,args){
   if(args.p_expected_version!==row.version)return {error:{message:'GGC_VERSION_CONFLICT'}};
   row={...row,data:{...row.data,...args.p_patch},version:row.version+1};
   return {data:row.version,error:null};
  },
 };
 const store=createRecordStore(client),coordinator=createRecordSaveCoordinator(store);
 store.seedVersions([{kind:'cards',id:'card',version:1}]);
 coordinator.initialize({cards:[initial]});
 row={data:{...initial,gross:['5','4']},version:2,deleted:false};
 assert.equal(await coordinator.acceptRemoteRecord('cards','card',{canCommit:()=>false}),null);
 assert.equal(store.getVersion('cards','card'),1,'version belongs to the accepted baseline, not a rejected read');
 const local={cards:[{...initial,gross:['4','6']}]};
 await assert.rejects(coordinator.enqueue(local),/GGC_VERSION_CONFLICT/);
 // A debounce retry after invalidation must not silently load/accept the newer version.
 await assert.rejects(coordinator.enqueue(local),/GGC_VERSION_CONFLICT/);
 assert.deepEqual(row.data.gross,['5','4']);
 assert.equal(await coordinator.recoverVersionConflict(local,{canCommit:()=>false}),null);
 assert.equal(store.getVersion('cards','card'),null,'cancelled recovery must not commit its staged version');
 const recovered=await coordinator.recoverVersionConflict(local);
 assert.deepEqual(recovered.snapshot.cards[0].gross,['5','6']);
 await coordinator.enqueue(recovered.snapshot);
 assert.deepEqual(row.data.gross,['5','6']);
});
