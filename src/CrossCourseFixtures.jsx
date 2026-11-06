import React, {useEffect, useState} from 'react';
import {lockCrossCourseSetup} from './crossCourseSetup.js';
import {crossCourseMatchResult} from './crossCourseMatch.js';

const emptySlots = () => ['A', 'A', 'B', 'B'].map(side => ({
  side, playerId: '', courseId: '', teeName: '', holesMode: 'full18'
}));

export default function CrossCourseFixtures({client, state, groups}) {
  const [list, setList] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [slots, setSlots] = useState(emptySlots);
  const [name, setName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [response, setResponse] = useState(null);
  const [fixtureId, setFixtureId] = useState('');
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const group = groups.find(item => item.id === groupId);
  const players = state.players.filter(player => player.authUserId &&
    (group?.ownerId === player.id || group?.members?.includes(player.id) || group?.admins?.includes(player.id)));

  async function rpc(method, args) {
    const {data, error} = await client.rpc(method, args);
    if (error) throw error;
    return data;
  }

  async function refreshList() {
    setList(await rpc('ggc_cross_course_fixtures', {}));
  }

  useEffect(() => {
    let active = true;
    client.rpc('ggc_cross_course_fixtures', {}).then(({data, error}) => {
      if (!active) return;
      if (error) setError(error.message);
      else setList(data);
    });
    return () => {active = false;};
  }, [client]);

  async function run(action) {
    setBusy(true);
    setError('');
    try { await action(); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  function open(id) {
    return run(async () => {
      const next = await rpc('ggc_cross_course_card', {p_fixture_id: id});
      if (id !== fixtureId) setDrafts({});
      setFixtureId(id);
      setResponse(next);
    });
  }

  function updateSlot(index, patch) {
    setSlots(current => current.map((slot, i) => i === index ? {...slot, ...patch} : slot));
  }

  function create(event) {
    event.preventDefault();
    return run(async () => {
      if (!name.trim()) throw new Error('Enter a fixture name.');
      const fixture = lockCrossCourseSetup({slots, players, courses: state.courses});
      await rpc('ggc_cross_course_fixtures', {
        p_group_id: groupId, p_fixture: {...fixture, name: name.trim(), cards: fixture.cards.map(card => ({
          ...card, name: players.find(player => player.id === card.id).name
        }))}, p_closes_at: new Date(deadline).toISOString()
      });
      setName('');
      setSlots(emptySlots());
      await refreshList();
    });
  }

  const fixture = response?.fixture;
  const ownCard = fixture?.cards.find(card => card.id === response.golferId);
  const locked = new Map(fixture?.cards.map(card => [card.id, []]));
  for (const row of response?.locks || []) locked.get(row.golferId)[row.holeOrder - 1] = row.gross;
  const result = fixture && crossCourseMatchResult(fixture, locked);
  const status = result?.result
    ? result.result.winner ? `Pair ${result.result.winner} won ${Math.abs(result.result.up)}${result.result.left ? ' & ' + result.result.left : ' UP'}` : 'Match halved'
    : result?.up ? `Pair ${result.up > 0 ? 'A' : 'B'} ${Math.abs(result.up)} UP` : 'All square';

  return <>
    {error && <p role="alert">{error}</p>}
    <h3>Your fixtures</h3>
    {list.map(item => <button key={item.id} disabled={busy} onClick={() => open(item.id)}>{item.name}</button>)}
    {ownCard && <section>
      <h3>{fixture.name}</h3>
      <p>{status} · Through {result.holes.length}</p>
      <p>{ownCard.courseSnapshot.name} · {ownCard.courseSnapshot.tee.name} · {ownCard.playingHandicap} shots</p>
      <button disabled={busy} onClick={() => open(fixtureId)}>Refresh scores</button>
      {ownCard.holes.map((hole, index) => {
        const own = locked.get(ownCard.id)[index];
        const revealed = result.holes[index];
        return <div className="card" key={hole.number}>
          <b>Hole {hole.number} · Par {hole.par} · {hole.shots} shots</b>
          {own === undefined ? <>
            <label>Gross score (0 for N/R)<input type="number" min="0" max="999" step="1" value={drafts[index] ?? ''}
              onChange={event => setDrafts({...drafts, [index]: event.target.value})}/></label>
            <button disabled={busy || !drafts[index] || Date.now() >= Date.parse(response.closesAt)} onClick={() =>
              run(async () => setResponse(await rpc('ggc_cross_course_card', {
                p_fixture_id: fixtureId, p_hole_order: index + 1, p_gross: Number(drafts[index])
              })))}>Lock Hole</button>
          </> : <p>Locked · {own || 'N/R'}</p>}
          <p>{response.lockCounts[index]} of 4 locked{revealed ? ' · ' + (revealed.winner ? 'Pair ' + revealed.winner + ' won' : 'Halved') : ''}</p>
          {revealed?.scores.map(score => <p key={score.id}>{fixture.cards.find(card => card.id === score.id).name}
            {' · Hole '}{score.number}{' · '}{score.gross || 'N/R'}{score.netToPar === null ? '' : ` · Net ${score.netToPar > 0 ? '+' : ''}${score.netToPar}`}</p>)}
        </div>;
      })}
      {response.submitted ? <p>Round submitted</p> :
        <button disabled={busy || locked.get(ownCard.id).filter(Number.isInteger).length !== fixture.length}
          onClick={() => run(async () => setResponse(await rpc('ggc_cross_course_card', {
            p_fixture_id: fixtureId, p_hole_order: 0
          })))}>Submit Round</button>}
    </section>}
    {groups.length > 0 && <form onSubmit={create}>
      <h3>Create cross-course Pairs Matchplay</h3>
      <label>Fixture name<input required value={name} onChange={event => setName(event.target.value)}/></label>
      <label>Group<select required value={groupId} onChange={event => {setGroupId(event.target.value);setSlots(emptySlots());}}>
        <option value="">Choose group</option>
        {groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>Entry deadline<input required type="datetime-local" value={deadline} onChange={event => setDeadline(event.target.value)}/></label>
      {slots.map((slot, index) => <fieldset key={index}>
        <legend>Pair {slot.side} · Golfer {index % 2 + 1}</legend>
        <label>Golfer<select required value={slot.playerId} onChange={event => updateSlot(index, {playerId:event.target.value})}>
          <option value="">Choose golfer</option>
          {players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
        </select></label>
        <label>Course<select required value={slot.courseId} onChange={event => updateSlot(index, {courseId:event.target.value,teeName:''})}>
          <option value="">Choose course</option>
          {state.courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
        </select></label>
        <label>Tees<select required value={slot.teeName} onChange={event => updateSlot(index, {teeName:event.target.value})}>
          <option value="">Choose tees</option>
          {state.courses.find(course => course.id === slot.courseId)?.tees.map(tee => <option key={tee.name}>{tee.name}</option>)}
        </select></label>
        <label>Holes<select value={slot.holesMode} onChange={event => updateSlot(index, {holesMode:event.target.value})}>
          <option value="full18">18 holes</option><option value="front9">Front 9</option><option value="back9">Back 9</option>
        </select></label>
      </fieldset>)}
      <button type="submit" disabled={busy}>Create and lock fixture</button>
    </form>}
  </>;
}
