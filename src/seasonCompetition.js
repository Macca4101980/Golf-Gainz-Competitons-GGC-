import { FORMAT_RULES, oomPointsForField, scoreCard } from "./scoring.js";

const asNumber = (value, fallback = 0) => Number.isFinite(+value) ? +value : fallback;
const completed = (competition) => ["complete", "completed"].includes(competition?.status);

export const SEASON_TEMPLATE_RULES = Object.freeze({
  "club-championship": Object.freeze({
    scoring: "aggregate-gross",
    rounds: 2,
    cut: null,
  }),
  "golf-tour": Object.freeze({
    scoring: "position-points",
    rounds: 4,
    bestCount: 0,
  }),
  "order-of-merit": Object.freeze({
    scoring: "position-points",
    rounds: 8,
    bestCount: 0,
  }),
  "race-to-dubai": Object.freeze({
    scoring: "position-points",
    rounds: 8,
    bestCount: 0,
    eventWeights: {},
    finalEventWeight: 2,
  }),
  "fedex-cup": Object.freeze({
    scoring: "position-points",
    rounds: 8,
    bestCount: 0,
    playoffs: [{ afterRound: 6, fieldSize: 30 }, { afterRound: 7, fieldSize: 10 }],
  }),
  "the-open": Object.freeze({
    scoring: "aggregate-gross",
    rounds: 4,
    cut: { afterRound: 2, fieldSize: 70, includeTies: true },
  }),
});

export function seasonRules(templateId, patch = {}) {
  const base = SEASON_TEMPLATE_RULES[templateId];
  if (!base) return null;
  return {
    ...structuredClone(base),
    ...patch,
    cut: patch.cut === undefined ? structuredClone(base.cut || null) : patch.cut,
    playoffs: patch.playoffs === undefined ? structuredClone(base.playoffs || []) : patch.playoffs,
    eventWeights: { ...(base.eventWeights || {}), ...(patch.eventWeights || {}) },
  };
}

