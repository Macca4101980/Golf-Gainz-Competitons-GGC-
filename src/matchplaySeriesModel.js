import { leagueDisplayTable } from "./leagueDisplay.js";
import {
  createGroupStage,
  createKnockout,
  createLeaguePlayoff,
  createRoundRobin,
  expireKnockoutSeries,
} from "./matchplayTournament.js";

const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const nowIso = () => new Date().toISOString();

export const isMatchplaySeries = (record) =>
  record?.recordType === "matchplay-series" && record?.matchplay;
export const standardLeagues = (state) =>
  (state?.leagues || []).filter((record) => !isMatchplaySeries(record) && record?.recordType !== "team-event");
export const matchplaySeries = (state) =>
  (state?.leagues || []).filter(isMatchplaySeries);
export const isLeaguePlayoffRecord = (record) =>
  isMatchplaySeries(record) &&
  (record.structure === "playoff" ||
    ["forecasted", "qualified"].includes(record.matchplay?.qualificationStatus));

export function matchplayHandicapSettings(record, state) {
  const team = record?.matchplay?.entrantType === "team";
  const linkedPlayoff = isLeaguePlayoffRecord(record);
  const storedSource =
    record?.handicapSettings?.source ||
    (linkedPlayoff ? "league-start" : "current");
  const storedAdjustment =
    record?.handicapSettings?.adjustmentMode ||
    (record?.handicapSettings?.excludeLeagueAdjustments === false
      ? "league-final"
      : "none");
  const source =
    storedSource === "league-start"
      ? storedAdjustment === "league-final"
        ? "competition-end"
        : "competition-start"
      : storedSource;
  const allowance = Math.max(
    0,
    Math.min(
      100,
      Number(record?.handicapSettings?.allowance ?? (team ? 90 : 100)),
    ),
  );
  const league = linkedPlayoff && record?.sourceLeagueId
    ? standardLeagues(state).find((item) => item.id === record.sourceLeagueId)
    : null;
  const adjustmentMode = source === "competition-end" ? "league-final" : "none";
  const snapshot =
    source === "competition-start" || source === "competition-end"
      ? {
          ...(league?.startingHandicaps ||
            record?.handicapSettings?.startSnapshot ||
            record?.handicapSettings?.snapshot ||
            {}),
        }
      : {};
  let adjustments = {};
  if (league && adjustmentMode === "league-final") {
    try {
      adjustments = Object.assign(
        {},
        ...leagueDisplayTable(league, state).table.map(
          (teamRow) => teamRow.finalAdjustments || {},
        ),
      );
    } catch {
      adjustments = {};
    }
  }
  return {
    source,
    allowance,
    adjustmentMode,
    excludeLeagueAdjustments: adjustmentMode !== "league-final",
    snapshot,
    adjustments,
  };
}

function sourceLeagueStandings(league, state, at = new Date()) {
  return leagueDisplayTable(league, state, at.getTime())
    .table.filter((row) => row.position)
    .map((row) => ({
      teamId: row.id,
      id: row.id,
      name: row.name,
      position: row.position,
      total: row.total,
    }));
}

function leagueFinished(league, state, at = new Date()) {
  const time = at.getTime(),
    competitions = (state.comps || []).filter(
      (comp) =>
        comp.leagueId === league.id &&
        comp.status !== "cancelled" &&
        comp.status !== "deleted",
    );
  return (
    competitions.length > 0 &&
    competitions.every((comp) => {
      if (
        comp.status !== "completed" &&
        (!comp.ends || Date.parse(comp.ends) > time)
      )
        return false;
      const release = comp.resultsEmbargo?.releaseAt;
      return !release || Date.parse(release) <= time;
    })
  );
}

