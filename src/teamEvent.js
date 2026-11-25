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

export const TEAM_SESSION_FORMATS = Object.freeze({
  fourball: Object.freeze({ id: "fourball", name: "Four-Ball", format: "fourball-match", playersPerMatch: 2, handicapAllowance: 90 }),
  foursomes: Object.freeze({ id: "foursomes", name: "Foursomes", format: "foursomes-match", playersPerMatch: 2, handicapAllowance: 50 }),
  singles: Object.freeze({ id: "singles", name: "Singles", format: "matchplay", playersPerMatch: 1, handicapAllowance: 100 }),
});

const templatePlan = (templateId) => {
  if (templateId === "county-handicap-league")
    return { resultMode: "aggregate-holes-up", sessions: [{ ...TEAM_SESSION_FORMATS.fourball, useAllPlayers: true }] };
  if (templateId === "hollingsworth-trophy")
    return { resultMode: "match-points", sessions: [{ ...TEAM_SESSION_FORMATS.foursomes, useAllPlayers: true }] };
  if (templateId === "presidents-cup")
    return {
      resultMode: "match-points",
      sessions: [
        { ...TEAM_SESSION_FORMATS.fourball, id: "fourball-1", name: "Four-Ball Session 1", useAllPlayers: true },
        { ...TEAM_SESSION_FORMATS.foursomes, id: "foursomes-1", name: "Foursomes Session 1", useAllPlayers: true },
        { ...TEAM_SESSION_FORMATS.fourball, id: "fourball-2", name: "Four-Ball Session 2", useAllPlayers: true },
        { ...TEAM_SESSION_FORMATS.singles, useAllPlayers: true },
      ],
    };
  return {
    resultMode: "match-points",
    sessions: [
      { ...TEAM_SESSION_FORMATS.fourball, useAllPlayers: true },
      { ...TEAM_SESSION_FORMATS.foursomes, useAllPlayers: true },
      { ...TEAM_SESSION_FORMATS.singles, useAllPlayers: true },
    ],
  };
};

function normaliseSessions(templateId, requested) {
  const plan = templatePlan(templateId);
  if (!requested?.length) return plan;
  const ids = new Set();
  const sessions = requested.map((item, index) => {
    const base = TEAM_SESSION_FORMATS[item.formatId || item.id] || Object.values(TEAM_SESSION_FORMATS).find((format) => format.format === item.format);
    if (!base) throw new Error(`Unsupported team session format at position ${index + 1}.`);
    const id = String(item.id || `${base.id}-${index + 1}`);
    if (ids.has(id)) throw new Error("Every team-event session needs a unique name.");
    ids.add(id);
    return {
      ...base,
      ...item,
      id,
      name: String(item.name || base.name),
      playersPerMatch: base.playersPerMatch,
      format: base.format,
      handicapAllowance: Number.isFinite(+item.handicapAllowance) ? +item.handicapAllowance : base.handicapAllowance,
    };
  });
  return { resultMode: requested.resultMode || plan.resultMode, sessions };
}

