import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordStore} from '../src/recordStore.js';

function fakeDb(){
 const records=new Map();
 const api={
  from(){return {select(){return {eq(_k,kind){return {eq(_k2,id){return {async maybeSingle(){const row=records.get(kind+':'+id);return {data:row?{...row}:null,error:null}}}}}}}}}},
  async rpc(_name,args){
   const k=args.p_kind+':'+args.p_id,old=records.get(k);
   if((old?.version??null)!==args.p_expected_version)return {data:null,error:{message:'GGC_VERSION_CONFLICT'}};
   const version=(old?.version??0)+1;
   records.set(k,{data:args.p_data,version,deleted:args.p_deleted});
   return {data:version,error:null};
  }
 };
 return api;
}
test('different records save independently',async()=>{
 const db=fakeDb(),a=createRecordStore(db),b=createRecordStore(db);
 await a.save('players','one',{hi:9});
 await b.save('players','two',{hi:12});
 assert.deepEqual(await a.load('players','two'),{hi:12});
 assert.deepEqual(await b.load('players','one'),{hi:9});
});
test('stale same-record writes are rejected',async()=>{
 const db=fakeDb(),a=createRecordStore(db),b=createRecordStore(db);
 await a.save('players','one',{hi:9});
 await b.load('players','one');
 await a.save('players','one',{hi:8});
 await assert.rejects(b.save('players','one',{hi:11}),/GGC_VERSION_CONFLICT/);
 assert.deepEqual(await a.load('players','one'),{hi:8});
});
test('deletion marker blocks stale resurrection',async()=>{
 const db=fakeDb(),a=createRecordStore(db),b=createRecordStore(db);
 await a.save('players','old',{name:'old'});
 await b.load('players','old');
 await a.save('players','old',{name:'old'},{deleted:true});
 await assert.rejects(b.save('players','old',{name:'old'}),/GGC_VERSION_CONFLICT/);
 assert.equal(await b.load('players','old'),null);
});
