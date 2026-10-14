import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';

function setup(kind,initial){
 const cloud=new Map([[kind+':'+initial.id,{record:structuredClone(initial),version:1}]]);
 const sessions=()=>{const versions=new Map();const store={
  async load(k,id){const entry=cloud.get(k+':'+id);if(entry)versions.set(k+':'+id,entry.version);return structuredClone(entry?.record??null)},
  hasBaseline(k,id){return versions.has(k+':'+id)},
  async save(k,id,data){const key=k+':'+id,entry=cloud.get(key);
   if(!entry||entry.version!==versions.get(key))throw Error('GGC_VERSION_CONFLICT');
   entry.record=structuredClone(data);entry.version++;versions.set(key,entry.version);
  }
 };return {store,coordinator:createRecordSaveCoordinator(store)}};
 return {cloud,sessions};
}
const snap=(kind,record)=>({players:[],societies:[],comps:[],cards:[],leagues:[],courses:[],[kind]:[structuredClone(record)]});
test('group name change rebases safely over newly added member',async()=>{
 const original={id:'group',name:'Old',members:['James','Tracey']};
 const {cloud,sessions}=setup('societies',original);
 const a=sessions(),b=sessions();
 await a.store.load('societies','group');await b.store.load('societies','group');
 a.coordinator.initialize(snap('societies',original));b.coordinator.initialize(snap('societies',original));
 const newer=snap('societies',{...original,members:[...original.members,'Anthony']});
 await b.coordinator.enqueue(newer);
 const stale=snap('societies',{...original,name:'New name'});
 await assert.rejects(a.coordinator.enqueue(stale),/GGC_VERSION_CONFLICT/);
 const recovered=await a.coordinator.recoverVersionConflict(stale);
 assert.deepEqual(recovered.conflicts,[]);
 assert.deepEqual(recovered.snapshot.societies[0].members,['James','Tracey','Anthony']);
 await a.coordinator.enqueue(recovered.snapshot);
 assert.equal(cloud.get('societies:group').record.name,'New name');
 assert.deepEqual(cloud.get('societies:group').record.members,['James','Tracey','Anthony']);
});
test('concurrent member changes require review, never restore removed members',async()=>{
 const original={id:'group',name:'Old',members:['James','Tracey']};
 const {cloud,sessions}=setup('societies',original);
 const a=sessions(),b=sessions();
 await a.store.load('societies','group');await b.store.load('societies','group');
 a.coordinator.initialize(snap('societies',original));b.coordinator.initialize(snap('societies',original));
 await b.coordinator.enqueue(snap('societies',{...original,members:['James']}));
 const stale=snap('societies',{...original,members:['James','Tracey','Anthony']});
 await assert.rejects(a.coordinator.enqueue(stale),/GGC_VERSION_CONFLICT/);
 const result=await a.coordinator.recoverVersionConflict(stale);
 assert.ok(result.conflicts.some(x=>x.includes('members')));
 assert.deepEqual(cloud.get('societies:group').record.members,['James']);
});
