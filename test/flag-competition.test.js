import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFlagResult,
  flagDistanceYards,
  flagProgress,
  flagRankValue,
  flagStrokeBudget,
  formatFlagResult,
} from '../src/flagCompetition.js';
import { scoreCard, formatResult } from '../src/scoring.js';

const holes = Array.from({ length: 18 }, (_, index) => ({
  n: index + 1,
  par: 4,
  si: index + 1,
}));
const course = {
  id: 'course',
  name: 'Test Course',
  tees: [{ name: 'White', slope: 113, rating: 72, yardage: 6200, holes }],
};
const competition = {
  id: 'flag-comp',
  format: 'flag',
  course: 'course',
  tee: 'White',
  holesMode: '18',
  handicapAllowance: 100,
};
const player = { id: 'player', name: 'Anthony', hi: 14 };
const state = { players: [player], courses: [course], cards: [] };

test('Flag allowance is selected course par plus Playing Handicap', () => {
  assert.equal(flagStrokeBudget(72, 14), 86);
  const progress = flagProgress({ gross: Array(18).fill(4) }, holes.map((_, i) => i), holes, 14);
  assert.equal(progress.budget, 86);
  assert.equal(progress.strokesUsed, 72);
  assert.equal(progress.remaining, 14);
  assert.equal(progress.absoluteHole, 19);
});

test('continuation holes and final strokes exhaust the allowance', () => {
  const card = {
    gross: Array(18).fill(4),
    flagContinuationGross: [4, 4, 4],
    flagCurrentHoleStrokes: 2,
  };
  const progress = flagProgress(card, holes.map((_, i) => i), holes, 14);
  assert.equal(progress.absoluteHole, 22);
  assert.equal(progress.remaining, 0);
  const result = createFlagResult({ progress, distanceToPin: 65, distanceUnit: 'yards', location: 'Fairway' });
  assert.equal(result.absoluteHole, 22);
  assert.equal(result.strokesUsed, 86);
  assert.match(formatFlagResult(result), /22nd hole · 2 shots · 65 yds remaining ⛳️/);
});

test('same-hole flags use a consistent yards/feet distance tie-break', () => {
  assert.equal(flagDistanceYards(18, 'feet'), 6);
  const nearer = { planted: true, absoluteHole: 19, distanceToPin: 18, distanceUnit: 'feet' };
  const farther = { planted: true, absoluteHole: 19, distanceToPin: 8, distanceUnit: 'yards' };
  assert.ok(flagRankValue(nearer) > flagRankValue(farther));
  assert.ok(flagRankValue({ ...farther, absoluteHole: 20 }) > flagRankValue(nearer));
});

test('distance is mandatory for every planted flag', () => {
  const progress = flagProgress({ gross: Array(18).fill(4), flagCurrentHoleStrokes: 14 }, holes.map((_, i) => i), holes, 14);
  assert.throws(() => createFlagResult({ progress, distanceToPin: '', distanceUnit: 'yards', location: 'Fairway' }), /distance/i);
});

test('scoreCard ranks and formats planted Flag results without changing normal gross scoring', () => {
  const flagResult = {
    planted: true,
    absoluteHole: 19,
    courseHole: 1,
    strokesOnFinalHole: 2,
    distanceToPin: 42,
    distanceUnit: 'yards',
    location: 'Fairway',
    strokeBudget: 86,
    strokesUsed: 86,
  };
  const card = { id: 'card', compId: competition.id, playerId: player.id, gross: Array(18).fill(4), playingHandicap: 14, flagResult };
  const result = scoreCard(card, competition, { ...state, cards: [card] });
  assert.equal(result.gross, 72);
  assert.equal(result.rankValue, flagRankValue(flagResult));
  assert.equal(formatResult(result, 'flag'), '19th hole · 2 shots · 42 yds remaining ⛳️');
});
