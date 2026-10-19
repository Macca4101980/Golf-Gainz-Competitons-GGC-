import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareScorecardRecordBaseline} from '../src/scorecardRecordSync.js';

function harness(rows=[]){
 const writes=[];
 const store={async loadAll(kinds){assert.deepEqual(kinds,['cards']);return{cards:rows}},async save(kind,id,data){writes.push({kind,id,data});return 1}};
 const coordinator={value:null,isInitialized(){return this.value!==null},initialize(snapshot){if(this.value)throw Error('already initialized');this.value=snapshot}};
 return{store,coordinator,writes};
}

test('enables scorecard writes only when stored cards match the live snapshot',async()=>{
 const card={id:'card-1',gross:[4,5],updatedAt:'2026-10-19T12:00:00Z'};
 const h=harness([card]);
 const result=await prepareScorecardRecordBaseline({...h,cards:[{updatedAt:card.updatedAt,gross:[4,5],id:'card-1'}]});
 assert.equal(result.inserted,0);
 assert.deepEqual(h.coordinator.value,{cards:[card]});
 assert.equal(h.writes.length,0);
});

test('fails closed on an existing score conflict without changing its stored row',async()=>{
 const local={id:'card-1',gross:[4,5]};
 const remote={id:'card-1',gross:[4,4]};
 const h=harness([remote]);
 await assert.rejects(prepareScorecardRecordBaseline({...h,cards:[local]}),/GGC_CARD_BASELINE_MISMATCH/);
 assert.equal(h.writes.length,0);
 assert.equal(h.coordinator.value,null);
});

test('inserts a new card through the version-checked store before enabling writes',async()=>{
 const card={id:'new-card',gross:['',4]};
 const h=harness([]);
 const result=await prepareScorecardRecordBaseline({...h,cards:[card]});
 assert.equal(result.inserted,1);
 assert.deepEqual(h.writes,[{kind:'cards',id:'new-card',data:card}]);
 assert.deepEqual(h.coordinator.value,{cards:[card]});
});


test('uses a newer versioned card when the legacy cloud snapshot missed its save',async()=>{
 const legacy={id:'card-1',gross:[4,4],updatedAt:'2026-10-19T11:00:00Z'};
 const remote={id:'card-1',gross:[4,5],updatedAt:'2026-10-19T11:05:00Z'};
 const h=harness([remote]);
 const result=await prepareScorecardRecordBaseline({...h,cards:[legacy]});
 assert.deepEqual(result.cards,[remote]);
 assert.deepEqual(h.coordinator.value,{cards:[remote]});
 assert.equal(h.writes.length,0);
});

test('rejects duplicate card IDs before reading or writing records',async()=>{
 const h=harness([]);
 await assert.rejects(prepareScorecardRecordBaseline({...h,cards:[{id:'same'},{id:'same'}]}),/GGC_DUPLICATE_CARD_ID/);
 assert.equal(h.writes.length,0);
});
