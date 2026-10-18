import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeScorecardConflict} from '../src/scorecardConflict.js';

const base={id:'card',gross:[4,4,4],updatedAt:'t0',lastEditedBy:'a',submitted:false};
test('FIX04 independent hole edits merge despite simultaneous provenance changes',()=>{
 const local={...base,gross:[6,4,4],updatedAt:'t2',lastEditedBy:'phone'};
 const remote={...base,gross:[4,5,4],updatedAt:'t1',lastEditedBy:'laptop'};
 const {merged,conflicts}=mergeScorecardConflict({baseline:base,local,remote});
 assert.deepEqual(conflicts,[]);
 assert.deepEqual(merged.gross,[6,5,4]);
});
test('FIX04 same-hole concurrent edits remain conflicts',()=>{
 const local={...base,gross:[6,4,4],updatedAt:'t2',lastEditedBy:'phone'};
 const remote={...base,gross:[5,4,4],updatedAt:'t1',lastEditedBy:'laptop'};
 const {conflicts}=mergeScorecardConflict({baseline:base,local,remote});
 assert.ok(conflicts.includes('gross[0]'));
});
