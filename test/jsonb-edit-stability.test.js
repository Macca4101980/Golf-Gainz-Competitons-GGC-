import test from 'node:test';
import assert from 'node:assert/strict';
import {changedFields,reconcileRecord} from '../src/editProtection.js';
import {planRecordChanges} from '../src/recordChanges.js';
import {createRecordSaveCoordinator} from '../src/recordSaveCoordinator.js';

test('JSONB key reordering does not trigger a repeated preference write',async()=>{
 const remote={id:'group-choice',field:'currentSocietyId',scope:'user',value:'test-group',userId:'test-user'};
 const local={id:'group-choice',scope:'user',userId:'test-user',field:'currentSocietyId',value:'test-group'};
 let writes=0;
 const coordinator=createRecordSaveCoordinator({hasBaseline:()=>true,saveFields:async()=>{writes++;return 2}});
 coordinator.initialize({appFields:[remote]});
 for(let refresh=0;refresh<5;refresh++)assert.equal(await coordinator.enqueue({appFields:[local]}),0);
 assert.equal(writes,0);
});

test('nested JSONB object order is ignored while score and roster changes are retained',()=>{
 const before={id:'card',gross:[4,5],details:{tee:'Yellow',ratings:{slope:127,rating:70.4}}};
 const after={details:{ratings:{rating:70.4,slope:127},tee:'Yellow'},gross:[4,5],id:'card'};
 assert.deepEqual(changedFields(before,after),[]);
 assert.deepEqual(planRecordChanges({cards:[before]},{cards:[after]}),[]);
 assert.deepEqual(changedFields(before,{...after,gross:[5,4]}),['gross']);
 const changed={...after,details:{...after.details,tee:'White'}};
 assert.equal(planRecordChanges({cards:[before]},{cards:[changed]}).length,1);
 assert.deepEqual(reconcileRecord({baseline:before,local:changed,remote:after,dirtyFields:['details']}).conflicts,[]);
});
