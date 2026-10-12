import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';
import {createRecordStore} from '../src/recordStore.js';

const state=players=>({players,societies:[],comps:[],cards:[],leagues:[],courses:[]});
function fakeSupabase(){
 const rows=new Map();
 const key=(kind,id)=>kind+':'+id;
 return {
  rows,
  from(){return {select(){return {eq(kind,value){this[kind]=value;return this},async maybeSingle(){const row=rows.get(key(this.kind,this.record_id));return {data:row?structuredClone(row):null,error:null}}}}}},
  async rpc(_,p){
   const k=key(p.p_kind,p.p_id),row=rows.get(k);
   if((row?.version??null)!==p.p_expected_version)return {data:null,error:{message:'GGC_VERSION_CONFLICT'}};
   const version=(row?.version??0)+1;
   rows.set(k,{data:structuredClone(p.p_data),version,deleted:p.p_deleted});
   return {data:version,error:null};
  }
 };
}
test('create, reload, and update an individual golfer without whole-state writes',async()=>{
 const db=fakeSupabase(),a=createRecordSaveCoordinator(createRecordStore(db));
 a.initialize(state([]));
 assert.equal(await a.enqueue(state([{id:'p1',name:'First'}])),1);
 const b=createRecordSaveCoordinator(createRecordStore(db));
 await b.initializeFromCloud(state([{id:'p1',name:'First'}]));
 assert.equal(await b.enqueue(state([{id:'p1',name:'Updated'}])),1);
 assert.equal(db.rows.get('players:p1').data.name,'Updated');
});
test('two devices: stale version cannot overwrite newer golfer',async()=>{
 const db=fakeSupabase(),seed=createRecordSaveCoordinator(createRecordStore(db));
 seed.initialize(state([]));await seed.enqueue(state([{id:'p1',name:'First'}]));
 const a=createRecordSaveCoordinator(createRecordStore(db));
 const b=createRecordSaveCoordinator(createRecordStore(db));
 await a.initializeFromCloud(state([{id:'p1',name:'First'}]));
 await b.initializeFromCloud(state([{id:'p1',name:'First'}]));
 await a.enqueue(state([{id:'p1',name:'Device A'}]));
 await assert.rejects(b.enqueue(state([{id:'p1',name:'Device B'}])),/GGC_VERSION_CONFLICT/);
 assert.equal(db.rows.get('players:p1').data.name,'Device A');
});
