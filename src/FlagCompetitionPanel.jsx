import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { createFlagResult, flagProgress, formatFlagResult } from './flagCompetition.js';

const LOCATIONS = ['Tee', 'Fairway', 'Rough', 'Bunker', 'Penalty area', 'Green'];

export default function FlagCompetitionPanel({ players, cardFor, selectedIndexes, holes, playingHandicapFor, onChange, onPlant }) {
  const [errors, setErrors] = useState({});
  function errorFor(id, message = '') { setErrors(current => ({ ...current, [id]: message })); }
  function update(id, changes) { errorFor(id); onChange(id, changes); }
  function plant(player, card, progress) {
    try {
      const result = createFlagResult({
        progress,
        distanceToPin: card.flagDistanceToPin,
        distanceUnit: card.flagDistanceUnit || 'yards',
        location: card.flagLocation || '',
      });
      errorFor(player.id);
      onPlant(player.id, result);
    } catch (error) { errorFor(player.id, error.message); }
  }
  return <section className="card flagCompetitionPanel">
    <div className="flagPanelHeading"><Flag/><div><h3>FLAG COMPETITION</h3><p>Enter completed-hole scores below. On the final hole, count each stroke here and record the distance remaining for everybody.</p></div></div>
    {players.map(player => {
      const card = cardFor(player.id) || {};
      const progress = flagProgress(card, selectedIndexes, holes, playingHandicapFor(player.id));
      const planted = card.flagResult?.planted;
      const canFinish = progress.remaining === 0 && (progress.currentShots > 0 || progress.completedHoles > 0);
      return <div className={`flagPlayer ${planted ? 'flagPlanted' : ''}`} key={player.id}>
        <div className="flagPlayerStatus"><span><b>{player.name}</b><small>Allowance: par {progress.selectedPar} + PH {playingHandicapFor(player.id)} = {progress.budget} strokes</small></span><strong>{planted ? '⛳️ PLANTED' : `${Math.max(0, progress.remaining)} LEFT`}</strong></div>
        {planted ? <><div className="flagResultText">{formatFlagResult(card.flagResult)}</div><button className="mini secondary" onClick={() => update(player.id, { flagResult: null })}>CHANGE FLAG POSITION</button></> : <>
          {progress.invalid && <p className="autherror">N/R cannot be used in a Flag card. Correct the completed-hole score.</p>}
          {progress.remainingBeforeCurrent < 0 && <p className="autherror">The completed-hole scores exceed this golfer’s allowance. Remove the final completed score and plant the flag on that hole.</p>}
          {progress.remainingBeforeCurrent >= 0 && <div className="flagCurrentHole">
            <div><b>{progress.absoluteHole > selectedIndexes.length ? `CONTINUATION HOLE ${progress.absoluteHole}` : `FINAL HOLE ${progress.absoluteHole}`}</b><small>Course hole {((progress.absoluteHole - 1) % 18) + 1} · {progress.usedBeforeCurrent} strokes already used</small></div>
            <div className="flagShotCounter"><button type="button" onClick={() => update(player.id, { flagCurrentHoleStrokes: Math.max(0, progress.currentShots - 1) })}>−</button><strong>{progress.currentShots}</strong><button type="button" disabled={progress.remaining <= 0} onClick={() => update(player.id, { flagCurrentHoleStrokes: progress.currentShots + 1 })}>+</button></div>
          </div>}
          {progress.currentShots > 0 && progress.remaining > 0 && progress.absoluteHole > selectedIndexes.length && <button className="secondary flagHoledButton" onClick={() => update(player.id, { flagContinuationGross: [...progress.continuationGross, progress.currentShots], flagCurrentHoleStrokes: 0 })}>HOLED OUT — CONTINUE TO NEXT HOLE</button>}
          {progress.currentShots > 0 && progress.remaining > 0 && progress.absoluteHole <= selectedIndexes.length && <p className="muted">If the ball is holed before the allowance runs out, reset this counter and enter the completed-hole score on the scorecard below.</p>}
          {canFinish && <div className="flagFinishFields">
            <label>Ball finished<select value={card.flagLocation || ''} onChange={event => update(player.id, { flagLocation: event.target.value })}><option value="">Choose location…</option>{LOCATIONS.map(location => <option key={location}>{location}</option>)}</select></label>
            <label>Distance remaining<input inputMode="decimal" min="0" type="number" value={card.flagDistanceToPin ?? ''} onChange={event => update(player.id, { flagDistanceToPin: event.target.value })} placeholder="e.g. 65"/></label>
            <label>Measurement<select value={card.flagDistanceUnit || 'yards'} onChange={event => update(player.id, { flagDistanceUnit: event.target.value })}><option value="yards">Yards</option><option value="feet">Feet</option></select></label>
            <button className="primary" onClick={() => plant(player, card, progress)}><Flag/> PLANT FLAG</button>
          </div>}
          {errors[player.id] && <p className="autherror" role="alert">{errors[player.id]}</p>}
        </>}
      </div>;
    })}
  </section>;
}
