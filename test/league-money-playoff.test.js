import test from "node:test";
import assert from "node:assert/strict";
import {
  completedPlayoffPlacings,
  entrantPrizeShares,
  leagueEntrantMemberIds,
  linkedPrizePlayoffs,
  moneyEligibleLeagues,
  seasonPrizePots,
} from "../src/leagueMoneyModel.js";

const league = {
  id: "winter",
  name: "Winter League",
  societyId: "group",
  memberIds: ["a", "b", "c", "d"],
  teams: [
    { id: "team-a", memberIds: ["a", "b"] },
    { id: "team-b", memberIds: ["c", "d"] },
  ],
};
const playoff = {
  id: "playoff",
  name: "Winter League Knockouts",
  societyId: "group",
  recordType: "matchplay-series",
  structure: "playoff",
  sourceLeagueId: "winter",
  memberIds: ["a"],
  matchplay: {
    type: "knockout",
    rounds: 1,
    championId: "team-a",
    qualificationStatus: "qualified",
    fixtures: [
      {
        round: 1,
        slot: 0,
        status: "complete",
        entrantAId: "team-a",
        entrantBId: "team-b",
        winnerId: "team-a",
        loserId: "team-b",
      },
    ],
  },
};
const state = { leagues: [league, playoff] };

test("linked playoffs never become separate League Money ledgers", () => {
  assert.deepEqual(moneyEligibleLeagues(state, "group"), [league]);
  assert.deepEqual(linkedPrizePlayoffs(state, "winter"), [playoff]);
});

test("an expired unplayed semi leaves the completed semi as the payable deciding match", () => {
  const collapsed = structuredClone(playoff);
  collapsed.matchplay.rounds = 2;
  collapsed.matchplay.collapsedFinalFixtureId = "semi-one";
  collapsed.matchplay.runnerUpId = "team-b";
  collapsed.matchplay.fixtures = [
    {
      id: "semi-one",
      round: 1,
      slot: 0,
      status: "complete",
      entrantAId: "team-a",
      entrantBId: "team-b",
      winnerId: "team-a",
      loserId: "team-b",
    },
    { id: "final", round: 2, slot: 0, status: "void" },
  ];
  assert.deepEqual(completedPlayoffPlacings(collapsed), {
    winnerId: "team-a",
    runnerUpId: "team-b",
  });
});

test("remaining League money can be routed to the playoff or split", () => {
  assert.deepEqual(
    seasonPrizePots({ remainingLeaguePot: 160, destination: "playoff" }),
    { leaguePot: 0, playoffPot: 160, championBonus: 0 },
  );
  assert.deepEqual(
    seasonPrizePots({
      remainingLeaguePot: 160,
      destination: "split",
      playoffPercent: 75,
    }),
    { leaguePot: 40, playoffPot: 120, championBonus: 0 },
  );
  assert.deepEqual(
    seasonPrizePots({ remainingLeaguePot: 160, destination: "league-table" }),
    { leaguePot: 160, playoffPot: 0, championBonus: 0 },
  );
});

test("champion bonuses, separate funds and cancellation fallbacks are bounded", () => {
  assert.deepEqual(
    seasonPrizePots({
      remainingLeaguePot: 160,
      destination: "playoff",
      leagueChampionBonus: 20,
    }),
    { leaguePot: 0, playoffPot: 140, championBonus: 20 },
  );
  assert.deepEqual(
    seasonPrizePots({
      remainingLeaguePot: 160,
      destination: "separate",
      separatePlayoffPot: 50,
    }),
    { leaguePot: 160, playoffPot: 50, championBonus: 0 },
  );
  assert.deepEqual(
    seasonPrizePots({
      remainingLeaguePot: 160,
      destination: "playoff",
      playoffCancelled: true,
      cancellationFallback: "league-table",
    }),
    { leaguePot: 160, playoffPot: 0, championBonus: 0 },
  );
});

test("completed playoff resolves team winners to both golfers", () => {
  assert.deepEqual(completedPlayoffPlacings(playoff), {
    winnerId: "team-a",
    runnerUpId: "team-b",
  });
  assert.deepEqual(leagueEntrantMemberIds(league, "team-a"), ["a", "b"]);
  assert.deepEqual(entrantPrizeShares(league, "team-a", 96), [
    { playerId: "a", amount: 48 },
    { playerId: "b", amount: 48 },
  ]);
  assert.deepEqual(entrantPrizeShares(league, "team-b", 64), [
    { playerId: "c", amount: 32 },
    { playerId: "d", amount: 32 },
  ]);
});

test("forecast playoffs never produce payable placings", () => {
  assert.equal(
    completedPlayoffPlacings({
      ...playoff,
      matchplay: {
        ...playoff.matchplay,
        championId: null,
        qualificationStatus: "forecasted",
      },
    }),
    null,
  );
});