export function currentMatchplayRecord(record, state, at = new Date()) {
  if (!isMatchplaySeries(record)) return record;
  let resolved = record;
  if (
    record.matchplay?.qualificationStatus === "forecasted" &&
    record.sourceLeagueId
  ) {
    const league = standardLeagues(state).find(
      (item) => item.id === record.sourceLeagueId,
    );
    if (league) {
      const standings = sourceLeagueStandings(league, state, at),
        complete = leagueFinished(league, state, at);
      if (standings.length >= 2) {
        const matchplay = createLeaguePlayoff({
          id: record.matchplay.id,
          name: record.name,
          leagueId: league.id,
          societyId: record.societyId,
          standings,
          size: record.matchplay.qualificationSize || 4,
          entrantType: (league.teams || []).length ? "team" : "individual",
          leagueComplete: complete,
          createdAt: complete ? at.toISOString() : record.createdAt,
          rules: record.matchplay.rules,
        });
        resolved = {
          ...record,
          matchplay,
          qualificationStatus: matchplay.qualificationStatus,
          updatedAt: complete ? at.toISOString() : record.updatedAt,
        };
      }
    }
  }
  const matchplay = expireKnockoutSeries(resolved.matchplay, {
    at: at.toISOString(),
  });
  if (matchplay === resolved.matchplay) return resolved;
  return {
    ...resolved,
    matchplay,
    status: matchplay.status === "cancelled" ? "cancelled" : resolved.status,
    updatedAt: at.toISOString(),
  };
}

export function lockFinishedPlayoffs(state, at = new Date()) {
  let changed = false;
  const leagues = (state.leagues || []).map((record) => {
    const resolved = currentMatchplayRecord(record, state, at);
    if (resolved !== record) {
      changed = true;
      return resolved;
    }
    return record;
  });
  return changed ? { ...state, leagues } : state;
}

export function buildMatchplayRecord({
  id = uid(),
  name,
  societyId,
  mode = "knockout",
  entrants = [],
  entrantType = "individual",
  sourceLeague = null,
  playoffSize = 4,
  groupCount = 2,
  qualifiersPerGroup = 2,
  legs = 1,
  points = {},
  roundTimeLimitDays = 21,
  handicapSettings = null,
  createdBy = null,
  createdAt = nowIso(),
  state,
} = {}) {
  let matchplay;
  if (mode === "playoff") {
    if (!sourceLeague || !state)
      throw new Error("Choose the League that supplies the playoff positions.");
    matchplay = createLeaguePlayoff({
      id,
      name,
      leagueId: sourceLeague.id,
      societyId,
      standings: sourceLeagueStandings(
        sourceLeague,
        state,
        new Date(createdAt),
      ),
      size: playoffSize,
      entrantType: (sourceLeague.teams || []).length ? "team" : "individual",
      leagueComplete: leagueFinished(sourceLeague, state, new Date(createdAt)),
      createdAt,
      rules: { roundTimeLimitDays },
    });
  } else if (mode === "round-robin")
    matchplay = createRoundRobin({
      id,
      name,
      societyId,
      entrants,
      entrantType,
      legs,
      points: { ...points, roundTimeLimitDays },
      createdAt,
    });
  else if (mode === "group-stage")
    matchplay = createGroupStage({
      id,
      name,
      societyId,
      entrants,
      entrantType,
      groupCount,
      qualifiersPerGroup,
      legs,
      points: { ...points, roundTimeLimitDays },
      createdAt,
    });
  else
    matchplay = createKnockout({
      id,
      name,
      societyId,
      entrants,
      entrantType,
      createdAt,
      rules: { roundTimeLimitDays },
    });
  const entrantMemberIds = [
    ...new Set(entrants.flatMap((item) => item.memberIds || [item.id])),
  ];
  const startSnapshot = Object.fromEntries(
    entrantMemberIds.map((playerId) => [
      playerId,
      Number(state?.players?.find((player) => player.id === playerId)?.hi) || 0,
    ]),
  );
  const linkedPlayoff = mode === "playoff";
  const requestedSource = handicapSettings?.source;
  if (!linkedPlayoff && requestedSource === "competition-end")
    throw new Error(
      "End-of-competition handicap position is only available for a linked League playoff.",
    );
  const resolvedHandicaps = handicapSettings || {
    source: linkedPlayoff ? "competition-start" : "current",
    allowance: matchplay.entrantType === "team" ? 90 : 100,
    adjustmentMode: "none",
    excludeLeagueAdjustments: true,
  };
  return {
    id,
    name,
    societyId,
    recordType: "matchplay-series",
    structure: mode,
    sourceLeagueId: linkedPlayoff ? sourceLeague?.id || null : null,
    entrantSourceLeagueId:
      !linkedPlayoff && entrantType === "team" ? sourceLeague?.id || null : null,
    memberIds: entrantMemberIds,
    matchplay,
    handicapSettings: {
      ...resolvedHandicaps,
      startSnapshot:
        resolvedHandicaps.startSnapshot ||
        resolvedHandicaps.snapshot ||
        startSnapshot,
    },
    createdBy,
    createdAt,
    updatedAt: createdAt,
  };
}

