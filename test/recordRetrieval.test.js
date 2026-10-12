import test from 'node:test';
import assert from 'node:assert/strict';
import {loadRecordSnapshot} from '../src/recordRetrieval.js';
const fake=(rows,error=null)=>({from:()=>({select:()=>({eq:()=>Promise.resolve({data:rows,error})})})});
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
