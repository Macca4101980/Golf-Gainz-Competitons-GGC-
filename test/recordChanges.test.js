import test from 'node:test';
import assert from 'node:assert/strict';
import {planRecordChanges,saveRecordChanges} from '../src/recordChanges.js';
test('editing one golfer never saves another golfer',()=>{
 const before={players:[{id:'a',hi:10},{id:'b',hi:20}],cards:[{id:'c',points:36}]};
 const after={players:[{id:'a',hi:9},{id:'b',hi:20}],cards:[{id:'c',points:36}]};
 assert.deepEqual(planRecordChanges(before,after),[{kind:'players',id:'a',data:{id:'a',hi:9},deleted:false}]);
});
test('incomplete remote state never implies deletion',()=>{
 assert.deepEqual(planRecordChanges({players:[{id:'a'},{id:'b'}]},{players:[{id:'a'}]}),[]);
});
test('saves only planned changes and propagates conflicts',async()=>{
 const calls=[],store={async save(...args){calls.push(args);return 2;}};
 const changes=[{kind:'cards',id:'1',data:{points:40},deleted:false}];
 const result=await saveRecordChanges(store,changes);
 assert.equal(calls.length,1);assert.equal(result[0].version,2);
 await assert.rejects(saveRecordChanges({async save(){throw Error('GGC_VERSION_CONFLICT')}},changes),/GGC_VERSION_CONFLICT/);
});
