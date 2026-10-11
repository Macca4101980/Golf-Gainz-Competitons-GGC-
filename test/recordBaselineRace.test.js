import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';

const snapshot=(name='Original')=>({players:[{id:'p1',name}],societies:[],comps:[],cards:[],leagues:[],courses:[]});
test('different cloud baselines cannot initialise concurrently',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve});
 const store={async load(){await gate;return snapshot().players[0]}};
 const sync=createRecordSaveCoordinator(store);
 const first=sync.initializeFromCloud(snapshot());
 await assert.rejects(sync.initializeFromCloud(snapshot('Different')),/GGC_BASELINE_INITIALIZATION_IN_PROGRESS/);
 release();
 await first;
 assert.equal(sync.isInitialized(),true);
});
