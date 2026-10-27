import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRecordConflictMessage} from '../src/recordConflictNotice.js';

test('same-hole conflict notice names the affected hole and explains neither value is silently chosen',()=>{
 const message=buildRecordConflictMessage({conflictDetails:[{hole:2,localScore:'8',cloudScore:'7'}]});
 assert.match(message,/hole 3/);
 assert.match(message,/not silently overwritten/);
 assert.match(message,/Refresh to use the cloud score/);
});

test('generic record conflicts still produce an actionable warning',()=>{
 assert.match(buildRecordConflictMessage({conflicts:['cards\/card1\/gross[2]']}),/Score conflict/);
});
