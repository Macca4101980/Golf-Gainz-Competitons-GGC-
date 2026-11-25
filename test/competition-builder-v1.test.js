import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPETITION_TEMPLATES,
  automaticAssignments,
  recommendTemplates,
  templateById,
  templatePreset,
  validateBuilderSetup,
} from "../src/competitionBuilder.js";
import { createTeamEvent } from "../src/teamEvent.js";

const tee = {
  id: "green",
  name: "Green",
  rating: 71.2,
  slope: 126,
  holes: Array.from({ length: 18 }, (_, index) => ({ n: index + 1, par: 4, si: index + 1 })),
};
const state = { courses: [{ id: "farthingstone", name: "Farthingstone", tees: [tee] }] };

test("existing template IDs resolve with descriptive golf names", () => {
  assert.equal(COMPETITION_TEMPLATES.length, 17);
  assert.equal(templateById("winter-league-farthingstone").name, "Pairs Winter League");
  assert.equal(templateById("hollingsworth-trophy").name, "Inter-Club Foursomes Match");
  assert.match(templateById("ryder-solheim-cup").summary, /\(The Ryder Cup\)/);
});

test("recommendations require matching scoring and structure, even for favourites", () => {
  const results = recommendTemplates({ audience: "individual", style: "course", structure: "day" }, ["fa-cup", "the-open"]);
  assert.deepEqual(results.map((item) => item.id), ["traditional-golf-day"]);
  assert.deepEqual(
    recommendTemplates({ audience: "individual", style: "head-to-head", structure: "group-stage" }).map((item) => item.id),
    ["world-cup"],
  );
  assert.deepEqual(
    recommendTemplates({ audience: "societies", style: "head-to-head" }).map((item) => item.id),
    ["hollingsworth-trophy", "ryder-solheim-cup"],
  );
});

test("knockout validation warns about byes without blocking a valid field", () => {
  const issues = validateBuilderSetup({
    template: templateById("fa-cup"),
    entrantIds: ["a", "b", "c", "d", "e"],
    courseId: "farthingstone",
    teeName: "Green",
    state,
  });
  assert.ok(issues.some((issue) => issue.code === "knockout-byes" && issue.level === "amber"));
  assert.equal(issues.some((issue) => issue.level === "red"), false);
});

test("Ryder / Solheim validation enforces four golfers per side", () => {
  const issues = validateBuilderSetup({
    template: templateById("ryder-solheim-cup"),
    entrantIds: ["a", "b", "c", "d", "e", "f"],
    teamAssignments: [
      { playerId: "a", side: "A" }, { playerId: "b", side: "A" }, { playerId: "c", side: "A" },
      { playerId: "d", side: "B" }, { playerId: "e", side: "B" }, { playerId: "f", side: "B" },
    ],
    courseId: "farthingstone",
    teeName: "Green",
    state,
  });
  assert.ok(issues.some((issue) => issue.code === "entrants-min" && issue.level === "red"));
});

test("course and tee are hard launch requirements", () => {
  const issues = validateBuilderSetup({ template: templateById("traditional-golf-day"), entrantIds: ["a"], state });
  assert.ok(issues.some((issue) => issue.code === "course"));
  assert.ok(issues.some((issue) => issue.code === "tee"));
});

test("automatic assignments are complete, unique and balanced", () => {
  const ids = Array.from({ length: 9 }, (_, index) => `p${index + 1}`);
  const sides = automaticAssignments(ids, { sides: 2, seed: 42 });
  assert.equal(new Set(sides.map((item) => item.playerId)).size, ids.length);
  assert.ok(Math.abs(sides.filter((item) => item.side === "A").length - sides.filter((item) => item.side === "B").length) <= 1);
  const groups = automaticAssignments(ids, { size: 4, seed: 42 });
  assert.deepEqual(groups.map((group) => group.length), [4, 4, 1]);
});

test("template preset carries entrants, course, tee and automatic teams into existing setup", () => {
  const preset = templatePreset(templateById("traditional-golf-day"), {
    societyId: "group-1",
    entrantIds: ["a", "b"],
    courseId: "farthingstone",
    teeName: "Green",
    assignments: [["a", "b"]],
  });
  assert.equal(preset.societyId, "group-1");
  assert.equal(preset.course, "farthingstone");
  assert.equal(preset.tee, "Green");
  assert.deepEqual(preset.entries, ["a", "b"]);
  assert.deepEqual(preset.pairs[0].ids, ["a", "b"]);
});

test("Ryder / Solheim template creates Four-Ball, Foursomes and Singles fixtures", () => {
  const ids = Array.from({ length: 8 }, (_, index) => `p${index + 1}`);
  const players = ids.map((id, index) => ({ id, name: id, hi: index + 1 }));
  const assignments = ids.map((playerId, index) => ({ playerId, side: index % 2 ? "B" : "A" }));
  const created = createTeamEvent({
    template: templateById("ryder-solheim-cup"),
    setup: { name: "Test Ryder Cup", societyId: "group-1", assignments, courseId: "farthingstone", teeName: "Green" },
    state: { ...state, players },
    createdBy: "admin",
    now: new Date("2026-11-25T12:00:00Z"),
  });
  assert.equal(created.record.recordType, "team-event");
  assert.equal(created.competitions.filter((competition) => competition.format === "fourball-match").length, 2);
  assert.equal(created.competitions.filter((competition) => competition.format === "foursomes-match").length, 2);
  assert.equal(created.competitions.filter((competition) => competition.format === "matchplay").length, 4);
  assert.ok(created.competitions.every((competition) => competition.courseSnapshot?.tee?.name === "Green"));
});

test("County and Hollingsworth templates generate the agreed match counts", () => {
  const build = (templateId, perSide) => {
    const ids = Array.from({ length: perSide * 2 }, (_, index) => `g${index + 1}`);
    return createTeamEvent({
      template: templateById(templateId),
      setup: { societyId: "group-1", assignments: ids.map((playerId, index) => ({ playerId, side: index < perSide ? "A" : "B" })), courseId: "farthingstone", teeName: "Green" },
      state: { ...state, players: ids.map((id) => ({ id, hi: 10 })) },
    });
  };
  assert.equal(build("county-handicap-league", 12).competitions.length, 6);
  assert.equal(build("hollingsworth-trophy", 10).competitions.length, 5);
});
