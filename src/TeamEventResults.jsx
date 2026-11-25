import React from "react";
import { teamEventScore } from "./teamEvent.js";

export default function TeamEventResults({ record, state, onOpenCompetition }) {
  const score = teamEventScore(record, state);
  const aggregate = score.resultMode === "aggregate-holes-up";
  const sides = record.teamEvent?.sides || record.teams || [];
  const sessions = record.teamEvent.sessions;
  const grouped = Map.groupBy
    ? Map.groupBy(score.fixtures, fixture => fixture.sessionId)
    : score.fixtures.reduce((groups, fixture) => {
      if (!groups.has(fixture.sessionId)) groups.set(fixture.sessionId, []);
      groups.get(fixture.sessionId).push(fixture);
      return groups;
    }, new Map());
  return <div className="teamEventResults">
    <div className="card teamEventScoreboard">
      <small>TEAM EVENT</small><h3>{record.name}</h3>
      <div><span><b>{sides[0]?.name || "Side A"}</b><strong>{aggregate ? Math.max(0, score.aggregateHolesUp) : score.pointsA}</strong></span><em>–</em><span><b>{sides[1]?.name || "Side B"}</b><strong>{aggregate ? Math.max(0, -score.aggregateHolesUp) : score.pointsB}</strong></span></div>
      <p>{score.completed} of {score.fixtures.length} matches complete{aggregate ? " · aggregate holes up" : ""}</p>
    </div>
    {sessions.map(session => <div className="card" key={session.id}><h3>{session.name.toUpperCase()}</h3>{(grouped.get(session.id) || []).map((fixture) => <button className="teamEventFixture" key={fixture.id} disabled={!fixture.competition || fixture.competition.status === "draft"} onClick={() => onOpenCompetition?.(fixture.competition)}><span><b>Match {fixture.position}</b><small>{fixture.competition?.name}</small></span><strong>{fixture.result.status === "complete" ? (aggregate ? fixture.result.label : `${fixture.result.pointsA} – ${fixture.result.pointsB}`) : fixture.competition?.status === "draft" ? "DRAFT" : fixture.result.label}</strong></button>)}</div>)}
  </div>;
}
