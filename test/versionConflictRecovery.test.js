import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';
const make=(gross)=>({id:'c1',gross,compId:'x'});
function setup(remote){
 let version=1,attempts=0;
 const store={
  hasBaseline:()=>true,
  async save(){attempts++;if(attempts===1)throw Error('GGC_VERSION_CONFLICT');version++;},
  async load(){return structuredClone(remote)},
  getVersion:()=>version
 };
 const coordinator=createRecordSaveCoordinator(store);
 const baseline={cards:[make([4,4,4])]};
 coordinator.initialize(baseline);
 return {coordinator,baseline,getAttempts:()=>attempts};
}
test('conflicted independent hole edit is rebased and can be saved',async()=>{
 const {coordinator,getAttempts}=setup(make([4,5,4]));
 const desired={cards:[make([3,4,4])]};
 await assert.rejects(coordinator.enqueue(desired),/GGC_VERSION_CONFLICT/);
 const recovery=await coordinator.recoverVersionConflict(desired);
 assert.deepEqual(recovery.conflicts,[]);
 assert.deepEqual(recovery.snapshot.cards[0].gross,[3,5,4]);
 await coordinator.enqueue(recovery.snapshot);
 assert.equal(getAttempts(),2);
 assert.deepEqual(coordinator.getBaseline().cards[0].gross,[3,5,4]);
});
test('conflicting same-hole edit is not automatically saved',async()=>{
 const {coordinator,getAttempts}=setup(make([5,4,4]));
 const desired={cards:[make([3,4,4])]};
 await assert.rejects(coordinator.enqueue(desired),/GGC_VERSION_CONFLICT/);
 const recovery=await coordinator.recoverVersionConflict(desired);
 assert.deepEqual(recovery.conflicts,['c1/gross[0]']);
 assert.equal(getAttempts(),1);
 assert.deepEqual(coordinator.getBaseline().cards[0].gross,[4,4,4]);
 assert.ok(coordinator.getLastFailure());
});
test('unrelated remote card metadata is preserved during recovery',async()=>{
 const remote={...make([4,4,4]),tee:'White'};
 const {coordinator}=setup(remote);
 const desired={cards:[make([3,4,4])]};
 await assert.rejects(coordinator.enqueue(desired),/GGC_VERSION_CONFLICT/);
 const recovery=await coordinator.recoverVersionConflict(desired);
 assert.equal(recovery.snapshot.cards[0].tee,'White');
});
