import test from 'node:test';
import assert from 'node:assert/strict';
import { winterLeagueTable } from '../src/winterLeague.js';

function fixture(releaseAt) {
  const holes = Array.from({ length: 18 }, (_, i) => ({ n: i + 1, par: 4, si: i + 1 }));
  const course = { id: 'northampton', name: 'Northampton', tees: [{ name: 'Green', slope: 125, rating: 68.7, holes }] };
  const players = [{ id: 'a', name: 'A', hi: 10 }, { id: 'b', name: 'B', hi: 20 }];
  const comp = {
    id: 'week1', leagueId: 'league', format: '4bbb-stableford', course: 'northampton', tee: 'Green',
    handicapAllowance: 90, starts: '2026-10-17T09:00:00Z', status: 'scheduled',
    resultsEmbargo: { enabled: true, visibleThroughHole: 15, releaseAt },
  };
  const cards = players.map(p => ({ id: `card-${p.id}`, compId: comp.id, playerId: p.id, courseId: course.id, tee: 'Green', gross: Array(18).fill(4) }));
  const state = { players, courses: [course], cards, comps: [comp] };
  const league = {
    id: 'league', teams: [{ id: 'team1', name: 'Team 1', memberIds: ['a', 'b'] }],
    handicapSettings: { allowance: 90, mode: 'team', target: 36, cutPerPoint: 0.5, teamAdjustment: 'split', direction: 'down' },
    startingHandicaps: { a: 10, b: 20 },
  };
  return { league, state };
}

test('Winter League embargo shows only holes 1–15 and withholds official scoring changes', () => {
  const { league, state } = fixture(new Date(Date.now() + 60_000).toISOString());
  const result = winterLeagueTable(league, state);
  const week = result.weekly[0];
  assert.equal(week.rows[0].provisional, true);
  assert.equal(week.rows[0].complete, 15);
  assert.equal(week.rows[0].holes.length, 18);
  assert.deepEqual(week.rows[0].holes.slice(15), [null, null, null]);
  assert.equal(result.table[0].played, 0);
  assert.deepEqual(week.rows[0].afterAdjustments, week.rows[0].beforeAdjustments);
});

test('Winter League embargo releases the full scorecard and official week after release time', () => {
  const { league, state } = fixture(new Date(Date.now() - 60_000).toISOString());
  const result = winterLeagueTable(league, state);
  const week = result.weekly[0];
  assert.equal(week.rows[0].provisional, false);
  assert.equal(week.rows[0].complete, 18);
  assert.equal(result.table[0].played, 1);
  assert.ok(week.rows[0].afterAdjustments.a < week.rows[0].beforeAdjustments.a);
});
