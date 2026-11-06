import assert from 'node:assert/strict';
import test from 'node:test';
import { fourballMatchResult } from '../src/scoring.js';

for (const [holesMode, start, count] of [['front9', 0, 9], ['back9', 9, 9], ['18', 0, 18]]) {
 test(`Pairs Matchplay settles the deciding hole on ${holesMode}`, () => {
  const ids = ['a', 'b', 'c', 'd'];
  const comp = { id: 'match', holesMode, courseSnapshot: { tee: {
   slope: 113, rating: 72,
   holes: Array.from({ length: 18 }, (_, i) => ({ n: i + 1, si: i + 1, par: 4 })),
  } } };
  const cards = ids.map(playerId => ({ playerId, compId: comp.id, gross: Array(18).fill(4) }));
  const state = { players: ids.map(id => ({ id, hi: 0 })), cards };
  const result = () => fourballMatchResult({ ids: ids.slice(0, 2) }, { ids: ids.slice(2) }, comp, state);
  const last = start + count - 1;
  cards[0].gross[start] = 3;
  cards[3].gross[last] = '';
  assert.equal(result().played, count - 1);
  assert.equal(result().decided, false);
  cards[3].gross[last] = 3;
  assert.equal(result().text, 'Match halved');
  cards[3].gross[last] = 0;
  assert.equal(result().text, '1 UP');
  cards[0].gross[last - 1] = 3;
  assert.equal(result().text, '2 & 1');
  cards[3].gross[last] = 1;
  assert.equal(result().text, '2 & 1');
 });
}
