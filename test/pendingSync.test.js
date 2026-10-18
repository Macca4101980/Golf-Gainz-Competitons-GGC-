import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';
import {persistLocalChangesBeforeSync} from '../src/pendingSync.js';

const emptyState=cards=>({players:[],societies:[],comps:[],cards,leagues:[],courses:[]});

test('local score changes are saved before queued live updates resume',async()=>{
 const cloud=new Map([
  ['rhys',{id:'rhys',compId:'week-1',gross:[4,4],updatedAt:'base'}],
  ['aaron',{id:'aaron',compId:'week-1',gross:[5,5],updatedAt:'base'}]
 ]);
 const versions=new Map([['rhys',1],['aaron',1]]);
 const store={
  hasBaseline:(_kind,id)=>versions.has(id),
  async save(_kind,id,data){cloud.set(id,structuredClone(data));versions.set(id,versions.get(id)+1);},
  async load(_kind,id){return structuredClone(cloud.get(id)??null)}
 };
 const coordinator=createRecordSaveCoordinator(store);
 const baseline=emptyState([...cloud.values()]);
 coordinator.initialize(baseline);
 const local=emptyState([
  {...cloud.get('rhys'),gross:[3,4],updatedAt:'local'},
  cloud.get('aaron')
 ]);
 const statuses=[];
 const ready=await persistLocalChangesBeforeSync({coordinator,snapshot:local,kinds:['players','societies','comps','cards','leagues','courses'],onStatus:x=>statuses.push(x)});
 assert.equal(ready,true);
 assert.deepEqual(cloud.get('rhys').gross,[3,4]);
 assert.deepEqual(cloud.get('aaron').gross,[5,5]);
 assert.deepEqual(coordinator.getBaseline().cards.map(x=>x.gross),[[3,4],[5,5]]);
 assert.deepEqual(statuses,['Saving local changes before resuming sync…']);
});

test('failed local save keeps the scores pending and blocks incoming sync',async()=>{
 const initial=emptyState([{id:'rhys',compId:'week-1',gross:[4],updatedAt:'base'}]);
 const coordinator=createRecordSaveCoordinator({hasBaseline:()=>true,async save(){throw Error('offline')}});
 coordinator.initialize(initial);
 const local=emptyState([{...initial.cards[0],gross:[3],updatedAt:'local'}]);
 const statuses=[];
 const ready=await persistLocalChangesBeforeSync({coordinator,snapshot:local,kinds:['cards'],onStatus:x=>statuses.push(x)});
 assert.equal(ready,false);
 assert.deepEqual(coordinator.getBaseline(),initial);
 assert.deepEqual(coordinator.getFailedDesired(),local);
 assert.deepEqual(statuses,['Saving local changes before resuming sync…','Local save failed — changes retained']);
});
