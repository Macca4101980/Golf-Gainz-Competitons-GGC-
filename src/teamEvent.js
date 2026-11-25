import { buildCourseSnapshot } from "./competitionCourse.js";
import { fourballMatchResult } from "./scoring.js";
import { matchPlayResult, sharedBallMatchResult } from "./advancedScoring.js";

const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

const sidePlayers = (assignments, side) =>
  (assignments || []).filter((item) => item.side === side).map((item) => item.playerId);

const chunks = (values, size) => {
  const output = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
};

function sessionPlan(templateId) {
  if (templateId === "county-handicap-league") return [{ id: "fourball", name: "Four-Ball", format: "fourball-match" }];
  if (templateId === "hollingsworth-trophy") return [{ id: "foursomes", name: "Foursomes", format: "foursomes-match" }];
  return [
    { id: "fourball", name: "Four-Ball", format: "fourball-match" },
    { id: "foursomes", name: "Foursomes", format: "foursomes-match" },
    { id: "singles", name: "Singles", format: "matchplay" },
  ];
}

export function createTeamEvent({ template, setup, state, createdBy, now = new Date() }) {
  if (!template || template.family !== "team-event") throw new Error("Choose a team-event template.");
  const sideA = sidePlayers(setup.assignments, "A");
  const sideB = sidePlayers(setup.assignments, "B");
  const minimum = template.entrantRule?.perSide || 4;
  if (sideA.length < minimum || sideB.length < minimum) throw new Error(`Each side needs at least ${minimum} golfers.`);
  if (sideA.length !== sideB.length) throw new Error("Balance the two sides before creating the event.");
  const course = (state.courses || []).find((item) => item.id === setup.courseId);
  const courseSnapshot = buildCourseSnapshot(course, setup.teeName);
  if (!courseSnapshot) throw new Error("Choose a complete course and tee.");
  const eventId = uid();
  const createdAt = now.toISOString();
  const ends = new Date(now.getTime() + 21 * 86400000).toISOString();
  const fixtures = [];
  const comps = [];
  const sessions = sessionPlan(template.id);
  const side = { A: { id: `${eventId}-a`, name: "Side A", memberIds: sideA }, B: { id: `${eventId}-b`, name: "Side B", memberIds: sideB } };

  const addFixture = ({ session, index, aIds, bIds }) => {
    const fixtureId = `${eventId}-${session.id}-${index + 1}`;
    const compId = uid();
    const pairMatch = session.format !== "matchplay";
    const pairs = pairMatch ? [
      { id: `${fixtureId}-a`, name: `Side A · Pair ${index + 1}`, ids: aIds },
      { id: `${fixtureId}-b`, name: `Side B · Pair ${index + 1}`, ids: bIds },
    ] : [];
    fixtures.push({ id: fixtureId, competitionId: compId, sessionId: session.id, sessionName: session.name, position: index + 1, sideAPlayerIds: aIds, sideBPlayerIds: bIds, status: "draft" });
    comps.push({
      id: compId,
      societyId: setup.societyId,
      createdBy,
      name: `${setup.name || template.name} · ${session.name} ${index + 1}`,
      format: session.format,
      handicapAllowance: session.format === "matchplay" ? 100 : 90,
      course: setup.courseId,
      tee: setup.teeName,
      courseSnapshot,
      fee: 0,
      days: 21,
      holesMode: "18",
      starts: createdAt,
      ends,
      entries: [...aIds, ...bIds],
      invites: [],
      pairs,
      pairingMode: pairMatch ? "preset" : "on-day",
      status: "draft",
      showLiveLeaderboard: true,
      teamEventId: eventId,
      teamEventFixtureId: fixtureId,
      updatedAt: createdAt,
    });
  };

  for (const session of sessions) {
    if (session.format === "matchplay") {
      sideA.forEach((playerId, index) => addFixture({ session, index, aIds: [playerId], bIds: [sideB[index]] }));
    } else {
      const pairsA = chunks(sideA, 2), pairsB = chunks(sideB, 2);
      pairsA.forEach((aIds, index) => addFixture({ session, index, aIds, bIds: pairsB[index] }));
    }
  }

  const record = {
    id: eventId,
    societyId: setup.societyId,
    recordType: "team-event",
    builderTemplateId: template.id,
    name: setup.name || template.name,
    memberIds: [...sideA, ...sideB],
    course: setup.courseId,
    tee: setup.teeName,
    courseSnapshot,
    teams: [side.A, side.B],
    teamEvent: { sides: [side.A, side.B], sessions, fixtures, pointsForWin: 1, pointsForHalf: 0.5 },
    createdBy,
    createdAt,
    updatedAt: createdAt,
  };
  return { record, competitions: comps };
}

export function teamEventRecords(state) {
  return (state?.leagues || []).filter((record) => record.recordType === "team-event" && record.teamEvent);
}

export function teamEventFixtureResult(fixture, competition, state) {
  if (!competition) return { status: "not-created", pointsA: 0, pointsB: 0, label: "Not created" };
  let result = null;
  if (["4bbb-match", "fourball-match"].includes(competition.format) && competition.pairs?.length === 2) {
    const match = fourballMatchResult(competition.pairs[0], competition.pairs[1], competition, state);
    result = { complete: match.decided, winner: match.up > 0 ? 0 : match.up < 0 ? 1 : null, label: match.text };
  } else if (competition.format === "foursomes-match") result = sharedBallMatchResult(competition, state);
  else result = matchPlayResult(competition, state, { stopWhenDecided: false });
  if (!result?.complete) return { status: "open", pointsA: 0, pointsB: 0, label: result?.label || "Awaiting result" };
  if (result.winner == null) return { status: "complete", pointsA: 0.5, pointsB: 0.5, label: result.label || "Halved" };
  return { status: "complete", pointsA: result.winner === 0 ? 1 : 0, pointsB: result.winner === 1 ? 1 : 0, label: result.label };
}

export function teamEventScore(record, state) {
  const fixtures = (record?.teamEvent?.fixtures || []).map((fixture) => {
    const competition = (state.comps || []).find((item) => item.id === fixture.competitionId);
    return { ...fixture, competition, result: teamEventFixtureResult(fixture, competition, state) };
  });
  return {
    fixtures,
    pointsA: fixtures.reduce((total, fixture) => total + fixture.result.pointsA, 0),
    pointsB: fixtures.reduce((total, fixture) => total + fixture.result.pointsB, 0),
    completed: fixtures.filter((fixture) => fixture.result.status === "complete").length,
  };
}
