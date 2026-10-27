import test from 'node:test';
import assert from 'node:assert/strict';
import {declineCompetitionInvite,groupCodeError,scoreGroupStartError} from '../src/beta11.js';
import {planRecordChanges} from '../src/recordChanges.js';

test('decline queues only its competition through production record saving',()=>{
  const before={comps:[{id:'invite',invites:['me','other'],entries:['entrant'],pairs:[{ids:['a','b']}]},{id:'untouched',invites:['me']}],cards:[{id:'card',gross:[4,5]}],societies:[{id:'group',members:['me']}]};
  const after=declineCompetitionInvite(before,'invite','me');
  const changes=planRecordChanges(before,after);
  assert.equal(changes.length,1);
  assert.equal(changes[0].kind,'comps');
  assert.equal(changes[0].id,'invite');
  assert.deepEqual(changes[0].data.invites,['other']);
  assert.deepEqual(changes[0].data.entries,['entrant']);
  assert.equal(after.cards,before.cards);
  assert.equal(after.societies,before.societies);
});

test('declining a competition invitation persists the response without entering',()=>{
  const before={comps:[{id:'c1',invites:['p1','p2'],declinedInvites:[]}]};
  const after=declineCompetitionInvite(before,'c1','p1','2026-10-26T00:00:00.000Z');
  assert.deepEqual(after.comps[0].invites,['p2']);
  assert.deepEqual(after.comps[0].declinedInvites,['p1']);
  assert.equal(after.comps[0].updatedAt,'2026-10-26T00:00:00.000Z');
  assert.deepEqual(before.comps[0].invites,['p1','p2']);
});

test('group-code errors distinguish missing from invalid or expired codes',()=>{
  assert.equal(groupCodeError(''),'Enter a Group code to continue.');
  assert.match(groupCodeError('GGC-NOPE'),/invalid or has expired/i);
});

test('solo scorecards are valid for pairs formats except four-ball matchplay',()=>{
  assert.equal(scoreGroupStartError('4bbb-stableford',['p1']),null);
  assert.equal(scoreGroupStartError('4bbb-stroke',['p1']),null);
  assert.match(scoreGroupStartError('4bbb-stableford',['p1','p2','p3']),/even number/i);
  assert.match(scoreGroupStartError('4bbb-match',['p1']),/four golfers/i);
});
