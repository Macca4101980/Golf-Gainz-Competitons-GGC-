import test from 'node:test';
import assert from 'node:assert/strict';
import { leagueTwosLedger } from '../src/leagueMoney.js';

const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
const league = { id: 'league', memberIds: ['a', 'b', 'c'], targetCompetitions: 3 };
const week = (id, status = 'completed', entries = ['a', 'b', 'c']) => ({ comp: { id, name: `Week ${id}`, status, entries } });

test('splits the weekly contribution pot evenly per gross 2', () => {
  const result = leagueTwosLedger({
    league,
    weeks: [week('1')],
    players,
    contributionPerPlayer: 8,
    cards: [
      { compId: '1', playerId: 'a', gross: [2, 4, 2] },
      { compId: '1', playerId: 'b', gross: [3, 2] },
      { compId: '1', playerId: 'c', gross: [2] },
    ],
  });
  assert.equal(result.weeklyContribution, 8);
  assert.deepEqual(result.weeks[0].winners.map(x => [x.playerId, x.holes, x.amount]), [
    ['a', [1, 3], 4], ['b', [2], 2], ['c', [1], 2],
  ]);
  assert.equal(result.payouts.reduce((sum, item) => sum + item.amount, 0), 8);
  assert.equal(result.carryForward, 0);
});

test('allocates spare pennies so winner payouts add up to the full pot', () => {
  const result = leagueTwosLedger({
    league,
    weeks: [week('1')],
    players,
    contributionPerPlayer: 10,
    cards: players.map(player => ({ compId: '1', playerId: player.id, gross: [2] })),
  });
  assert.deepEqual(result.payouts.map(x => x.amount), [3.34, 3.33, 3.33]);
  assert.equal(result.payouts.reduce((sum, item) => sum + item.amount, 0), 10);
});

test('rolls an unclaimed completed week into the next completed week', () => {
  const result = leagueTwosLedger({
    league,
    weeks: [week('1'), week('2')],
    players,
    contributionPerPlayer: 8,
    cards: [{ compId: '2', playerId: 'b', gross: [2] }],
  });
  assert.equal(result.weeks[0].pot, 8);
  assert.equal(result.weeks[0].carryOut, 8);
  assert.equal(result.weeks[1].carryIn, 8);
  assert.equal(result.weeks[1].pot, 16);
  assert.equal(result.payouts[0].amount, 16);
  assert.equal(result.carryForward, 0);
});

test('does not treat future week allocations as rollover', () => {
  const result = leagueTwosLedger({
    league,
    weeks: [week('1', 'draft'), week('2', 'scheduled'), week('3', 'live')],
    players,
    contributionPerPlayer: 8,
    cards: [],
  });
  assert.equal(result.weeks[0].pot, 8);
  assert.equal(result.weeks[2].pot, 8);
  assert.equal(result.carryForward, 0);
});

test('ignores non-league golfers and scores from other competitions', () => {
  const result = leagueTwosLedger({
    league,
    weeks: [week('1', 'completed', ['a', 'guest'])],
    players: [...players, { id: 'guest', name: 'Guest' }],
    contributionPerPlayer: 8,
    cards: [
      { compId: '1', playerId: 'guest', gross: [2] },
      { compId: 'other', playerId: 'a', gross: [2] },
    ],
  });
  assert.equal(result.weeks[0].hits.length, 0);
  assert.equal(result.carryForward, 8);
  assert.equal(result.payouts.length, 0);
});
