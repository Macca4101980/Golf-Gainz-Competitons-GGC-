import {
  isLeaguePlayoffRecord,
  matchplaySeries,
  standardLeagues,
} from "./matchplaySeriesModel.js";

export const SEASON_PRIZE_DESTINATIONS = Object.freeze({
  LEAGUE: "league-table",
  PLAYOFF: "playoff",
  SPLIT: "split",
  SEPARATE: "separate",
});

export function moneyEligibleLeagues(state, societyId) {
  return standardLeagues(state).filter(
    (league) =>
      league.societyId === societyId && (league.memberIds || []).length,
  );
}

export function linkedPrizePlayoffs(state, leagueId) {
  return matchplaySeries(state).filter(
    (record) =>
      record.sourceLeagueId === leagueId && isLeaguePlayoffRecord(record),
  );
}

export function leaguePrizeForecast({
  memberCount = 0,
  entryFeePerPlayer = 0,
  twosFeePerPlayer = 0,
  scheduledWeeks = 0,
  weeklyPrizePerPlayer = 0,
  weeklyWinnerRecipients = 1,
} = {}) {
  const players = Math.max(0, Number(memberCount) || 0),
    entryFund = players * Math.max(0, Number(entryFeePerPlayer) || 0),
    twosFund = players * Math.max(0, Number(twosFeePerPlayer) || 0),
    totalCollected = entryFund + twosFund,
    weeklyPrizeFund =
      Math.max(0, Number(scheduledWeeks) || 0) *
      Math.max(0, Number(weeklyPrizePerPlayer) || 0) *
      Math.max(1, Number(weeklyWinnerRecipients) || 1);
  return {
    totalCollected,
    twosFund,
    entryFund,
    weeklyPrizeFund,
    seasonEndingFund: Math.max(0, entryFund - weeklyPrizeFund),
  };
}

export function seasonPrizePots({
  remainingLeaguePot = 0,
  destination = SEASON_PRIZE_DESTINATIONS.LEAGUE,
  playoffPercent = 50,
  separatePlayoffPot = 0,
  leagueChampionBonus = 0,
  playoffCancelled = false,
  cancellationFallback = "league-table",
} = {}) {
  const available = Math.max(0, Number(remainingLeaguePot) || 0);
  if (playoffCancelled && cancellationFallback === "league-table")
    return { leaguePot: available, playoffPot: 0, championBonus: 0 };
  if (destination === SEASON_PRIZE_DESTINATIONS.SEPARATE)
    return {
      leaguePot: available,
      playoffPot: Math.max(0, Number(separatePlayoffPot) || 0),
      championBonus: 0,
    };
  const championBonus =
    destination === SEASON_PRIZE_DESTINATIONS.LEAGUE
      ? 0
      : Math.min(available, Math.max(0, Number(leagueChampionBonus) || 0));
  const distributable = available - championBonus;
  if (destination === SEASON_PRIZE_DESTINATIONS.PLAYOFF)
    return { leaguePot: 0, playoffPot: distributable, championBonus };
  if (destination === SEASON_PRIZE_DESTINATIONS.SPLIT) {
    const percentage = Math.max(0, Math.min(100, Number(playoffPercent) || 0));
    const playoffPot = (distributable * percentage) / 100;
    return {
      leaguePot: distributable - playoffPot,
      playoffPot,
      championBonus,
    };
  }
  return { leaguePot: available, playoffPot: 0, championBonus: 0 };
}

export function completedPlayoffPlacings(record) {
  const matchplay = record?.matchplay;
  if (!matchplay?.championId || !Array.isArray(matchplay.fixtures)) return null;
  const final = matchplay.collapsedFinalFixtureId
    ? matchplay.fixtures.find(
        (fixture) => fixture.id === matchplay.collapsedFinalFixtureId,
      )
    : matchplay.fixtures.find(
        (fixture) => fixture.round === matchplay.rounds && fixture.slot === 0,
      );
  if (!final || !["complete", "bye"].includes(final.status)) return null;
  const winnerId = final.winnerId || matchplay.championId;
  const runnerUpId =
    final.loserId ||
    matchplay.runnerUpId ||
    [final.entrantAId, final.entrantBId].find(
      (entrantId) => entrantId && entrantId !== winnerId,
    ) ||
    null;
  return { winnerId, runnerUpId };
}

export function leagueEntrantMemberIds(league, entrantId) {
  if (!entrantId) return [];
  const team = (league?.teams || []).find((item) => item.id === entrantId);
  return team?.memberIds?.length ? [...team.memberIds] : [entrantId];
}

export function entrantPrizeShares(league, entrantId, amount) {
  const memberIds = leagueEntrantMemberIds(league, entrantId),
    total = Math.max(0, Number(amount) || 0),
    share = memberIds.length ? total / memberIds.length : 0;
  return memberIds.map((playerId) => ({ playerId, amount: share }));
}
