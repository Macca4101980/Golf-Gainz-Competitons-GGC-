import test from 'node:test';
import assert from 'node:assert/strict';
import {
 hasPendingCompetitionInvite,
 sanitiseCompetitionParticipation,
} from '../src/playerIdentity.js';

test('an existing entrant is never also treated as invited',()=>{
 const comp={id:'week-1',entries:['anthony'],invites:['anthony','james']};
 const clean=sanitiseCompetitionParticipation(comp);
 assert.deepEqual(clean.entries,['anthony']);
 assert.deepEqual(clean.invites,['james']);
 assert.equal(hasPendingCompetitionInvite(comp,'anthony'),false);
 assert.equal(hasPendingCompetitionInvite(comp,'james'),true);
});

test('participation sanitising does not alter scorecard or competition data',()=>{
 const comp={id:'week-1',entries:['anthony'],invites:['anthony'],resultsEmbargo:{enabled:true},roundGroups:[{id:'group-1'}]};
 const clean=sanitiseCompetitionParticipation(comp);
 assert.deepEqual(clean.resultsEmbargo,comp.resultsEmbargo);
 assert.deepEqual(clean.roundGroups,comp.roundGroups);
 assert.deepEqual(comp.invites,['anthony']);
});

test('duplicate cached participant ids are normalised safely',()=>{
 const clean=sanitiseCompetitionParticipation({
  entries:['anthony','anthony'],
  invites:['anthony','james','james'],
 });
 assert.deepEqual(clean.entries,['anthony']);
 assert.deepEqual(clean.invites,['james']);
});
