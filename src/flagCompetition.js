import { isEnteredHoleScore, isNoReturnScore } from './scoreInput.js';

export function flagStrokeBudget(coursePar, playingHandicap) {
  return Math.max(1, Math.round((Number(coursePar) || 0) + (Number(playingHandicap) || 0)));
}

export function flagDistanceYards(distance, unit = 'yards') {
  const value = Math.max(0, Number(distance) || 0);
  return unit === 'feet' ? value / 3 : value;
}

export function flagRankValue(result) {
  if (!result?.planted || !Number.isFinite(Number(result.absoluteHole))) return Number.NEGATIVE_INFINITY;
  return (Number(result.absoluteHole) * 1_000_000) - flagDistanceYards(result.distanceToPin, result.distanceUnit);
}

export function ordinalHole(value) {
  const n = Math.max(1, Math.round(Number(value) || 1));
  const mod100 = n % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

export function formatFlagResult(result) {
  if (!result?.planted) return '';
  const hole = ordinalHole(result.absoluteHole);
  const shots = Math.max(0, Number(result.strokesOnFinalHole) || 0);
  const distance = Math.max(0, Number(result.distanceToPin) || 0);
  const unit = result.distanceUnit === 'feet' ? 'ft' : 'yds';
  const position = distance === 0 ? 'holed' : `${distance} ${unit} remaining`;
  return `${hole} hole · ${shots} shot${shots === 1 ? '' : 's'} · ${position} ⛳️`;
}

export function flagProgress(card, selectedIndexes, holes, playingHandicap) {
  const indexes = selectedIndexes.filter(i => holes[i]);
  const selectedPar = indexes.reduce((sum, i) => sum + (Number(holes[i]?.par) || 0), 0);
  const budget = flagStrokeBudget(selectedPar, playingHandicap);
  let grossUsed = 0;
  let completedHoles = 0;
  let lastCompletedGross = 0;
  let invalid = false;
  for (const i of indexes) {
    const value = card?.gross?.[i];
    if (!isEnteredHoleScore(value)) break;
    if (isNoReturnScore(value)) { invalid = true; break; }
    grossUsed += Number(value) || 0;
    lastCompletedGross = Number(value) || 0;
    completedHoles += 1;
  }
  const continuationGross = Array.isArray(card?.flagContinuationGross)
    ? card.flagContinuationGross.map(Number).filter(value => Number.isFinite(value) && value > 0)
    : [];
  const continuationUsed = continuationGross.reduce((sum, value) => sum + value, 0);
  const currentShots = Math.max(0, Number(card?.flagCurrentHoleStrokes) || 0);
  const usedBeforeCurrent = grossUsed + continuationUsed;
  return {
    budget,
    selectedPar,
    grossUsed,
    continuationGross,
    continuationUsed,
    usedBeforeCurrent,
    currentShots,
    strokesUsed: usedBeforeCurrent + currentShots,
    remainingBeforeCurrent: budget - usedBeforeCurrent,
    remaining: budget - usedBeforeCurrent - currentShots,
    completedHoles: completedHoles + continuationGross.length,
    absoluteHole: completedHoles + continuationGross.length + 1,
    lastCompletedGross: continuationGross.length ? continuationGross[continuationGross.length - 1] : lastCompletedGross,
    invalid,
  };
}

export function createFlagResult({ progress, distanceToPin, distanceUnit, location }) {
  if (!progress || progress.invalid) throw Error('Enter valid completed-hole scores before planting the flag.');
  if (progress.remaining !== 0) throw Error(`Use all ${progress.budget} permitted strokes before planting the flag.`);
  if (distanceToPin === '' || distanceToPin === null || distanceToPin === undefined) throw Error('Enter the final distance to the pin.');
  const distance = Number(distanceToPin);
  if (!Number.isFinite(distance) || distance < 0) throw Error('Enter a valid final distance to the pin.');
  if (!['yards', 'feet'].includes(distanceUnit)) throw Error('Choose yards or feet.');
  if (!location) throw Error('Choose where the ball finished.');
  return {
    planted: true,
    absoluteHole: progress.remainingBeforeCurrent === 0 && progress.currentShots === 0 ? progress.completedHoles : progress.absoluteHole,
    courseHole: (((progress.remainingBeforeCurrent === 0 && progress.currentShots === 0 ? progress.completedHoles : progress.absoluteHole) - 1) % 18) + 1,
    strokesOnFinalHole: progress.currentShots || progress.lastCompletedGross,
    distanceToPin: distance,
    distanceUnit,
    location,
    strokeBudget: progress.budget,
    strokesUsed: progress.strokesUsed,
    plantedAt: new Date().toISOString(),
  };
}