export function rebuildMatchplayRecord(
  record,
  state,
  {
    name,
    structure,
    groupCount,
    qualifiersPerGroup,
    legs,
    points,
    roundTimeLimitDays,
    handicapSource,
    handicapAllowance,
  } = {},
) {
  if (!isMatchplaySeries(record))
    throw new Error("Matchplay competition not found.");
  if (isLeaguePlayoffRecord(record))
    throw new Error("A linked League playoff must remain a knockout.");
  const mode = structure || record.structure || record.matchplay?.type || "knockout";
  const existing = matchplayHandicapSettings(record, state);
  const entrants = (record.matchplay?.entrants || []).map((entrant, index) => ({
    ...entrant,
    seed: Number(entrant.seed) || index + 1,
  }));
  if (mode === "group-stage" && entrants.length < 4)
    throw new Error("A group stage needs at least four entrants.");
  const existingGroups = record.matchplay?.groups?.length || 2;
  const requestedGroups = Math.max(
    2,
    Math.min(Math.floor(entrants.length / 2), Number(groupCount) || existingGroups),
  );
  const smallestGroup = Math.floor(entrants.length / requestedGroups);
  const requestedQualifiers = Math.max(
    1,
    Math.min(
      Math.max(1, smallestGroup - 1),
      Number(qualifiersPerGroup) || record.matchplay?.qualifiersPerGroup || 1,
    ),
  );
  const source = handicapSource || existing.source;
  if (source === "competition-end")
    throw new Error(
      "End-of-competition handicap position is only available for a linked League playoff.",
    );
  const allowance = Math.max(
    0,
    Math.min(100, Number(handicapAllowance ?? existing.allowance)),
  );
  return buildMatchplayRecord({
    id: record.id,
    name: String(name ?? record.name).trim() || record.name,
    societyId: record.societyId,
    mode,
    entrants,
    entrantType: record.matchplay?.entrantType || "individual",
    groupCount: requestedGroups,
    qualifiersPerGroup: requestedQualifiers,
    legs: Number(legs) || record.matchplay?.legs || 1,
    points: points || record.matchplay?.rules || {},
    roundTimeLimitDays:
      roundTimeLimitDays ?? record.matchplay?.rules?.roundTimeLimitDays ?? 21,
    handicapSettings: {
      source,
      allowance,
      adjustmentMode: source === "competition-end" ? "league-final" : "none",
      excludeLeagueAdjustments: source !== "competition-end",
      startSnapshot:
        record.handicapSettings?.startSnapshot || existing.snapshot || {},
    },
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    state,
  });
}

