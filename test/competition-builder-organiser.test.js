import test from "node:test";
import assert from "node:assert/strict";
import { createTeamEvent, manageTeamEvent, teamEventScore } from "../src/teamEvent.js";
import { recommendTemplates, templateById } from "../src/competitionBuilder.js";
import { createGroupStage, qualifyGroupStage, recordFixtureResult, recordSuddenDeathHole } from "../src/matchplayTournament.js";
import { currentMatchplayRecord, fixtureCompetitionPreset } from "../src/matchplaySeriesModel.js";

const holes = Array.from({ length: 18 }, (_, i) => ({n: i + 1, si: i + 1, par: 4}));
const tee = {name: "Green", holes, slope: 113, rating: 72};
const course = {id: "course", name: "Test course", tees: [tee]};
const players = Array.from({length: 8}, (_, i) => ({id: `p${i}`, name: `Golfer ${i}`, hi: 0}));
const createdAt = "2026-11-25T09:00:00.000Z";

test("organiser can rest golfers, change formats and publish one session while preserving the others", () => {
  const group = {id: "group", ownerId: "admin", members: players.map(p => p.id)};
  const {record, competitions} = createTeamEvent({
    template: templateById("ryder-solheim-cup"),
    setup: {societyId: group.id, courseId: course.id, teeName: tee.name,
      assignments: players.map((player, i) => ({playerId: player.id, side: i < 4 ? "A" : "B"}))},
    state: {courses: [course]}, createdBy: "admin", now: new Date(createdAt),
  });
  const start = {societies:[group], comps: competitions, leagues: [record], cards: [], players};
  const setup = {
    expectedUpdatedAt: record.updatedAt, sideNames: ["North", "South"], publish: "fourball",
    sessions: [
      {id: "fourball", name: "Opening singles", formatId: "singles", lineups: {A: [["p2"]], B: [["p6"]]}},
      {id: "later", name: "Final pairs", formatId: "foursomes", lineups: {A: [["p0", "p1"]], B: [["p4", "p5"]]}},
    ],
  };
  assert.throws(() => manageTeamEvent(start, record.id, "p0", setup), /organisers/);
  const next = manageTeamEvent(start, record.id, "admin", setup, new Date("2026-11-25T10:00Z"));
  assert.deepEqual(next.comps.map(comp => [comp.status, comp.format, comp.entries]), [
    ["live", "matchplay", ["p2","p6"]], ["draft", "foursomes-match", ["p0","p1","p4","p5"]],
  ]);
  assert.deepEqual(next.leagues[0].teams.map(team => team.name), ["North", "South"]);
  assert.ok(next.deletedCompIds.length);
  assert.throws(() => manageTeamEvent(next, record.id, "admin", setup), /event has changed/);
  assert.throws(() => manageTeamEvent(next, record.id, "admin", {...setup,
    expectedUpdatedAt: next.leagues[0].updatedAt, sessions: setup.sessions.slice(1)}), /cannot be removed/);
  const comp = next.comps[0];
  const cards = ["p6", "p2"].map(id => ({compId: comp.id, playerId: id, gross: holes.map(() => id === "p2" ? 4 : 5)}));
  assert.equal(teamEventScore(next.leagues[0], {...next, cards}).winnerSide, "A");
});

test("the Builder pairs template qualifies into two separately scored legs and breaks an aggregate tie", () => {
  assert.ok(recommendTemplates({audience:"pairs", style:"head-to-head", structure:"group-stage"})
    .some(template => template.id === "champions-league"));
  const entrants = Array.from({length: 4}, (_, i) => ({
    id: `team${i}`, name: `Pair ${i}`, memberIds: [players[i * 2].id, players[i * 2 + 1].id],
  }));
  let groups = createGroupStage({id:"test", entrants, entrantType:"team", legs:2, qualifiersPerGroup:1,
    points:{knockoutLegs:2}, createdAt});
  assert.equal(groups.fixtures.length, 4);
  for (const fixture of groups.fixtures) groups = recordFixtureResult(groups, fixture.id, {holesWonA: 4, holesWonB: 2});
  const matchplay = qualifyGroupStage(groups, {qualifiedAt:createdAt});
  const fixture = matchplay.fixtures[0];
  assert.throws(() => recordFixtureResult(matchplay, fixture.id, {holesWonA: 3}), /both legs/);
  const record = {id:"test", recordType:"matchplay-series", builderTemplateId:"champions-league", matchplay};
  const state = {players, courses:[course], leagues:[record], comps:[], cards:[]};
  const first = {...fixtureCompetitionPreset(record, fixture, state, 1), id:"leg1", status:"live",
    courseSnapshot:{tee}};
  const second = {...fixtureCompetitionPreset(record, fixture, state, 2), id:"leg2", status:"live",
    courseSnapshot:{tee}};
  assert.deepEqual(second.pairs[0].ids, first.pairs[1].ids);
  const score = (comp, winner, date) => comp.entries.map(id => ({
    compId:comp.id, playerId:id, submitted:true, submittedAt:date,
    gross: holes.map(() => winner.ids.includes(id) ? 4 : 5),
  }));
  const firstCards = score(first, first.pairs[0], "2026-11-26T12:00:00Z");
  const now = new Date("2026-11-28T12:00:00Z");
  const partial = firstCards.map(card => ({...card, gross:card.gross.slice(0, 11)}));
  assert.equal(currentMatchplayRecord(record, {...state, comps:[first], cards:partial}, now), record);
  const afterFirst = currentMatchplayRecord(record, {...state, comps:[first], cards:firstCards}, now);
  assert.equal(afterFirst.matchplay.fixtures[0].legResults[0].holesWonA, 18);
  assert.equal(afterFirst.matchplay.championId, null);
  const secondCards = score(second, second.pairs[0], "2026-11-27T12:00:00Z");
  const afterSecond = currentMatchplayRecord(record, {...state, comps:[first, second], cards:[...firstCards,...secondCards]}, now);
  assert.equal(afterSecond.matchplay.fixtures[0].status, "sudden-death");
  assert.equal(afterSecond.matchplay.fixtures[0].score.holesWonB, 18);
  const final = recordSuddenDeathHole(afterSecond.matchplay, fixture.id, {winnerId:fixture.entrantBId});
  assert.equal(final.championId, fixture.entrantBId);
});
