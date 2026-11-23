import { isEnteredHoleScore } from './scoreInput.js';

export function eclecticCompletedRounds(card) {
  return Array.isArray(card?.eclecticRounds) ? card.eclecticRounds : [];
}

export function eclecticRoundNumber(card) {
  return eclecticCompletedRounds(card).length + 1;
}

export function eclecticRoundsRemaining(card, competition) {
  return Math.max(0, Math.max(2, Number(competition?.eclecticRounds) || 3) - eclecticCompletedRounds(card).length);
}

export function eclecticRoundComplete(card, selectedIndexes) {
  return selectedIndexes.every(index => isEnteredHoleScore(card?.gross?.[index]));
}

export function eclecticSourceRounds(card, includeCurrent = true) {
  const rounds = [...eclecticCompletedRounds(card)];
  if (includeCurrent && (card?.gross || []).some(isEnteredHoleScore)) {
    rounds.push({ round: rounds.length + 1, gross: card.gross });
  }
  return rounds;
}

export function eclecticBestGross(card, holeCount, includeCurrent = true) {
  const rounds = eclecticSourceRounds(card, includeCurrent);
  return Array.from({ length: holeCount }, (_, index) => {
    const entered = rounds.map(round => round?.gross?.[index]).filter(isEnteredHoleScore);
    const scores = entered.map(Number).filter(score => score > 0);
    if (scores.length) return Math.min(...scores);
    return entered.length ? 0 : '';
  });
}

export function submitEclecticRound(card, competition, selectedIndexes, details = {}) {
  if (!eclecticRoundsRemaining(card, competition)) throw new Error('ECLECTIC_COMPLETE');
  if (!eclecticRoundComplete(card, selectedIndexes)) throw new Error('ECLECTIC_ROUND_INCOMPLETE');
  const rounds = eclecticCompletedRounds(card);
  const round = rounds.length + 1;
  const submittedAt = details.submittedAt || new Date().toISOString();
  const eclecticRounds = [...rounds, {
    round,
    gross: [...(card.gross || [])],
    submittedAt,
    submittedBy: details.submittedBy || null,
    handicapIndexUsed: card.handicapIndexUsed,
    courseHandicap: card.courseHandicap,
    playingHandicap: card.playingHandicap,
  }];
  const complete = eclecticRounds.length >= Math.max(2, Number(competition?.eclecticRounds) || 3);
  return {
    ...card,
    eclecticRounds,
    gross: Array.from({ length: card.gross?.length || 18 }, () => ''),
    submitted: complete,
    submittedAt: complete ? submittedAt : null,
    updatedAt: submittedAt,
    lastEditedBy: details.submittedBy || card.lastEditedBy,
  };
}
