import {buildCourseSnapshot} from './competitionCourse.js';
import {prepareCrossCourseMatch} from './crossCourseMatch.js';

// Resolve selections against the organiser's course catalogue at fixture lock time.
export function lockCrossCourseSetup({slots, players, courses, allowance}) {
  const selections = slots.map(({playerId, side, courseId, teeName, holesMode}) => {
    const player = players.find(item => item.id === playerId);
    const course = courses.find(item => item.id === courseId);
    const tee = course?.tees.find(item => item.name === teeName);
    const snapshot = buildCourseSnapshot(course, teeName);
    if (!player || !Number.isFinite(player.hi) || !snapshot || !tee ||
        !['full18', 'front9', 'back9'].includes(holesMode)) {
      throw new Error('Choose a golfer, course, tees and holes for every fixture slot.');
    }

    const full = holesMode === 'full18';
    const start = holesMode === 'back9' ? 10 : 1;
    const length = full ? 18 : 9;
    const holes = snapshot.tee.holes.filter(hole => hole.n >= start && hole.n < start + length)
      .sort((a, b) => a.n - b.n);
    const ratings = full ? tee : tee.nineHoleRatings?.[holesMode];
    if (holes.length !== length || !Number.isFinite(ratings?.rating) || !Number.isFinite(ratings?.slope)) {
      throw new Error(`A complete card and published rating and slope are required for ${course.name} · ${teeName} · ${holesMode}.`);
    }

    return {
      id: playerId, side, courseId, teeId: tee.id || tee.name, handicapIndex: player.hi,
      rating: ratings.rating, slope: ratings.slope,
      holes: holes.map(hole => ({number: hole.n, par: hole.par, si: hole.si})),
      courseSnapshot: {...snapshot, tee: {...snapshot.tee, rating: ratings.rating, slope: ratings.slope, holes}},
      holesMode
    };
  });

  const fixture = prepareCrossCourseMatch(selections, allowance);
  return {
    ...fixture,
    cards: fixture.cards.map((card, index) => ({
      ...card,
      courseSnapshot: selections[index].courseSnapshot,
      holesMode: selections[index].holesMode
    }))
  };
}
