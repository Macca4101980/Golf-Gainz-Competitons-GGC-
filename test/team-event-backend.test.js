import test from "node:test";
import assert from "node:assert/strict";
import { createTeamEvent } from "../src/teamEvent.js";
import { templateById } from "../src/competitionBuilder.js";

const holes = Array.from({ length: 18 }, (_, index) => ({ n: index + 1, par: 4, si: index + 1 }));
const course = { id: "course", name: "Course", tees: [{ id: "green", name: "Green", rating: 72, slope: 113, holes }] };

test("team-event backend accepts organiser-defined session line-ups", () => {
  const ids = Array.from({ length: 8 }, (_, index) => `p${index + 1}`);
  const assignments = ids.map((playerId, index) => ({ playerId, side: index < 4 ? "A" : "B" }));
  const created = createTeamEvent({
    template: templateById("ryder-solheim-cup"),
    setup: {
      societyId: "group", assignments, courseId: "course", teeName: "Green",
      sessions: [{ id: "opening", formatId: "fourball", name: "Opening Four-Balls" }],
      sessionLineups: { opening: { A: [["p1", "p3"], ["p2", "p4"]], B: [["p5", "p7"], ["p6", "p8"]] } },
    },
    state: { courses: [course], players: ids.map((id) => ({ id, hi: 0 })) },
  });
  assert.equal(created.competitions.length, 2);
  assert.deepEqual(created.competitions[0].pairs[0].ids, ["p1", "p3"]);
  assert.equal(created.record.teamEvent.sessions[0].name, "Opening Four-Balls");
});

test("team-event backend rejects duplicate golfers within one session", () => {
  const ids = Array.from({ length: 8 }, (_, index) => `p${index + 1}`);
  assert.throws(() => createTeamEvent({
    template: templateById("ryder-solheim-cup"),
    setup: {
      societyId: "group", assignments: ids.map((playerId, index) => ({ playerId, side: index < 4 ? "A" : "B" })), courseId: "course", teeName: "Green",
      sessions: [{ id: "opening", formatId: "fourball" }],
      sessionLineups: { opening: { A: [["p1", "p2"], ["p1", "p3"]], B: [["p5", "p6"], ["p7", "p8"]] } },
    },
    state: { courses: [course] },
  }), /same golfer twice/);
});

test("county template stores aggregate-holes-up as its result rule", () => {
  const ids = Array.from({ length: 24 }, (_, index) => `p${index + 1}`);
  const created = createTeamEvent({
    template: templateById("county-handicap-league"),
    setup: { societyId: "group", assignments: ids.map((playerId, index) => ({ playerId, side: index < 12 ? "A" : "B" })), courseId: "course", teeName: "Green" },
    state: { courses: [course] },
  });
  assert.equal(created.record.teamEvent.resultMode, "aggregate-holes-up");
  assert.equal(created.record.teamEvent.fixtures.length, 6);
});
