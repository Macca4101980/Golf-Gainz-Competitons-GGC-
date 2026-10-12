import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';

const base=()=>({players:[{id:'p1',name:'Hooky',email:'old@example.com'}],societies:[],comps:[],cards:[],leagues:[],courses:[]});

test('isolated record sync blocks saving before cloud migration',async()=>{
 let saves=0;
 const store={async load(){return null},async save(){saves++}};
 const sync=createRecordSaveCoordinator(store);
 await assert.rejects(sync.initializeFromCloud(base()),/GGC_RECORD_MIGRATION_REQUIRED/);
 assert.equal(sync.isInitialized(),false);
 await assert.rejects(sync.enqueue(base()),/GGC_BASELINE_REQUIRED/);
 assert.equal(saves,0);
});

test('isolated record sync writes only the edited record after cloud verification',async()=>{
 const existing=base(),saved=[];
 const store={hasBaseline(){return true},async load(kind,id){assert.equal(kind,'players');assert.equal(id,'p1');return existing.players[0]},async save(kind,id,data){saved.push({kind,id,data})}};
 const sync=createRecordSaveCoordinator(store);
 await sync.initializeFromCloud(existing);
 const changed=base();changed.players[0].email='richard-hook@live.co.uk';
 assert.equal(await sync.enqueue(changed),1);
 assert.deepEqual(saved,[{kind:'players',id:'p1',data:changed.players[0]}]);
 assert.equal(await sync.enqueue(changed),0);
});

test('cloud mismatch cannot silently overwrite locally loaded state',async()=>{
 const store={async load(){return {id:'p1',name:'Hooky',email:'new@example.com'}},async save(){throw Error('must not save')}};
 const sync=createRecordSaveCoordinator(store);
 await assert.rejects(sync.initializeFromCloud(base()),/GGC_RECORD_BASELINE_MISMATCH/);
 assert.equal(sync.isInitialized(),false);
});
