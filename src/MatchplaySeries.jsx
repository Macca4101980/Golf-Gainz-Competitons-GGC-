import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trophy } from "lucide-react";
import {
  entrantFixtureSummary,
  groupStageKnockoutPreview,
  groupStageStandings,
  fixtureStageLabel,
  qualifyGroupStage,
  recordConcession,
  recordFixtureResult,
  recordSuddenDeathHole,
  roundRobinStandings,
} from "./matchplayTournament.js";
import {
  buildMatchplayRecord,
  currentMatchplayRecord,
  editMatchplayRecord,
  fixtureCompetitionPreset,
  isLeaguePlayoffRecord,
  matchplayHandicapSettings,
  rebuildMatchplayRecord,
  standardLeagues,
} from "./matchplaySeriesModel.js";

const nowIso = () => new Date().toISOString();
const deadlineText = (fixture) =>
  fixture.expiresAt
    ? `Play by ${new Date(fixture.expiresAt).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })}`
    : "";

const entrantName = (series, id) =>
  series.entrants.find((item) => item.id === id)?.name || "To be decided";
const scoreText = (fixture) =>
  fixture.status === "void"
    ? fixture.voidReason === "deadline-expired"
      ? "Voided — deadline expired"
      : "Voided"
    : fixture.score?.method === "concession"
    ? "1 UP · conceded"
    : fixture.status === "sudden-death"
      ? "All square · sudden death"
      : fixture.score
        ? `${fixture.score.holesWonA}–${fixture.score.holesWonB}`
        : fixture.status === "bye"
          ? "Bye"
          : fixture.status === "forecasted"
            ? "Forecasted"
            : "";

const shouldPersistResolved = (record, resolved) =>
  resolved !== record &&
  !(
    record.matchplay?.qualificationStatus === "forecasted" &&
    resolved.matchplay?.qualificationStatus === "forecasted"
  );

function persistResolvedMatchplay(previous, resolvedRecords) {
  const replacements = new Map(resolvedRecords.map((record) => [record.id, record]));
  const voidFixtures = new Map(
    resolvedRecords.map((record) => [
      record.id,
      new Set(
        (record.matchplay?.fixtures || [])
          .filter((fixture) => fixture.status === "void")
          .map((fixture) => fixture.id),
      ),
    ]),
  );
  const changedAt = nowIso();
  return {
    ...previous,
    leagues: (previous.leagues || []).map(
      (record) => replacements.get(record.id) || record,
    ),
    comps: (previous.comps || []).map((comp) => {
      const ids = voidFixtures.get(comp.matchplaySeriesId);
      if (
        !ids?.has(comp.matchplayFixtureId) ||
        ["completed", "cancelled", "deleted"].includes(comp.status)
      )
        return comp;
      return { ...comp, status: "cancelled", statusChangedAt: changedAt };
    }),
  };
}

