import test from "node:test";
import assert from "node:assert/strict";
import { applySeasonProgression, seasonRules, seasonStandings } from "../src/seasonCompetition.js";

const holes = Array.from({ length: 18 }, (_, index) => ({ n: index + 1, par: 4, si: index + 1 }));
const players = Array.from({ length: 6 }, (_, index) => ({ id: `p${index + 1}`, name: `Player ${index + 1}`, hi: 0 }));
const courseSnapshot = { name: "Test", tee: { name: "Green", rating: 72, slope: 113, holes } };
const competition = (id, round, status = "completed") => ({
  id, leagueId: "season", name: `Round ${round}`, starts: `2026-0${round}-01T08:00:00Z`, status,
  format: "gross-stroke", handicapAllowance: 0, holesMode: "18", courseSnapshot, entries: players.map((player) => player.id),
});
const cardsFor = (compId, offset = 0) => players.map((player, index) => ({
  id: `${compId}-${player.id}`, compId, playerId: player.id, playingHandicap: 0,
  gross: Array(18).fill(4 + index + offset), submitted: true,
}));

test("a club championship aggregates completed gross rounds", () => {
  const comps = [competition("r1", 1), competition("r2", 2)];
  const state = { players, comps, cards: [...cardsFor("r1"), ...cardsFor("r2")] };
  const record = { id: "season", builderTemplateId: "club-championship", seasonRules: seasonRules("club-championship") };
  const result = seasonStandings(record, state);
  assert.equal(result.rows[0].playerId, "p1");
  assert.equal(result.rows[0].played, 2);
  assert.equal(result.rows[0].total, 144);
});

test("Race to Dubai applies the configured final-event weighting", () => {
  const comps = [competition("r1", 1), competition("r2", 2)];
  const state = { players, comps, cards: [...cardsFor("r1"), ...cardsFor("r2")] };
  const record = { id: "season", builderTemplateId: "race-to-dubai", targetCompetitions: 2, seasonRules: seasonRules("race-to-dubai") };
  const result = seasonStandings(record, state);
  assert.equal(result.rows[0].results[0].weight, 1);
  assert.equal(result.rows[0].results[1].weight, 2);
  assert.equal(result.rows[0].total, result.rows[0].results[0].value + result.rows[0].results[1].value);
});

test("cut and playoff progression restricts the next round automatically", () => {
  const comps = [competition("r1", 1), competition("r2", 2), competition("r3", 3, "scheduled")];
  const rules = seasonRules("the-open", { cut: { afterRound: 2, fieldSize: 2, includeTies: true } });
  const state = { players, comps, cards: [...cardsFor("r1"), ...cardsFor("r2")] };
  const record = { id: "season", builderTemplateId: "the-open", seasonRules: rules };
  const next = applySeasonProgression(record, state);
  assert.deepEqual(next.comps.find((item) => item.id === "r3").entries, ["p1", "p2"]);
  assert.equal(next.comps.find((item) => item.id === "r3").seasonQualification.afterRound, 2);
});
