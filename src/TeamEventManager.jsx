import React, { useState } from "react";
import { TEAM_SESSION_FORMATS, teamEventSessionDraft } from "./teamEvent.js";

const formats = Object.values(TEAM_SESSION_FORMATS);
const sideKeys = ["A", "B"];

export default function TeamEventManager({ record, state, onSave }) {
  const [expectedUpdatedAt] = useState(record.updatedAt);
  const [names, setNames] = useState(() => record.teamEvent.sides.map(side => side.name));
  const [sessions, setSessions] = useState(() => record.teamEvent.sessions.map(session => {
    const { A, B, locked } = teamEventSessionDraft(record, session.id, state);
    return { id: session.id, name: session.name, locked,
      formatId: formats.find(format => format.format === session.format)?.id || "fourball",
      lineups: { A, B } };
  }));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const playerNames = new Map(state.players.map(player => [player.id, player.name]));
  const update = (id, edit) => setSessions(previous => previous.map(session =>
    session.id === id ? edit(session) : session));
  const emptyMatch = formatId => Array(TEAM_SESSION_FORMATS[formatId].playersPerMatch).fill("");
  const newLineups = formatId => ({ A: [emptyMatch(formatId)], B: [emptyMatch(formatId)] });

  function move(items, from, to) {
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  }

  function editMatch(session, edit) {
    return { ...session, lineups: Object.fromEntries(sideKeys.map(side =>
      [side, edit(session.lineups[side], side)])) };
  }

  async function save(publish) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await onSave({ sideNames: names, sessions, publish, expectedUpdatedAt });
    } catch (failure) {
      setError(failure.message || "Could not save the event.");
    } finally {
      setPending(false);
    }
  }

  return <div className="teamEventManager">
    <p className="muted">Choose the golfers for each match. Anyone left out rests that session. Publishing opens its scorecards.</p>
    <fieldset disabled={pending}>
      {names.map((name, index) => <label key={index}>Side {sideKeys[index]} name
        <input value={name} onChange={event => setNames(previous => previous.map((value, i) => i === index ? event.target.value : value))} />
      </label>)}
      {sessions.map((session, index) => <details className="card" key={session.id}>
        <summary>{session.name || "New session"} · {session.lineups.A.length} matches · {session.locked ? "Locked" : "Draft"}</summary>
        <div className="matchFixtureActions">
          <button type="button" className="mini secondary" disabled={index === 0} onClick={() => setSessions(previous => move(previous, index, index - 1))}>Move session up</button>
          {!session.locked && <button type="button" className="mini secondary" disabled={sessions.length === 1} onClick={() => setSessions(previous => previous.filter(item => item.id !== session.id))}>Remove draft session</button>}
        </div>
        {!session.locked && <>
          <label>Session name<input value={session.name} onChange={event => update(session.id, item => ({ ...item, name: event.target.value }))} /></label>
          <label>Match format<select value={session.formatId} onChange={event => {
            const formatId = event.target.value;
            update(session.id, item => ({ ...item, formatId, lineups: newLineups(formatId) }));
          }}>{formats.map(format => <option key={format.id} value={format.id}>{format.name}</option>)}</select></label>
        </>}
        {session.lineups.A.map((_, matchIndex) => <fieldset key={matchIndex} disabled={session.locked}>
          <legend>Match {matchIndex + 1}</legend>
          {sideKeys.map((side, sideIndex) => {
            const used = new Set(session.lineups[side].flat());
            return session.lineups[side][matchIndex].map((playerId, slot) => <label key={`${side}-${slot}`}>
              {names[sideIndex]} · Golfer {slot + 1}
              <select value={playerId} onChange={event => {
                const value = event.target.value;
                update(session.id, item => editMatch(item, (matches, key) => key === side
                  ? matches.map((match, i) => i === matchIndex ? match.map((id, j) => j === slot ? value : id) : match)
                  : matches));
              }}>
                <option value="">Choose golfer</option>
                {record.teamEvent.sides[sideIndex].memberIds.map(id =>
                  <option value={id} key={id} disabled={id !== playerId && used.has(id)}>{playerNames.get(id) || "Unavailable golfer"}</option>)}
              </select>
            </label>);
          })}
          {!session.locked && <div className="matchFixtureActions">
            <button type="button" className="mini secondary" disabled={matchIndex === 0} onClick={() =>
              update(session.id, item => editMatch(item, matches => move(matches, matchIndex, matchIndex - 1)))}>Move match up</button>
            <button type="button" className="mini secondary" disabled={session.lineups.A.length === 1} onClick={() =>
              update(session.id, item => editMatch(item, matches => matches.filter((_, i) => i !== matchIndex)))}>Remove match</button>
          </div>}
        </fieldset>)}
        {!session.locked && <div className="matchFixtureActions">
          <button type="button" className="mini secondary" disabled={session.lineups.A.length >= Math.floor(record.teamEvent.sides[0].memberIds.length / TEAM_SESSION_FORMATS[session.formatId].playersPerMatch)}
            onClick={() => update(session.id, item => editMatch(item, matches => [...matches, emptyMatch(item.formatId)]))}>Add match</button>
          <button type="button" className="mini primary" onClick={() => {
            if (confirm(`Save changes and open scorecards for ${session.name}?`)) void save(session.id);
          }}>Save and publish session</button>
        </div>}
      </details>)}
      <button type="button" className="secondary" onClick={() => setSessions(previous => [...previous, {
        id: crypto.randomUUID(), name: "New session", formatId: "fourball", lineups: newLineups("fourball"),
      }])}>Add session</button>
      <button type="button" className="primary" onClick={() => void save()}>Save event changes</button>
    </fieldset>
    {error && <p role="alert" className="autherror">{error}</p>}
  </div>;
}
