import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeScorecardConflict} from '../src/scorecardConflict.js';
const card=(gross)=>({id:'card-1',compId:'comp-1',gross});
test('different hole edits survive rebase',()=>{
 const baseline=card([4,4,4]);
 const local=card([3,4,4]);
 const remote=card([4,5,4]);
 assert.deepEqual(mergeScorecardConflict({baseline,local,remote}),{merged:card([3,5,4]),conflicts:[]});
});
test('different scores on same hole must never be silently overwritten',()=>{
 const baseline=card([4,4,4]);
 const local=card([3,4,4]);
 const remote=card([5,4,4]);
 const result=mergeScorecardConflict({baseline,local,remote});
 assert.deepEqual(result.conflicts,['gross[0]']);
 assert.deepEqual(result.merged,remote);
});
test('identical concurrent edit is not a conflict',()=>{
 const baseline=card([4,4]);
 const local=card([3,4]);
 const remote=card([3,4]);
 assert.deepEqual(mergeScorecardConflict({baseline,local,remote}).conflicts,[]);
});
test('independent metadata changes survive rebase',()=>{
 const baseline={...card([4]),note:'original',tee:'Yellow'};
 const local={...baseline,note:'updated'};
 const remote={...baseline,tee:'White'};
 assert.deepEqual(mergeScorecardConflict({baseline,local,remote}),{merged:{...remote,note:'updated'},conflicts:[]});
});
test('same metadata field conflict is reported',()=>{
 const baseline={...card([4]),tee:'Yellow'};
 const local={...baseline,tee:'White'};
 const remote={...baseline,tee:'Red'};
 assert.deepEqual(mergeScorecardConflict({baseline,local,remote}).conflicts,['tee']);
});
