import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordStore} from '../src/recordStore.js';

test('never write a record without first loading a cloud version',async()=>{
 let rpcCalls=0;
 const db={from(){throw Error('unexpected load')},async rpc(){rpcCalls++;return {data:1,error:null}}};
 const store=createRecordStore(db);
 await assert.rejects(store.save('players','hooky',{id:'hooky',email:'a@example.com'}),/GGC_RECORD_BASELINE_REQUIRED/);
 assert.equal(rpcCalls,0);
});

test('existing record uses loaded version, not blind insert',async()=>{
 let args;
 const db={
  from(){return {select(){return {eq(){return {eq(){return {maybeSingle:async()=>({data:{data:{id:'hooky'},version:7,deleted:false},error:null})}}}}}}}},
  async rpc(_name,params){args=params;return {data:8,error:null}}
 };
 const store=createRecordStore(db);
 await store.load('players','hooky');
 await store.save('players','hooky',{id:'hooky',email:'richard-hook@live.co.uk'});
 assert.equal(args.p_expected_version,7);
 assert.equal(store.getVersion('players','hooky'),8);
});

test('conflict does not advance record version',async()=>{
 const db={
  from(){return {select(){return {eq(){return {eq(){return {maybeSingle:async()=>({data:{data:{id:'p'},version:4},error:null})}}}}}}}},
  async rpc(){return {data:null,error:{message:'GGC_VERSION_CONFLICT'}}}
 };
 const store=createRecordStore(db);
 await store.load('players','p');
 await assert.rejects(store.save('players','p',{id:'p',hi:9}),/GGC_VERSION_CONFLICT/);
 assert.equal(store.getVersion('players','p'),null); // stale version must be invalidated after conflict
 assert.equal(store.hasBaseline('players','p'),false);
});
