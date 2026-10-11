import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';
const state=players=>({players,societies:[],comps:[],cards:[],leagues:[],courses:[]});
test('new golfer establishes absent cloud baseline before insert',async()=>{
 const calls=[],store={
  hasBaseline(){return false},
  async load(kind,id){calls.push('load:'+kind+'/'+id);return null},
  async save(kind,id,data){calls.push('save:'+kind+'/'+id);return 1}
 };
 const sync=createRecordSaveCoordinator(store);
 sync.initialize(state([]));
 assert.equal(await sync.enqueue(state([{id:'new',name:'New Golfer'}])),1);
 assert.deepEqual(calls,['load:players/new','save:players/new']);
});
test('new golfer refuses overwrite if ID already exists remotely',async()=>{
 let saved=false;
 const store={hasBaseline(){return false},async load(){return {id:'new',name:'Other'}},async save(){saved=true}};
 const sync=createRecordSaveCoordinator(store);
 sync.initialize(state([]));
 await assert.rejects(sync.enqueue(state([{id:'new',name:'New'}])),/GGC_RECORD_ALREADY_EXISTS/);
 assert.equal(saved,false);
});
