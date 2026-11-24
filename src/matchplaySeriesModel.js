import { leagueDisplayTable } from "./leagueDisplay.js";
import {
  createGroupStage,
  createKnockout,
  createLeaguePlayoff,
  createRoundRobin,
} from "./matchplayTournament.js";

const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const nowIso = () => new Date().toISOString();

export const isMatchplaySeries = (record) =>
  record?.recordType === "matchplay-series" && record?.matchplay;
export const standardLeagues = (state) =>
  (state?.leagues || []).filter((record) => !isMatchplaySeries(record));
export const matchplaySeries = (state) =>
  (state?.leagues || []).filter(isMatchplaySeries);

export function matchplayHandicapSettings(record, state) {
  const team = record?.matchplay?.entrantType === "team";
  const source =
    record?.handicapSettings?.source ||
    (record?.sourceLeagueId ? "league-start" : "current");
  const allowance = Math.max(
    0,
    Math.min(
      100,
      Number(record?.handicapSettings?.allowance ?? (team ? 90 : 100)),
    ),
  );
  const league = record?.sourceLeagueId
    ? standardLeagues(state).find((item) => item.id === record.sourceLeagueId)
    : null;
  const adjustmentMode =
    record?.handicapSettings?.adjustmentMode ||
    (record?.handicapSettings?.excludeLeagueAdjustments === false
      ? "league-final"
      : "none");
  const snapshot =
    source === "league-start"
      ? {
          ...(league?.startingHandicaps ||
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
  if (
    !isMatchplaySeries(record) ||
    record.matchplay?.qualificationStatus !== "forecasted" ||
    !record.sourceLeagueId
  )
    return record;
  const league = standardLeagues(state).find(
    (item) => item.id === record.sourceLeagueId,
  );
  if (!league) return record;
  const standings = sourceLeagueStandings(league, state, at),
    complete = leagueFinished(league, state, at);
  if (standings.length < 2) return record;
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
  return {
    ...record,
    matchplay,
    qualificationStatus: matchplay.qualificationStatus,
    updatedAt: complete ? at.toISOString() : record.updatedAt,
  };
}

export function lockFinishedPlayoffs(state, at = new Date()) {
  let changed = false;
  const leagues = (state.leagues || []).map((record) => {
    const resolved = currentMatchplayRecord(record, state, at);
    if (
      resolved !== record &&
      resolved.matchplay?.qualificationStatus === "qualified"
    ) {
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
    });
  } else if (mode === "round-robin")
    matchplay = createRoundRobin({
      id,
      name,
      societyId,
      entrants,
      entrantType,
      legs,
      points,
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
      points,
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
    });
  const resolvedHandicaps = handicapSettings || {
    source: sourceLeague ? "league-start" : "current",
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
    sourceLeagueId: sourceLeague?.id || null,
    memberIds: [
      ...new Set(entrants.flatMap((item) => item.memberIds || [item.id])),
    ],
    matchplay,
    handicapSettings: resolvedHandicaps,
    createdBy,
    createdAt,
    updatedAt: createdAt,
  };
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
  const source = handicapSource || existing.source,
    allowance = Math.max(
      0,
      Math.min(100, Number(handicapAllowance ?? existing.allowance)),
    ),
    adjustmentMode = record.sourceLeagueId
      ? handicapAdjustmentMode || existing.adjustmentMode
      : "none";
  return {
    ...record,
    name: String(name ?? record.name).trim() || record.name,
    matchplay,
    handicapSettings: {
      source,
      allowance,
      adjustmentMode,
      excludeLeagueAdjustments: adjustmentMode !== "league-final",
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
    format: team ? "fourball-match" : "matchplay",
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
