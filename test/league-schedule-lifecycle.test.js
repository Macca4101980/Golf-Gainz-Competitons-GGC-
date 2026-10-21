import test from 'node:test';
import assert from 'node:assert/strict';
import { leagueCompetitionLifecycle } from '../src/winterLeague.js';

test('league schedule lifecycle follows launch and close dates', () => {
  const comp = {
    status: 'scheduled',
    starts: '2026-10-16T05:00:00.000Z',
    ends: '2026-10-23T05:00:00.000Z'
  };

  assert.equal(
    leagueCompetitionLifecycle(comp, new Date('2026-10-15T12:00:00.000Z')),
    'scheduled'
  );
  assert.equal(
    leagueCompetitionLifecycle(comp, new Date('2026-10-21T12:00:00.000Z')),
    'live'
  );
  assert.equal(
    leagueCompetitionLifecycle(comp, new Date('2026-10-23T05:00:00.000Z')),
    'closed'
  );
});

test('cancelled and draft states remain explicit', () => {
  assert.equal(leagueCompetitionLifecycle({ status: 'cancelled' }), 'cancelled');
  assert.equal(leagueCompetitionLifecycle({ status: 'draft' }), 'draft');
});
