import test from 'node:test';
import assert from 'node:assert/strict';
import {loadRecordSnapshot} from '../src/recordRetrieval.js';
const fake=(rows,error=null)=>({from:()=>({select:()=>({eq:()=>({order:()=>({range:async()=>({data:rows,error})})})})})});
test('retrieves one collection without touching unrelated competition records',async()=>{
 const base={players:[{id:'old'}],comps:[{id:'comp1',name:'Existing'}],cards:[{id:'card1'}]};
 const result=await loadRecordSnapshot(fake([{record_id:'p1',version:2,deleted:false,data:{id:'p1',name:'Golfer'}}]),base,{kinds:['players']});
 assert.deepEqual(result.players,[{id:'p1',name:'Golfer'}]);
 assert.deepEqual(result.comps,base.comps);
 assert.deepEqual(result.cards,base.cards);
 assert.deepEqual(base.players,[{id:'old'}]);
});
test('tombstones exclude deleted records',async()=>{
 const result=await loadRecordSnapshot(fake([{record_id:'p1',version:3,deleted:true,data:{id:'p1'}}]),{players:[]},{kinds:['players']});
 assert.deepEqual(result.players,[]);
});
test('failed retrieval never returns a partially overwritten snapshot',async()=>{
 await assert.rejects(loadRecordSnapshot(fake(null,{message:'network'}),{players:[{id:'safe'}]},{kinds:['players']}),/network/);
});
test('rejects malformed and duplicate rows',async()=>{
 await assert.rejects(loadRecordSnapshot(fake([{record_id:'p',version:1,data:{id:'wrong'}}]),{}, {kinds:['players']}),/GGC_INVALID_RECORD_DATA/);
 await assert.rejects(loadRecordSnapshot(fake([{record_id:'p',version:1,data:{id:'p'}},{record_id:'p',version:2,data:{id:'p'}}]),{}, {kinds:['players']}),/GGC_DUPLICATE_RECORD/);
});

test('paginates through more than 500 individual records',async()=>{
 const rows=Array.from({length:503},(_,i)=>({record_id:'p'+String(i).padStart(4,'0'),version:1,deleted:false,data:{id:'p'+String(i).padStart(4,'0')}}));
 const ranges=[];
 const db={from:()=>({select:()=>({eq:()=>({order:()=>({range:async(start,end)=>{
  ranges.push([start,end]);return {data:rows.slice(start,end+1),error:null};
 }})})})})};
 const result=await loadRecordSnapshot(db,{players:[]},{kinds:['players']});
 assert.equal(result.players.length,503);
 assert.deepEqual(ranges,[[0,499],[500,999]]);
});

test('unmigrated collection cannot erase populated legacy state',async()=>{
 const base={players:[{id:'legacy1'}]};
 await assert.rejects(loadRecordSnapshot(fake([]),base,{kinds:['players']}),/GGC_RECORD_MIGRATION_INCOMPLETE/);
 assert.deepEqual(base.players,[{id:'legacy1'}]);
});
test('empty record collection is valid if legacy collection is empty',async()=>{
 const result=await loadRecordSnapshot(fake([]),{players:[]},{kinds:['players']});
 assert.deepEqual(result.players,[]);
});
