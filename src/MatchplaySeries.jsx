import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trophy } from "lucide-react";
import {
  entrantFixtureSummary,
  groupStageStandings,
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
  matchplayHandicapSettings,
  standardLeagues,
} from "./matchplaySeriesModel.js";

const nowIso = () => new Date().toISOString();

const entrantName = (series, id) =>
  series.entrants.find((item) => item.id === id)?.name || "To be decided";
const scoreText = (fixture) =>
  fixture.score?.method === "concession"
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
  useEffect(() => {
    setSelected([]);
    if (entrantType === "team" && !sourceLeagueId && teamSource)
      setSourceLeagueId(teamSource.id);
  }, [groupId, entrantType]);
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
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
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
              onChange={(event) => setSourceLeagueId(event.target.value)}
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
              onChange={(event) => setEntrantType(event.target.value)}
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
        {fixture.stage === "group" ? "GROUP" : `ROUND ${fixture.round}`}
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
      {open && (
        <div className="matchFixtureActions">
          {isAdmin && fixture.status !== "sudden-death" && onScorecard && (
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
              {competition ? "MANAGE SCORECARD" : "CREATE SCORECARD"}
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

export function MatchplayEdit({ record, state, onSave }) {
  const settings = matchplayHandicapSettings(record, state),
    linked = !!record.sourceLeagueId,
    hasScorecards = (state.comps || []).some(
      (comp) => comp.matchplaySeriesId === record.id,
    );
  const [name, setName] = useState(record.name || "Knockouts"),
    [size, setSize] = useState(record.matchplay?.qualificationSize || 4),
    [source, setSource] = useState(settings.source),
    [allowance, setAllowance] = useState(settings.allowance);
  const structuralLocked =
    record.matchplay?.qualificationStatus !== "forecasted";
  function save() {
    try {
      onSave(
        editMatchplayRecord(record, state, {
          name,
          playoffSize: size,
          handicapSource: source,
          handicapAllowance: allowance,
        }),
      );
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
      <label>
        Handicap basis
        <select
          value={source}
          disabled={hasScorecards}
          onChange={(event) => setSource(event.target.value)}
        >
          {linked && (
            <option value="league-start">
              Original League-start Handicap Index
            </option>
          )}
          <option value="current">
            Current Handicap Index when the match starts
          </option>
        </select>
      </label>
      <label>
        Match allowance %
        <input
          type="number"
          min="0"
          max="100"
          value={allowance}
          disabled={hasScorecards}
          onChange={(event) => setAllowance(event.target.value)}
        />
      </label>
      {source === "league-start" ? (
        <p className="matchplayForecastNote">
          <b>Winter League playoff rule:</b> every golfer returns to the
          Handicap Index saved when the League began. Winter League performance
          cuts are not carried into the knockouts. The {allowance}% match
          allowance is then applied.
        </p>
      ) : (
        <p className="matchplayForecastNote">
          The golfer's current profile Handicap Index will be read when the
          knockout scorecard is created.
        </p>
      )}
      {hasScorecards && (
        <p className="muted">
          Handicap rules are locked because a knockout scorecard has already
          been created. This protects existing match results.
        </p>
      )}
      {structuralLocked && linked && (
        <p className="muted">
          The qualifying field is locked because the League positions have been
          finalised.
        </p>
      )}
      <button className="primary" onClick={save}>
        SAVE KNOCKOUT SETTINGS
      </button>
    </div>
  );
}

export function MatchplayResults({
  record,
  state,
  me,
  setState,
  onScorecard,
  onManage,
}) {
  const resolved = useMemo(
      () => currentMatchplayRecord(record, state),
      [record, state],
    ),
    series = resolved.matchplay,
    group = state.societies.find((item) => item.id === record.societyId),
    isAdmin =
      group?.ownerId === me?.id || (group?.admins || []).includes(me?.id);
  useEffect(() => {
    if (
      series.qualificationStatus !== "qualified" ||
      record.matchplay.qualificationStatus === "qualified"
    )
      return;
    setState((previous) => ({
      ...previous,
      leagues: (previous.leagues || []).map((item) =>
        item.id === record.id ? resolved : item,
      ),
    }));
  }, [series.qualificationStatus, record.id]);
  const updateRecord = (changes) =>
    setState((previous) => ({
      ...previous,
      leagues: (previous.leagues || []).map((item) =>
        item.id === record.id
          ? { ...item, ...changes, updatedAt: nowIso() }
          : item,
      ),
    }));
  const update = (matchplay) => updateRecord({ matchplay });
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
  const groupsComplete =
    series.type === "group-stage" &&
    series.fixtures.length > 0 &&
    series.fixtures.every((fixture) => fixture.status === "complete");
  function advanceGroups() {
    if (
      !groupsComplete ||
      !confirm("Lock these group tables and create the knockout stage?")
    )
      return;
    const knockout = qualifyGroupStage(series, {
      id: `${series.id}-knockout`,
      name: `${record.name} Knockout`,
    });
    updateRecord({
      matchplay: knockout,
      completedGroupStage: series,
      structure: "group-stage-knockout",
    });
  }
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
      {isAdmin && onManage && (
        <button
          className="secondary matchplayManage"
          onClick={() => onManage(record)}
        >
          MANAGE KNOCKOUTS
        </button>
      )}
      <p className="matchplayHandicapSummary">
        <b>HANDICAPS:</b>{" "}
        {handicaps.source === "league-start"
          ? "Original League-start handicaps · no Winter League cuts"
          : "Current handicaps at match start"}{" "}
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
      {groupsComplete && isAdmin && (
        <button className="primary matchplayAdvance" onClick={advanceGroups}>
          <Trophy /> LOCK GROUPS &amp; CREATE KNOCKOUT
        </button>
      )}
      <div className="matchFixtures">
        {series.fixtures.map((fixture) => (
          <Fixture
            key={fixture.id}
            fixture={fixture}
            series={series}
            record={resolved}
              state={state}
            me={me}
            isAdmin={isAdmin}
            onChange={update}
            competition={(state.comps || []).find(
              (comp) =>
                comp.matchplaySeriesId === record.id &&
                comp.matchplayFixtureId === fixture.id,
            )}
            onScorecard={onScorecard}
          />
        ))}
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