function activeCards(competition, state) {
  return (state.cards || [])
    .filter((card) => card.compId === competition.id)
    .map((card) => {
      try {
        const result = scoreCard(card, competition, state);
        return result?.player && result.complete > 0 ? result : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function eventWeight(rules, competition, index, total) {
  const explicit = asNumber(rules.eventWeights?.[competition.id] ?? rules.eventWeights?.[index + 1], NaN);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (index === total - 1 && asNumber(rules.finalEventWeight) > 0) return asNumber(rules.finalEventWeight);
  return 1;
}

export function seasonEventRows(record, competition, state, eventIndex = 0, totalEvents = 1) {
  const rules = record?.seasonRules || seasonRules(record?.builderTemplateId) || { scoring: "position-points" };
  const rows = activeCards(competition, state);
  const lowerWins = rules.scoring === "aggregate-gross" || rules.scoring === "aggregate-nett" || FORMAT_RULES[competition.format]?.lowerWins;
  rows.sort(lowerWins
    ? (a, b) => asNumber(rules.scoring === "aggregate-gross" ? a.gross : a.rankValue) - asNumber(rules.scoring === "aggregate-gross" ? b.gross : b.rankValue)
    : (a, b) => asNumber(b.rankValue) - asNumber(a.rankValue));
  const points = oomPointsForField(rows.length);
  const weight = eventWeight(rules, competition, eventIndex, totalEvents);
  return rows.map((row, index) => ({
    playerId: row.player.id,
    player: row.player,
    position: index + 1,
    gross: asNumber(row.gross),
    nett: asNumber(row.net),
    stableford: asNumber(row.points),
    value: rules.scoring === "aggregate-gross"
      ? asNumber(row.gross)
      : rules.scoring === "aggregate-nett"
        ? asNumber(row.net)
        : rules.scoring === "stableford-total"
          ? asNumber(row.points)
          : asNumber(points[index]) * weight,
    weight,
  }));
}

function cutoffIds(rows, fieldSize, includeTies) {
  const count = Math.max(1, Math.floor(asNumber(fieldSize, rows.length)));
  if (rows.length <= count) return rows.map((row) => row.playerId);
  const selected = rows.slice(0, count);
  if (includeTies) {
    const boundary = selected.at(-1)?.total;
    selected.push(...rows.slice(count).filter((row) => row.total === boundary));
  }
  return selected.map((row) => row.playerId);
}

export function seasonStandings(record, state) {
  const rules = record?.seasonRules || seasonRules(record?.builderTemplateId) || { scoring: "position-points" };
  const events = (state.comps || [])
    .filter((competition) => competition.leagueId === record.id && completed(competition))
    .sort((a, b) => Date.parse(a.starts || 0) - Date.parse(b.starts || 0));
  const byPlayer = new Map();
  events.forEach((competition, eventIndex) => {
    seasonEventRows(record, competition, state, eventIndex, Math.max(events.length, record.targetCompetitions || events.length))
      .forEach((row) => {
        const values = byPlayer.get(row.playerId) || [];
        values.push({ ...row, competitionId: competition.id, competitionName: competition.name, eventIndex });
        byPlayer.set(row.playerId, values);
      });
  });
  const lowerWins = ["aggregate-gross", "aggregate-nett"].includes(rules.scoring);
  const bestCount = Math.max(0, Math.floor(asNumber(rules.bestCount)));
  const rows = [...byPlayer].map(([playerId, results]) => {
    const ordered = lowerWins
      ? [...results].sort((a, b) => a.value - b.value)
      : [...results].sort((a, b) => b.value - a.value);
    const counting = bestCount ? ordered.slice(0, bestCount) : ordered;
    return {
      playerId,
      player: (state.players || []).find((player) => player.id === playerId),
      played: results.length,
      total: counting.reduce((sum, result) => sum + result.value, 0),
      results,
      countingCompetitionIds: counting.map((result) => result.competitionId),
    };
  }).filter((row) => row.player);
  rows.sort(lowerWins
    ? (a, b) => a.total - b.total || a.player.name.localeCompare(b.player.name)
    : (a, b) => b.total - a.total || a.player.name.localeCompare(b.player.name));
  rows.forEach((row, index) => { row.position = index + 1; });
  return { rules, events, rows, lowerWins, bestCount };
}

export function seasonQualification(record, state, afterRound) {
  const standings = seasonStandings(record, state);
  const rules = standings.rules;
  const round = Math.max(1, Math.floor(asNumber(afterRound, standings.events.length)));
  const cut = rules.cut?.afterRound === round ? rules.cut : null;
  const playoff = (rules.playoffs || []).find((stage) => stage.afterRound === round);
  const stage = cut || playoff;
  if (!stage || standings.events.length < round) return null;
  return {
    afterRound: round,
    fieldSize: stage.fieldSize,
    includeTies: cut?.includeTies === true,
    playerIds: cutoffIds(standings.rows, stage.fieldSize, cut?.includeTies === true),
  };
}

export function applySeasonProgression(record, state) {
  const competitions = (state.comps || [])
    .filter((competition) => competition.leagueId === record.id)
    .sort((a, b) => Date.parse(a.starts || 0) - Date.parse(b.starts || 0));
  let changed = false;
  const updated = new Map();
  for (const stage of [record.seasonRules?.cut, ...(record.seasonRules?.playoffs || [])].filter(Boolean)) {
    const qualification = seasonQualification(record, state, stage.afterRound);
    const next = competitions[stage.afterRound];
    if (!qualification || !next || completed(next)) continue;
    const entries = qualification.playerIds;
    if (JSON.stringify(next.entries || []) === JSON.stringify(entries)) continue;
    changed = true;
    updated.set(next.id, {
      ...next,
      entries,
      invites: (next.invites || []).filter((id) => entries.includes(id)),
      seasonQualification: qualification,
      updatedAt: new Date().toISOString(),
    });
  }
  if (!changed) return state;
  return { ...state, comps: (state.comps || []).map((competition) => updated.get(competition.id) || competition) };
}
