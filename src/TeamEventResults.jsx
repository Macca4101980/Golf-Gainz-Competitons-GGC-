import React from "react";
import { teamEventScore } from "./teamEvent.js";

export default function TeamEventResults({ record, state, onOpenCompetition }) {
  const score = teamEventScore(record, state);
  const sides = record.teamEvent?.sides || record.teams || [];
  const grouped = Object.groupBy
    ? Object.groupBy(score.fixtures, (fixture) => fixture.sessionName)
    : score.fixtures.reduce((output, fixture) => ({ ...output, [fixture.sessionName]: [...(output[fixture.sessionName] || []), fixture] }), {});
  return <div className="teamEventResults">
    <div className="card teamEventScoreboard">
      <small>TEAM EVENT</small><h3>{record.name}</h3>
      <div><span><b>{sides[0]?.name || "Side A"}</b><strong>{score.pointsA}</strong></span><em>–</em><span><b>{sides[1]?.name || "Side B"}</b><strong>{score.pointsB}</strong></span></div>
      <p>{score.completed} of {score.fixtures.length} matches complete</p>
    </div>
    {Object.entries(grouped).map(([session, fixtures]) => <div className="card" key={session}><h3>{session.toUpperCase()}</h3>{fixtures.map((fixture) => <button className="teamEventFixture" key={fixture.id} onClick={() => onOpenCompetition?.(fixture.competition)}><span><b>Match {fixture.position}</b><small>{fixture.competition?.name}</small></span><strong>{fixture.result.status === "complete" ? `${fixture.result.pointsA} – ${fixture.result.pointsB}` : fixture.competition?.status === "draft" ? "DRAFT" : fixture.result.label}</strong></button>)}</div>)}
  </div>;
}
