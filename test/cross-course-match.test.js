import test from 'node:test';
import assert from 'node:assert/strict';
import {crossCourseMatchResult, prepareCrossCourseMatch} from '../src/crossCourseMatch.js';

function golfer(id, side, handicapIndex, start = 1, par = 4, length = 9) {
  return {
    id, side, handicapIndex, courseId: id, teeId: 'green', slope: 113, rating: par * length,
    holes: Array.from({length}, (_, index) => ({number: start + index, si: start + index, par}))
  };
}

test('uses rated nines and allocates all relative shots across the selected holes', () => {
  const fixture = prepareCrossCourseMatch([
    golfer('a', 'A', 0), golfer('b', 'A', 10, 10),
    golfer('c', 'B', 20), golfer('d', 'B', 24)
  ]);
  assert.deepEqual(fixture.cards.map(card => card.playingHandicap), [0, 5, 9, 11]);
  assert.deepEqual(fixture.cards[1].holes.map(hole => hole.shots), [1, 1, 1, 1, 1, 0, 0, 0, 0]);
  assert.equal(fixture.cards[3].holes.reduce((sum, hole) => sum + hole.shots, 0), 11);
});

test('different ratings and slopes determine who gives shots across the four golfers', () => {
  const fixture = prepareCrossCourseMatch([
    golfer('a', 'A', 10, 1, 4, 18),
    {...golfer('b', 'A', 10, 1, 4, 18), rating: 70, slope: 120},
    {...golfer('c', 'B', 10, 1, 4, 18), rating: 73, slope: 132},
    golfer('d', 'B', 10, 1, 4, 18)
  ]);
  assert.deepEqual(fixture.cards.map(card => card.playingHandicap), [1, 0, 4, 1]);
});

test('holds back later holes, compares against local par and preserves an early clinch', () => {
  const fixture = prepareCrossCourseMatch([
    golfer('a', 'A', 0), golfer('b', 'A', 0),
    golfer('c', 'B', 0, 10, 5), golfer('d', 'B', 0, 10, 5)
  ]);
  const scores = new Map([
    ['a', [3, 3, 3, 3, 3, 4, 4, 4, 4]], ['b', [0, 0, 0, 0, 0, 4, 4, 4, 4]],
    ['c', [5, 5, 5, 5, 5, 4, 4, 4, 4]], ['d', [, 5, 5, 5, 5, 4, 4, 4, 4]]
  ]);
  assert.deepEqual(crossCourseMatchResult(fixture, scores).holes, []);
  scores.get('d')[0] = 5;
  const match = crossCourseMatchResult(fixture, scores);
  assert.equal(match.holes[0].scores[2].number, 10);
  assert.equal(match.holes[0].winner, 'A');
  assert.equal(match.holes[8].winner, 'B');
  assert.deepEqual(match.result, {winner: 'A', up: 5, left: 4, decidedOn: 5});
});