export function editMatchplayRecord(
  record,
  state,
  {
    name,
    playoffSize,
    handicapSource,
    handicapAllowance,
    handicapAdjustmentMode,
    roundTimeLimitDays,
  } = {},
) {
  if (!isMatchplaySeries(record))
    throw new Error("Matchplay competition not found.");
  const scorecards = (state?.comps || []).filter(
    (comp) => comp.matchplaySeriesId === record.id,
  );
  const existing = matchplayHandicapSettings(record, state);
  if (
    scorecards.length &&
    ((handicapSource && handicapSource !== existing.source) ||
      (handicapAllowance != null &&
        Number(handicapAllowance) !== existing.allowance) ||
      (handicapAdjustmentMode &&
        handicapAdjustmentMode !== existing.adjustmentMode))
  )
    throw new Error(
      "Handicap rules are locked because a knockout scorecard has already been created.",
    );
  let matchplay = record.matchplay;
  const deadlineDays = Math.max(
    1,
    Math.min(
      365,
      Number(roundTimeLimitDays ?? matchplay.rules?.roundTimeLimitDays ?? 21) || 21,
    ),
  );
  const size = Math.max(
    2,
    Number(playoffSize || matchplay.qualificationSize || 4),
  );
  if (
    record.sourceLeagueId &&
    matchplay.qualificationStatus === "forecasted" &&
    size !== matchplay.qualificationSize
  ) {
    const league = standardLeagues(state).find(
      (item) => item.id === record.sourceLeagueId,
    );
    if (!league) throw new Error("The linked League could not be found.");
    matchplay = createLeaguePlayoff({
      id: matchplay.id,
      name: String(name || record.name).trim() || record.name,
      leagueId: league.id,
      societyId: record.societyId,
      standings: sourceLeagueStandings(league, state),
      size,
      entrantType: (league.teams || []).length ? "team" : "individual",
      leagueComplete: false,
      createdAt: record.createdAt,
      rules: matchplay.rules,
    });
  }
  if (["knockout", "group-stage"].includes(matchplay.type)) {
    const rules = { ...(matchplay.rules || {}), roundTimeLimitDays: deadlineDays };
    const fixtures = (matchplay.fixtures || []).map((fixture) => {
      if (
        matchplay.type !== "knockout" ||
        !fixture.activatedAt ||
        !["scheduled", "live", "sudden-death"].includes(fixture.status)
      )
        return fixture;
      return {
        ...fixture,
        expiresAt: new Date(
          Date.parse(fixture.activatedAt) + deadlineDays * 86400000,
        ).toISOString(),
      };
    });
    matchplay = { ...matchplay, rules, fixtures };
  }
  const source = handicapSource || existing.source,
    allowance = Math.max(
      0,
      Math.min(100, Number(handicapAllowance ?? existing.allowance)),
    ),
    adjustmentMode = source === "competition-end" ? "league-final" : "none";
  if (source === "competition-end" && !isLeaguePlayoffRecord(record))
    throw new Error(
      "End-of-competition handicap position is only available for a linked League playoff.",
    );
  return {
    ...record,
    name: String(name ?? record.name).trim() || record.name,
    matchplay,
    handicapSettings: {
      source,
      allowance,
      adjustmentMode,
      excludeLeagueAdjustments: adjustmentMode !== "league-final",
      startSnapshot:
        record.handicapSettings?.startSnapshot ||
        record.handicapSettings?.snapshot ||
        existing.snapshot,
    },
    updatedAt: nowIso(),
  };
}

export function fixtureCompetitionPreset(record, fixture, state) {
  const series = record?.matchplay;
  if (!isMatchplaySeries(record) || !fixture)
    throw new Error("Matchplay fixture not found.");
  if (
    series.qualificationStatus === "forecasted" ||
    fixture.status === "forecasted"
  )
    throw new Error(
      "Forecast fixtures cannot have scorecards until the League is final.",
    );
  if (!fixture.entrantAId || !fixture.entrantBId)
    throw new Error(
      "Both fixture entrants must be known before creating a scorecard.",
    );
  const entrantA = series.entrants.find(
      (item) => item.id === fixture.entrantAId,
    ),
    entrantB = series.entrants.find((item) => item.id === fixture.entrantBId);
  if (!entrantA || !entrantB)
    throw new Error("Fixture entrants are missing from this matchplay series.");
  const team = series.entrantType === "team",
    members = (item) => [...new Set(item.memberIds || [item.id])];
  const pairs = team
    ? [entrantA, entrantB].map((item) => ({
        id: item.id,
        name: item.name,
        ids: members(item),
      }))
    : [];
  const handicaps = matchplayHandicapSettings(record, state || {});
  return {
    name: `${record.name} · ${entrantA.name} v ${entrantB.name}`,
    societyId: record.societyId,
    format: record.eventFormat || (team ? "fourball-match" : "matchplay"),
    course: record.course || null,
    tee: record.tee || null,
    courseSnapshot: record.courseSnapshot || null,
    handicapAllowance: handicaps.allowance,
    handicapSource: handicaps.source,
    handicapSnapshot: handicaps.snapshot,
    handicapAdjustments: handicaps.adjustments,
    excludeLeagueAdjustments: handicaps.excludeLeagueAdjustments,
    entries: [...new Set([...members(entrantA), ...members(entrantB)])],
    pairs,
    pairingMode: "preset",
    matchplaySeriesId: record.id,
    matchplayFixtureId: fixture.id,
  };
}