function sessionLineups(session, sideA, sideB, requested = {}) {
  const size = session.playersPerMatch;
  const resolve = (side, roster) => {
    const lineups = requested[side];
    if (!lineups) return chunks(roster, size);
    const used = new Set();
    return lineups.map((lineup, index) => {
      const ids = [...new Set(lineup)].filter((id) => roster.includes(id));
      if (ids.length !== size) throw new Error(`${session.name} ${side} match ${index + 1} needs ${size} golfer${size === 1 ? "" : "s"}.`);
      if (ids.some((id) => used.has(id))) throw new Error(`${session.name} cannot use the same golfer twice on Side ${side}.`);
      ids.forEach((id) => used.add(id));
      return ids;
    });
  };
  const a = resolve("A", sideA), b = resolve("B", sideB);
  if (a.length !== b.length) throw new Error(`${session.name} needs the same number of matches for each side.`);
  if (!a.length) throw new Error(`${session.name} needs at least one match.`);
  if ([...a, ...b].some((lineup) => lineup.length !== size)) throw new Error(`${session.name} has an incomplete line-up.`);
  return { A: a, B: b };
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
  const plan = normaliseSessions(template.id, setup.sessions);
  const sessions = plan.sessions;
  const side = { A: { id: `${eventId}-a`, name: "Side A", memberIds: sideA }, B: { id: `${eventId}-b`, name: "Side B", memberIds: sideB } };

  const addFixture = ({ session, index, aIds, bIds }) => {
    const fixtureId = `${eventId}-${session.id}-${index + 1}`;
    const compId = uid();
    const pairMatch = session.playersPerMatch === 2;
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
      handicapAllowance: session.handicapAllowance,
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
      pairingMode: "preset",
      status: "draft",
      showLiveLeaderboard: true,
      teamEventId: eventId,
      teamEventFixtureId: fixtureId,
      updatedAt: createdAt,
    });
  };

  for (const session of sessions) {
    const lineups = sessionLineups(session, sideA, sideB, setup.sessionLineups?.[session.id]);
    lineups.A.forEach((aIds, index) => addFixture({ session, index, aIds, bIds: lineups.B[index] }));
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
    teamEvent: {
      sides: [side.A, side.B],
      sessions,
      fixtures,
      resultMode: setup.resultMode || plan.resultMode,
      pointsForWin: Number.isFinite(+setup.pointsForWin) ? +setup.pointsForWin : 1,
      pointsForHalf: Number.isFinite(+setup.pointsForHalf) ? +setup.pointsForHalf : 0.5,
    },
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
    result = { complete: match.decided, winner: match.up > 0 ? 0 : match.up < 0 ? 1 : null, label: match.text, holeDifference: match.up };
  } else if (competition.format === "foursomes-match") result = sharedBallMatchResult(competition, state);
  else result = matchPlayResult(competition, state, { stopWhenDecided: false });
  if (!result?.complete) return { status: "open", pointsA: 0, pointsB: 0, label: result?.label || "Awaiting result" };
  const holeDifference = Number(result.holeDifference ?? result.diff ?? 0);
  if (result.winner == null) return { status: "complete", pointsA: 0.5, pointsB: 0.5, holeDifference, label: result.label || "Halved" };
  return { status: "complete", pointsA: result.winner === 0 ? 1 : 0, pointsB: result.winner === 1 ? 1 : 0, holeDifference, label: result.label };
}

export function teamEventScore(record, state) {
  const fixtures = (record?.teamEvent?.fixtures || []).map((fixture) => {
    const competition = (state.comps || []).find((item) => item.id === fixture.competitionId);
    return { ...fixture, competition, result: teamEventFixtureResult(fixture, competition, state) };
  });
  const win = Number(record?.teamEvent?.pointsForWin ?? 1);
  const half = Number(record?.teamEvent?.pointsForHalf ?? 0.5);
  const pointsA = fixtures.reduce((total, fixture) => total + (fixture.result.status !== "complete" ? 0 : fixture.result.pointsA === 1 ? win : fixture.result.pointsA === 0.5 ? half : 0), 0);
  const pointsB = fixtures.reduce((total, fixture) => total + (fixture.result.status !== "complete" ? 0 : fixture.result.pointsB === 1 ? win : fixture.result.pointsB === 0.5 ? half : 0), 0);
  const aggregateHolesUp = fixtures.filter((fixture) => fixture.result.status === "complete").reduce((total, fixture) => total + Number(fixture.result.holeDifference || 0), 0);
  const resultMode = record?.teamEvent?.resultMode || "match-points";
  return {
    fixtures,
    resultMode,
    pointsA,
    pointsB,
    aggregateHolesUp,
    winnerSide: resultMode === "aggregate-holes-up"
      ? aggregateHolesUp > 0 ? "A" : aggregateHolesUp < 0 ? "B" : null
      : pointsA > pointsB ? "A" : pointsB > pointsA ? "B" : null,
    completed: fixtures.filter((fixture) => fixture.result.status === "complete").length,
  };
}