export function MatchplayCreate({ state, me, initialSocietyId, onCreate }) {
  const manageable = (state.societies || []).filter(
    (group) =>
      group.ownerId === me?.id || (group.admins || []).includes(me?.id),
  );
  const [groupId, setGroupId] = useState(
    initialSocietyId &&
      manageable.some((group) => group.id === initialSocietyId)
      ? initialSocietyId
      : manageable[0]?.id || "",
  );
  const [name, setName] = useState("");
  const [mode, setMode] = useState("knockout");
  const [entrantType, setEntrantType] = useState("individual");
  const [sourceLeagueId, setSourceLeagueId] = useState("");
  const [selected, setSelected] = useState([]);
  const [playoffSize, setPlayoffSize] = useState(4);
  const [groupCount, setGroupCount] = useState(2);
  const [qualifiers, setQualifiers] = useState(2);
  const [legs, setLegs] = useState(1);
  const [winPoints, setWinPoints] = useState(3);
  const [drawPoints, setDrawPoints] = useState(1);
  const [lossPoints, setLossPoints] = useState(0);
  const [roundTimeLimitDays, setRoundTimeLimitDays] = useState(21);
  const [handicapSource, setHandicapSource] = useState("competition-start");
  const [handicapAllowance, setHandicapAllowance] = useState(100);
  const group = manageable.find((item) => item.id === groupId),
    leagues = standardLeagues(state).filter(
      (item) => item.societyId === groupId,
    ),
    source = leagues.find((item) => item.id === sourceLeagueId);
  const players = (group?.members || [])
    .map((id) => state.players.find((player) => player.id === id))
    .filter(Boolean);
  const teamSource =
    source || leagues.find((item) => (item.teams || []).length);
  const choices =
    entrantType === "team"
      ? (teamSource?.teams || []).map((team) => ({
          ...team,
          id: team.id,
          name: team.name,
          memberIds: team.memberIds || [],
        }))
      : players.map((player) => ({
          id: player.id,
          name: player.name,
          memberIds: [player.id],
        }));
  const choiceKey = choices.map((item) => item.id).join("|");
  useEffect(() => {
    if (entrantType === "team" && !sourceLeagueId && teamSource)
      setSourceLeagueId(teamSource.id);
  }, [groupId, entrantType]);
  useEffect(() => {
    setSelected(choices.map((item) => item.id));
  }, [groupId, entrantType, sourceLeagueId, choiceKey]);
  const toggle = (id) =>
    setSelected((values) =>
      values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id],
    );
  function create() {
    try {
      const entrants = choices
        .filter((item) => selected.includes(item.id))
        .map((item, index) => ({ ...item, seed: index + 1 }));
      const validHandicapSource =
        mode === "playoff" || handicapSource !== "competition-end"
          ? handicapSource
          : "competition-start";
      const record = buildMatchplayRecord({
        name: name.trim() || "Matchplay",
        societyId: groupId,
        mode,
        entrants,
        entrantType,
        sourceLeague: source,
        playoffSize,
        groupCount,
        qualifiersPerGroup: qualifiers,
        legs,
        points: { winPoints, drawPoints, lossPoints },
        roundTimeLimitDays,
        handicapSettings: {
          source: validHandicapSource,
          allowance: Math.max(0, Math.min(100, Number(handicapAllowance))),
          adjustmentMode:
            validHandicapSource === "competition-end" ? "league-final" : "none",
          excludeLeagueAdjustments: validHandicapSource !== "competition-end",
        },
        createdBy: me?.id,
        state,
      });
      onCreate(record);
    } catch (error) {
      alert(error.message || "Could not create this matchplay competition.");
    }
  }
  return (
    <div className="matchplayCreate">
      <p className="muted">
        Create a knockout, football-style League, World Cup-style group stage,
        or attach a playoff to an existing League.
      </p>
      <label>
        Group
        <select
          value={groupId}
          onChange={(event) => {
            setGroupId(event.target.value);
            setSourceLeagueId("");
          }}
        >
          {manageable.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Winter League Playoffs"
        />
      </label>
      <label>
        Structure
        <select value={mode} onChange={(event) => {
          const nextMode = event.target.value;
          setMode(nextMode);
          if (nextMode !== "playoff" && handicapSource === "competition-end")
            setHandicapSource("competition-start");
        }}>
          <option value="knockout">Knockout</option>
          <option value="round-robin">League — round robin</option>
          <option value="group-stage">Group stage + knockout</option>
          <option value="playoff">Existing League playoff</option>
        </select>
      </label>
      {mode === "playoff" ? (
        <>
          <label>
            League
            <select
              value={sourceLeagueId}
              onChange={(event) => {
                const nextId = event.target.value;
                setSourceLeagueId(nextId);
                const nextLeague = leagues.find((item) => item.id === nextId);
                setHandicapAllowance((nextLeague?.teams || []).length ? 90 : 100);
              }}
            >
              <option value="">Choose League…</option>
              {leagues.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Qualifying field
            <select
              value={playoffSize}
              onChange={(event) => setPlayoffSize(+event.target.value)}
            >
              <option value="2">Top 2</option>
              <option value="4">Top 4</option>
              <option value="8">Top 8</option>
              <option value="16">Top 16</option>
            </select>
          </label>
          <p className="matchplayForecastNote">
            <b>Forecasted until the final results:</b> the live League positions
            will be shown but cannot be scored. They lock automatically after
            the last result is fully released.
          </p>
        </>
      ) : (
        <>
          <label>
            Entrants
            <select
              value={entrantType}
              onChange={(event) => {
                const nextType = event.target.value;
                setEntrantType(nextType);
                setHandicapAllowance(nextType === "team" ? 90 : 100);
              }}
            >
              <option value="individual">Individual golfers</option>
              <option value="team">Existing League teams / pairs</option>
            </select>
          </label>
          {entrantType === "team" && (
            <label>
              Team source
              <select
                value={sourceLeagueId}
                onChange={(event) => setSourceLeagueId(event.target.value)}
              >
                <option value="">Choose League…</option>
                {leagues
                  .filter((item) => (item.teams || []).length)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <fieldset className="matchplayEntrants">
            <legend>Choose entrants ({selected.length})</legend>
            <div className="matchplayEntrantActions">
              <button type="button" className="mini secondary" onClick={() => setSelected(choices.map((item) => item.id))}>SELECT ALL</button>
              <button type="button" className="mini secondary" onClick={() => setSelected([])}>CLEAR ALL</button>
            </div>
            {choices.map((item) => (
              <label key={item.id} className="check">
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={() => toggle(item.id)}
                />
                <span>{item.name}</span>
              </label>
            ))}
          </fieldset>
          {mode !== "knockout" && (
            <>
              <div className="matchplayPoints">
                <label>
                  Win points
                  <input
                    type="number"
                    value={winPoints}
                    onChange={(event) => setWinPoints(+event.target.value)}
                  />
                </label>
                <label>
                  Draw points
                  <input
                    type="number"
                    value={drawPoints}
                    onChange={(event) => setDrawPoints(+event.target.value)}
                  />
                </label>
                <label>
                  Loss points
                  <input
                    type="number"
                    value={lossPoints}
                    onChange={(event) => setLossPoints(+event.target.value)}
                  />
                </label>
              </div>
              <label>
                Fixtures
                <select
                  value={legs}
                  onChange={(event) => setLegs(+event.target.value)}
                >
                  <option value="1">Play once</option>
                  <option value="2">Home and away / twice</option>
                </select>
              </label>
            </>
          )}
          {mode === "group-stage" && (
            <div className="matchplayPoints">
              <label>
                Groups
                <input
                  type="number"
                  min="2"
                  max="16"
                  value={groupCount}
                  onChange={(event) => setGroupCount(+event.target.value)}
                />
              </label>
              <label>
                Qualify per group
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={qualifiers}
                  onChange={(event) => setQualifiers(+event.target.value)}
                />
              </label>
            </div>
          )}
        </>
      )}
      {["knockout", "playoff", "group-stage"].includes(mode) && (
        <label>
          Time limit per knockout stage (days)
          <input
            type="number"
            min="1"
            max="365"
            value={roundTimeLimitDays}
            onChange={(event) => setRoundTimeLimitDays(+event.target.value)}
          />
          <small>
            Each stage starts when its entrants are known. The default is 21 days.
          </small>
        </label>
      )}
      <label>
        Handicap basis
        <select value={handicapSource} onChange={(event) => setHandicapSource(event.target.value)}>
          <option value="competition-start">Start-of-competition handicap position</option>
          {mode === "playoff" && <option value="competition-end">End-of-competition handicap position</option>}
          <option value="current">Current GGC Handicap Index</option>
        </select>
      </label>
      <label>
        Match allowance %
        <input
          type="number"
          min="0"
          max="100"
          value={handicapAllowance}
          onChange={(event) => setHandicapAllowance(event.target.value)}
        />
      </label>
      <button className="primary" onClick={create}>
        <Plus /> CREATE MATCHPLAY
      </button>
    </div>
  );
}

function Fixture({
  fixture,
  series,
  record,
  state,
  me,
  isAdmin,
  onChange,
  competition,
  onScorecard,
}) {
  const a = entrantName(series, fixture.entrantAId),
    b = entrantName(series, fixture.entrantBId);
  const participant = series.entrants.find(
    (item) =>
      (item.id === fixture.entrantAId || item.id === fixture.entrantBId) &&
      (item.id === me?.id || (item.memberIds || []).includes(me?.id)),
  );
  const opponent = participant
    ? entrantName(
        series,
        participant.id === fixture.entrantAId
          ? fixture.entrantBId
          : fixture.entrantAId,
      )
    : "";
  const open = ["scheduled", "live", "sudden-death"].includes(fixture.status);
  function result() {
    const aw = Number(prompt(`${a} — holes won`, "0")),
      bw = Number(prompt(`${b} — holes won`, "0"));
    if (!Number.isFinite(aw) || !Number.isFinite(bw)) return;
    onChange(
      recordFixtureResult(series, fixture.id, {
        holesWonA: aw,
        holesWonB: bw,
        holesPlayed: Math.max(aw + bw, 1),
      }),
    );
  }
  function concede() {
    if (
      !participant ||
      !confirm(
        `Concede this match? ${opponent || "Your opponent"} will go through with a 1-up win. This cannot be undone without an administrator correcting the result.`,
      )
    )
      return;
    onChange(
      recordConcession(series, fixture.id, { concededById: participant.id }),
    );
  }
  function sudden() {
    const answer = prompt(`Sudden-death winner:\n1. ${a}\n2. ${b}`);
    const winnerId =
      answer === "1"
        ? fixture.entrantAId
        : answer === "2"
          ? fixture.entrantBId
          : null;
    if (winnerId)
      onChange(recordSuddenDeathHole(series, fixture.id, { winnerId }));
  }
  return (
    <div className={`matchFixture ${fixture.status}`}>
      <span className="matchRound">
        {fixtureStageLabel(series, fixture).toUpperCase()}
      </span>
      <div>
        <b>{a}</b>
        <em>v</em>
        <b>{b}</b>
      </div>
      <small>
        {scoreText(fixture) || fixture.status.replace("-", " ")}
        {competition ? ` · ${competition.status || "scorecard"} scorecard` : ""}
      </small>
      {open && fixture.expiresAt && <small>{deadlineText(fixture)}</small>}
      {open && (
        <div className="matchFixtureActions">
          {(isAdmin || participant) && fixture.status !== "sudden-death" && onScorecard && (
            <button
              className="mini primary"
              onClick={() =>
                onScorecard(
                  competition ||
                    fixtureCompetitionPreset(record, fixture, state),
                  !!competition,
                )
              }
            >
              {competition ? "ENTER / CONTINUE SCORECARD" : "CREATE SCORECARD"}
            </button>
          )}
          {isAdmin && fixture.status !== "sudden-death" && (
            <button className="mini secondary" onClick={result}>
              RECORD RESULT
            </button>
          )}
          {isAdmin && fixture.status === "sudden-death" && (
            <button className="mini primary" onClick={sudden}>
              SUDDEN-DEATH WINNER
            </button>
          )}
          {participant && fixture.status !== "sudden-death" && (
            <button className="mini danger" onClick={concede}>
              CONCEDE MATCH
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FixtureSummary({ fixture, series }) {
  return (
    <div className={`matchFixture ${fixture.status}`}>
      <span className="matchRound">{fixtureStageLabel(series, fixture).toUpperCase()}</span>
      <div><b>{entrantName(series, fixture.entrantAId)}</b><em>v</em><b>{entrantName(series, fixture.entrantBId)}</b></div>
      <small>{scoreText(fixture) || fixture.status.replace("-", " ")}</small>
      {["scheduled", "live", "sudden-death"].includes(fixture.status) && fixture.expiresAt && (
        <small>{deadlineText(fixture)}</small>
      )}
    </div>
  );
}

function GroupStageKnockoutPreview({ series }) {
  let preview;
  try {
    preview = groupStageKnockoutPreview(series);
  } catch {
    return null;
  }
  return (
    <section className="matchplayKnockoutPreview">
      <h4>KNOCKOUT STAGE</h4>
      <p className="matchplayForecastNote">
        Planned from the final group positions. Entrants lock when every group
        match is complete.
      </p>
      <div className="matchFixtures">
        {preview.fixtures.map((fixture) => (
          <FixtureSummary key={fixture.id} fixture={fixture} series={preview} />
        ))}
      </div>
    </section>
  );
}

const fixtureParticipant = (series, fixture, playerId) =>
  series.entrants.some((entrant) =>
    (entrant.id === fixture.entrantAId || entrant.id === fixture.entrantBId) &&
    (entrant.id === playerId || (entrant.memberIds || []).includes(playerId)),
  );

export function MatchplayFixtures({ records = [], state, setState, me, isAdmin = false, onScorecard }) {
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const resolvedRecords = records.map((record) =>
    currentMatchplayRecord(record, state, new Date(clock)),
  );
  useEffect(() => {
    const changed = resolvedRecords.filter((resolved) => {
      const original = records.find((record) => record.id === resolved.id);
      return original && shouldPersistResolved(original, resolved);
    });
    if (changed.length)
      setState((previous) => persistResolvedMatchplay(previous, changed));
  });
  const openFixtures = (record) => (record.matchplay?.fixtures || []).filter((fixture) =>
    ["scheduled", "live", "sudden-death"].includes(fixture.status) && fixture.entrantAId && fixture.entrantBId,
  );
  const updateSeries = (recordId, matchplay) => {
    setState((previous) => ({
      ...previous,
      leagues: (previous.leagues || []).map((item) => item.id === recordId ? { ...item, matchplay, updatedAt: nowIso() } : item),
    }));
  };
  const renderFixture = (record, fixture) => (
    <Fixture
      key={`${record.id}:${fixture.id}`}
      fixture={fixture}
      series={record.matchplay}
      record={record}
      state={state}
      me={me}
      isAdmin={isAdmin}
      onChange={(matchplay) => updateSeries(record.id, matchplay)}
      competition={(state.comps || []).find((comp) => comp.matchplaySeriesId === record.id && comp.matchplayFixtureId === fixture.id)}
      onScorecard={onScorecard}
    />
  );
  const mine = resolvedRecords.flatMap((record) => openFixtures(record).filter((fixture) => fixtureParticipant(record.matchplay, fixture, me?.id)).map((fixture) => ({ record, fixture })));
  const others = isAdmin ? resolvedRecords.flatMap((record) => openFixtures(record).filter((fixture) => !fixtureParticipant(record.matchplay, fixture, me?.id)).map((fixture) => ({ record, fixture }))) : [];
  if (!mine.length && !others.length) return null;
  return <div className="matchplayCompetitionFixtures">
    {mine.map(({ record, fixture }) => renderFixture(record, fixture))}
    {others.length > 0 && <details className="completedTwirl matchplayOtherMatches"><summary>OTHER MATCHES <span>{others.length}</span></summary>{others.map(({ record, fixture }) => renderFixture(record, fixture))}</details>}
  </div>;
}

export function MatchplayEdit({ record, state, onSave, onDelete }) {
  const settings = matchplayHandicapSettings(record, state),
    linked = isLeaguePlayoffRecord(record),
    hasScorecards = (state.comps || []).some(
      (comp) => comp.matchplaySeriesId === record.id,
    );
  const [name, setName] = useState(record.name || "Knockouts"),
    [size, setSize] = useState(record.matchplay?.qualificationSize || 4),
    [structure, setStructure] = useState(record.structure || record.matchplay?.type || "knockout"),
    [groupCount, setGroupCount] = useState(record.matchplay?.groups?.length || 2),
    [qualifiers, setQualifiers] = useState(record.matchplay?.qualifiersPerGroup || 1),
    [legs, setLegs] = useState(record.matchplay?.legs || 1),
    [winPoints, setWinPoints] = useState(record.matchplay?.rules?.winPoints ?? 3),
    [drawPoints, setDrawPoints] = useState(record.matchplay?.rules?.drawPoints ?? 1),
    [lossPoints, setLossPoints] = useState(record.matchplay?.rules?.lossPoints ?? 0),
    [roundTimeLimitDays, setRoundTimeLimitDays] = useState(
      record.matchplay?.rules?.roundTimeLimitDays ?? 21,
    ),
    [source, setSource] = useState(settings.source),
    [allowance, setAllowance] = useState(settings.allowance);
  const structuralLocked =
    record.matchplay?.qualificationStatus !== "forecasted";
  const resettingFixtures = !linked && structure !== record.structure;
  function save() {
    try {
      const structureChanged = !linked && structure !== record.structure;
      if (structureChanged && !confirm(
        "Change this matchplay structure? All existing generated matches, scorecards and results for this matchplay competition will be deleted, then a new fixture list will be created. This cannot be undone.",
      )) return;
      const updated = structureChanged
        ? rebuildMatchplayRecord(record, state, {
            name,
            structure,
            groupCount,
            qualifiersPerGroup: qualifiers,
            legs,
            points: { winPoints, drawPoints, lossPoints },
            roundTimeLimitDays,
            handicapSource: source,
            handicapAllowance: allowance,
          })
        : editMatchplayRecord(record, state, {
          name,
          playoffSize: size,
          handicapSource: source,
          handicapAllowance: allowance,
          handicapAdjustmentMode: source === "competition-end" ? "league-final" : "none",
          roundTimeLimitDays,
        });
      onSave(updated, { resetFixtures: structureChanged });
    } catch (error) {
      alert(error.message || "Could not update these knockout settings.");
    }
  }
  return (
    <div className="matchplayCreate matchplayEdit">
      <p className="muted">
        Manage the linked knockout and confirm exactly which handicaps its
        scorecards will use.
      </p>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      {!linked && <label>
        Structure
        <select value={structure} onChange={(event) => setStructure(event.target.value)}>
          <option value="knockout">Knockout</option>
          <option value="round-robin">League — round robin</option>
          <option value="group-stage">Group stage + knockout</option>
        </select>
      </label>}
      {!linked && structure !== "knockout" && <>
        <div className="matchplayPoints">
          <label>Win points<input type="number" value={winPoints} onChange={(event) => setWinPoints(+event.target.value)} /></label>
          <label>Draw points<input type="number" value={drawPoints} onChange={(event) => setDrawPoints(+event.target.value)} /></label>
          <label>Loss points<input type="number" value={lossPoints} onChange={(event) => setLossPoints(+event.target.value)} /></label>
        </div>
        <label>Fixtures<select value={legs} onChange={(event) => setLegs(+event.target.value)}><option value="1">Play once</option><option value="2">Play twice</option></select></label>
      </>}
      {!linked && structure === "group-stage" && <div className="matchplayPoints">
        <label>Groups<input type="number" min="2" max="16" value={groupCount} onChange={(event) => setGroupCount(+event.target.value)} /></label>
        <label>Qualify per group<input type="number" min="1" max="4" value={qualifiers} onChange={(event) => setQualifiers(+event.target.value)} /></label>
      </div>}
      {linked && (
        <label>
          Qualifying field
          <select
            value={size}
            disabled={structuralLocked}
            onChange={(event) => setSize(+event.target.value)}
          >
            <option value="2">Top 2</option>
            <option value="4">Top 4</option>
            <option value="8">Top 8</option>
            <option value="16">Top 16</option>
          </select>
        </label>
      )}
      {(linked || ["knockout", "group-stage", "group-stage-knockout"].includes(structure)) && (
        <label>
          Time limit per knockout stage (days)
          <input
            type="number"
            min="1"
            max="365"
            value={roundTimeLimitDays}
            onChange={(event) => setRoundTimeLimitDays(+event.target.value)}
          />
          <small>
            A fresh deadline starts when each knockout stage becomes playable.
          </small>
        </label>
      )}
      <label>
        Handicap basis
        <select
          value={source}
          disabled={hasScorecards && !resettingFixtures}
          onChange={(event) => setSource(event.target.value)}
        >
          <option value="competition-start">Start-of-competition handicap position</option>
          {linked && <option value="competition-end">End-of-competition handicap position</option>}
          <option value="current">Current GGC Handicap Index</option>
        </select>
      </label>
      <label>
        Match allowance %
        <input
          type="number"
          min="0"
          max="100"
          value={allowance}
          disabled={hasScorecards && !resettingFixtures}
          onChange={(event) => setAllowance(event.target.value)}
        />
      </label>
      {source === "competition-start" ? (
        <p className="matchplayForecastNote">
          Uses the handicap position saved when this competition began. The {allowance}% match allowance is then applied.
        </p>
      ) : source === "competition-end" ? (
        <p className="matchplayForecastNote">
          Uses the handicap position at the end of the linked competition, including its final adjustments, before the {allowance}% match allowance is applied.
        </p>
      ) : (
        <p className="matchplayForecastNote">
          The golfer's current profile Handicap Index will be read when the
          knockout scorecard is created.
        </p>
      )}
      {hasScorecards && !resettingFixtures && (
        <p className="muted">
          Handicap rules are locked because a knockout scorecard has already
          been created. This protects existing match results.
        </p>
      )}
      {hasScorecards && resettingFixtures && (
        <p className="matchplayForecastNote">
          Saving the new structure will remove the old generated scorecards and results before rebuilding the fixture list.
        </p>
      )}
      {structuralLocked && linked && (
        <p className="muted">
          The qualifying field is locked because the League positions have been
          finalised.
        </p>
      )}
      {record.matchplay?.type === "group-stage" && record.matchplay.fixtures?.length > 0 && record.matchplay.fixtures.every((fixture) => fixture.status === "complete") && (
        <button className="secondary" onClick={() => {
          if (!confirm("Lock these group tables and create the knockout stage?")) return;
          const knockout = qualifyGroupStage(record.matchplay, { id: `${record.matchplay.id}-knockout`, name: `${record.name} Knockout` });
          onSave({ ...record, matchplay: knockout, completedGroupStage: record.matchplay, structure: "group-stage-knockout", updatedAt: nowIso() });
        }}><Trophy /> LOCK GROUPS &amp; CREATE KNOCKOUT</button>
      )}
      <button className="primary" onClick={save}>
        SAVE MATCHPLAY SETTINGS
      </button>
      {onDelete && <button className="danger" onClick={onDelete}>
        DELETE MATCHPLAY &amp; ALL MATCHES
      </button>}
    </div>
  );
}

export function MatchplayResults({
  record,
  state,
  me,
  setState,
}) {
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const resolved = useMemo(
      () => currentMatchplayRecord(record, state, new Date(clock)),
      [record, state, clock],
    ),
    series = resolved.matchplay,
    group = state.societies.find((item) => item.id === record.societyId);
  useEffect(() => {
    if (!shouldPersistResolved(record, resolved)) return;
    setState((previous) => persistResolvedMatchplay(previous, [resolved]));
  }, [resolved, record, setState]);
  const table =
      series.type === "round-robin" ? roundRobinStandings(series) : null,
    groups = series.type === "group-stage" ? groupStageStandings(series) : null,
    completedGroups = record.completedGroupStage
      ? groupStageStandings(record.completedGroupStage)
      : null;
  const myEntrant = series.entrants.find(
      (item) => item.id === me?.id || (item.memberIds || []).includes(me?.id),
    ),
    mySummary =
      myEntrant && series.type === "round-robin"
        ? entrantFixtureSummary(series, myEntrant.id)
        : null;
  const handicaps = matchplayHandicapSettings(record, state);
  return (
    <div className="matchplayResult">
      <div className="matchplayHeader">
        <Trophy />
        <span>
          <b>{record.name}</b>
          <small>
            {series.qualificationStatus === "forecasted"
              ? "FORECASTED — LIVE LEAGUE TOP " + series.qualificationSize
              : series.qualificationStatus === "qualified"
                ? "QUALIFIED"
                : record.structure.replaceAll("-", " ").toUpperCase()}
          </small>
        </span>
        {series.championId && (
          <mark>WINNER · {entrantName(series, series.championId)}</mark>
        )}
      </div>
      <p className="matchplayHandicapSummary">
        <b>HANDICAPS:</b>{" "}
        {handicaps.source === "competition-start"
          ? "Start-of-competition handicap position"
          : handicaps.source === "competition-end"
            ? "End-of-competition handicap position"
            : "Current GGC Handicap Index"}{" "}
        · {handicaps.allowance}% allowance
      </p>
      {series.qualificationStatus === "forecasted" && (
        <p className="matchplayForecastNote">
          These places are <b>Forecasted</b> from the current League table. They
          may change and cannot be scored until the final week results are fully
          released.
        </p>
      )}
      {mySummary && (
        <p className="matchplayMyFixtures">
          <b>Your fixtures:</b> {mySummary.played} played ·{" "}
          {mySummary.remaining} remaining
          {mySummary.remainingOpponentIds.length
            ? ` · Left to play: ${mySummary.remainingOpponentIds.map((id) => entrantName(series, id)).join(", ")}`
            : ""}
        </p>
      )}
      {completedGroups && (
        <details className="matchplayCompletedGroups">
          <summary>COMPLETED GROUP TABLES</summary>
          {completedGroups.map((item) => (
            <div key={item.groupId}>
              <h4>{item.name}</h4>
              <Table rows={item.standings} />
            </div>
          ))}
        </details>
      )}
      {table && <Table rows={table} />}{" "}
      {groups?.map((item) => (
        <div key={item.groupId}>
          <h4>{item.name}</h4>
          <Table rows={item.standings} />
        </div>
      ))}
      {series.type === "group-stage" && (
        <GroupStageKnockoutPreview series={series} />
      )}
      <div className="matchFixtures">
        {series.fixtures
          .filter((fixture) => !["scheduled", "live", "forecasted"].includes(fixture.status) || ["knockout", "playoff"].includes(record.structure))
          .map((fixture) => <FixtureSummary key={fixture.id} fixture={fixture} series={series} />)}
      </div>
    </div>
  );
}

function Table({ rows }) {
  return (
    <div className="matchTable">
      <div className="matchTableHead">
        <span>#</span>
        <span>PLAYER / TEAM</span>
        <span>P</span>
        <span>W</span>
        <span>D</span>
        <span>L</span>
        <span>HD</span>
        <span>PTS</span>
      </div>
      {rows.map((row) => (
        <div key={row.entrantId}>
          <span>{row.position}</span>
          <b>{row.name}</b>
          <span>{row.played}</span>
          <span>{row.won}</span>
          <span>{row.drawn}</span>
          <span>{row.lost}</span>
          <span>
            {row.holeDifference > 0 ? "+" : ""}
            {row.holeDifference}
          </span>
          <strong>{row.points}</strong>
        </div>
      ))}
    </div>
  );
}
