import test from 'node:test';
import assert from 'node:assert/strict';
import { winterLeagueTable } from '../src/winterLeague.js';

function fixture(releaseAt, provisionalAt = null) {
  const holes = Array.from({ length: 18 }, (_, i) => ({ n: i + 1, par: 4, si: i + 1 }));
  const course = { id: 'northampton', name: 'Northampton', tees: [{ name: 'Green', slope: 125, rating: 68.7, holes }] };
  const players = [{ id: 'a', name: 'A', hi: 10 }, { id: 'b', name: 'B', hi: 20 }];
  const comp = {
    id: 'week1', leagueId: 'league', format: '4bbb-stableford', course: 'northampton', tee: 'Green',
    handicapAllowance: 90, starts: '2026-10-17T09:00:00Z', status: 'scheduled',
    resultsEmbargo: { enabled: true, visibleThroughHole: 15, provisionalAt, releaseAt },
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

test('Winter League embargo carries a provisional cut forward while withholding official table points', () => {
  const { league, state } = fixture(new Date(Date.now() + 60_000).toISOString());
  state.comps.push({ ...state.comps[0], id: 'week2', starts: '2026-10-24T09:00:00Z', resultsEmbargo: { enabled: false } });
  const result = winterLeagueTable(league, state);
  const week = result.weekly[0];
  assert.equal(week.rows[0].provisional, true);
  assert.equal(week.rows[0].complete, 15);
  assert.equal(week.rows[0].holes.length, 18);
  assert.deepEqual(week.rows[0].holes.slice(15), [null, null, null]);
  assert.equal(result.table[0].played, 0);
  assert.ok(week.rows[0].afterAdjustments.a < week.rows[0].beforeAdjustments.a);
  assert.ok(result.table[0].weeks[1].playerHandicaps.a.adjustment < 0);
  assert.equal(result.table[0].provisionalCut, true);
});

test('Winter League hides team scores until the scheduled provisional release', () => {
  const { league, state } = fixture(
    new Date(Date.now() + 120_000).toISOString(),
    new Date(Date.now() + 60_000).toISOString(),
  );
  const result = winterLeagueTable(league, state);
  assert.equal(result.weekly[0].resultsHidden, true);
  assert.equal(result.weekly[0].rows.length, 0);
  assert.equal(result.table[0].played, 0);
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


test('full release replaces the provisional cut used by the following week', () => {
  const provisional = fixture(new Date(Date.now() + 60_000).toISOString());
  provisional.state.comps.push({ ...provisional.state.comps[0], id: 'week2', starts: '2026-10-24T09:00:00Z', resultsEmbargo: { enabled: false } });
  const released = fixture(new Date(Date.now() - 60_000).toISOString());
  released.state.comps.push({ ...released.state.comps[0], id: 'week2', starts: '2026-10-24T09:00:00Z', resultsEmbargo: { enabled: false } });
  const provisionalResult = winterLeagueTable(provisional.league, provisional.state);
  const releasedResult = winterLeagueTable(released.league, released.state);
  const provisionalAdjustment = provisionalResult.table[0].weeks[1].playerHandicaps.a.adjustment;
  const releasedAdjustment = releasedResult.table[0].weeks[1].playerHandicaps.a.adjustment;
  assert.ok(provisionalAdjustment < 0);
  assert.ok(releasedAdjustment < provisionalAdjustment);
  assert.equal(releasedResult.table[0].played, 1);
  assert.equal(releasedResult.table[0].provisionalCut, false);
});
