import {holeStrokes, playingHandicapFromRaw, rawCourseHandicap, whsRound} from './scoring.js';

export function prepareCrossCourseMatch(players, allowance = 90) {
  const length = players[0]?.holes.length;
  if (players.length !== 4 || new Set(players.map(player => player.id)).size !== 4 ||
      players.filter(player => player.side === 'A').length !== 2 ||
      players.filter(player => player.side === 'B').length !== 2 ||
      ![9, 18].includes(length) || players.some(player => player.holes.length !== length) || !Number.isFinite(allowance) || allowance < 0 || allowance > 100) {
    throw new Error('A match needs two pairs, a valid allowance and a common round length.');
  }

  const cards = players.map(({id, side, courseId, teeId, handicapIndex, rating, slope, holes}) => {
    if (!id || !courseId || !teeId || !Number.isFinite(handicapIndex) ||
        !Number.isFinite(rating) || rating <= 0 || !Number.isFinite(slope) || slope <= 0 ||
        holes.length !== length || new Set(holes.map(hole => hole.si)).size !== length ||
        new Set(holes.map(hole => hole.number)).size !== length ||
        holes.some(hole => !Number.isInteger(hole.par) || hole.par <= 0 ||
          !Number.isInteger(hole.si) || hole.si < 1 || hole.si > 18 ||
          !Number.isInteger(hole.number) || hole.number < 1 || hole.number > 18)) {
      throw new Error('Each golfer needs a rated tee and a complete snapshot of the selected holes.');
    }
    const par = holes.reduce((total, hole) => total + hole.par, 0);
    const index = length === 9 ? handicapIndex / 2 : handicapIndex;
    return {
      id, side, courseId, teeId, handicapIndex, rating, slope,
      courseHandicap: whsRound(rawCourseHandicap(index, {rating, slope}, par)),
      holes: holes.map(({number, par, si}) => ({number, par, si}))
    };
  });
  const lowest = Math.min(...cards.map(card => card.courseHandicap));
  return {
    allowance,
    length,
    cards: cards.map(card => {
      const playingHandicap = playingHandicapFromRaw(card.courseHandicap - lowest, allowance);
      const indexes = card.holes.map(hole => hole.si).sort((a, b) => a - b);
      return {
        ...card,
        playingHandicap,
        holes: card.holes.map(hole => ({
          ...hole,
          shots: length === 18 ? holeStrokes(playingHandicap, hole.si) :
            Math.floor(playingHandicap / length) +
              Number(indexes.indexOf(hole.si) < playingHandicap % length)
        }))
      };
    })
  };
}

// Run on authorised server data. Each input is a committed gross score by playing order.
// Missing scores remain private even when another golfer has already locked their hole.
export function crossCourseMatchResult(fixture, lockedScores) {
  const holes = [];
  let up = 0;
  let result = null;
  for (let index = 0; index < fixture.length; index++) {
    const entries = fixture.cards.map(card => lockedScores.get(card.id)?.[index]);
    if (!entries.every(score => Number.isSafeInteger(score) && score >= 0)) break;
    const scores = fixture.cards.map((card, playerIndex) => {
      const {number, par, shots} = card.holes[index];
      const gross = entries[playerIndex];
      return {id: card.id, side: card.side, number, par, shots, gross,
        netToPar: gross === 0 ? null : gross - shots - par};
    });
    const best = side => Math.min(...scores.filter(score => score.side === side)
      .map(score => score.netToPar ?? Infinity));
    const a = best('A');
    const b = best('B');
    const winner = a < b ? 'A' : b < a ? 'B' : null;
    if (!result) {
      up += winner === 'A' ? 1 : winner === 'B' ? -1 : 0;
      const left = fixture.length - index - 1;
      if (left === 0 || Math.abs(up) > left) {
        result = {winner: up > 0 ? 'A' : up < 0 ? 'B' : null, up, left, decidedOn: index + 1};
      }
    }
    holes.push({played: index + 1, scores, winner, up});
  }
  return {holes, up, result};
}
