import test from 'node:test';
import assert from 'node:assert/strict';
import {lockCrossCourseSetup} from '../src/crossCourseSetup.js';

function setup() {
  const holes = Array.from({length: 18}, (_, i) => ({n: i + 1, par: 4, si: i + 1}));
  const tee = {
    name: 'Yellow', rating: 72, slope: 113, holes,
    nineHoleRatings: {front9: {rating: 35, slope: 113}, back9: {rating: 37, slope: 113}}
  };
  const players = ['a', 'b', 'c', 'd'].map(id => ({id, hi: 10}));
  return {
    players,
    courses: [
      {id: 'one', name: 'Course One', tees: [tee, {...tee, name: 'White'}]},
      {id: 'two', name: 'Course Two', tees: [{...tee, name: 'White'}]}
    ],
    slots: players.map(({id}, i) => ({
      playerId: id, side: i < 2 ? 'A' : 'B', courseId: i < 3 ? 'one' : 'two',
      teeName: i === 0 ? 'Yellow' : 'White', holesMode: i < 2 ? 'front9' : 'back9'
    }))
  };
}

test('locks a self-contained snapshot for each golfer across courses, tees and nines', () => {
  const draft = setup();
  const fixture = lockCrossCourseSetup(draft);
  assert.deepEqual(fixture.cards.map(card => card.playingHandicap), [0, 0, 2, 2]);
  assert.equal(fixture.cards[1].courseSnapshot.tee.name, 'White');
  assert.equal(fixture.cards[3].courseSnapshot.name, 'Course Two');
  assert.equal(fixture.cards[3].holes[0].number, 10);
  draft.courses[1].tees[0].holes[9].par = 5;
  assert.equal(fixture.cards[3].courseSnapshot.tee.holes[0].par, 4);
});

test('rejects a nine without its published rating and a fixture with mixed round lengths', () => {
  const unrated = setup();
  delete unrated.courses[1].tees[0].nineHoleRatings;
  assert.throws(() => lockCrossCourseSetup(unrated), /published rating and slope/);
  const mixed = setup();
  mixed.slots[3].holesMode = 'full18';
  assert.throws(() => lockCrossCourseSetup(mixed), /common round length/);
});
