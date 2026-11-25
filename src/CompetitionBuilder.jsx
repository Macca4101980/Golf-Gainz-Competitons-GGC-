import React, { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Download, Info, Shuffle, Star, X } from "lucide-react";
import {
  BUILDER_AUDIENCES,
  BUILDER_STRUCTURES,
  BUILDER_STYLES,
  COMPETITION_TEMPLATES,
  automaticAssignments,
  builderRulesText,
  recommendTemplates,
  validateBuilderSetup,
} from "./competitionBuilder.js";

const labels = (items, id) => items.find((item) => item.id === id)?.label || "Not chosen";

function ChoiceList({ title, help, items, value, onChange }) {
  return (
    <section className="builderQuestion">
      <h2>{title}</h2>
      <p className="muted">{help}</p>
      <div className="builderChoices">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`builderChoice${value === item.id ? " selected" : ""}`}
            onClick={() => onChange(item.id)}
          >
            <span><b>{item.label}</b><small>{item.detail}</small></span>
            {value === item.id ? <Check /> : <ChevronRight />}
          </button>
        ))}
      </div>
    </section>
  );
}

function RulesDialog({ template, onClose }) {
  if (!template) return null;
  const text = builderRulesText(template);
  const printRules = () => {
    const win = window.open("", "_blank");
    if (!win) return alert("Allow pop-ups to open the printable rules.");
    win.opener = null;
    const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    win.document.write(`<!doctype html><html><head><title>${escape(template.name)} rules</title><style>body{font:16px system-ui;max-width:760px;margin:48px auto;padding:0 24px;color:#142319}h1{font-size:30px}li{margin:10px 0}.note{padding:16px;background:#eef5ef;border-radius:12px}@media print{button{display:none}}</style></head><body><h1>${escape(template.name)}</h1><p>${escape(template.summary)}</p><p>${escape(template.overview)}</p><h2>Default rules</h2><ul>${template.rules.map((rule) => `<li>${escape(rule)}</li>`).join("")}</ul><div class="note"><b>GGC automation</b><p>Handicaps, team allocations and fixtures are calculated from the final setup. The selected course and tee are saved with the competition.</p></div><button onclick="window.print()">PRINT / SAVE AS PDF</button></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };
  const downloadText = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${template.id}-rules.txt`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="builderInfoBackdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="builderInfo" role="dialog" aria-modal="true" aria-label={`${template.name} information`}>
        <button className="builderInfoClose" aria-label="Close" onClick={onClose}><X /></button>
        <p className="builderEyebrow">COMPETITION OVERVIEW</p>
        <h2>{template.name}</h2>
        <p>{template.summary}</p>
        <p className="muted">{template.overview}</p>
        <h3>DEFAULT RULES</h3>
        <ul>{template.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
        <div className="builderInfoActions">
          <button className="secondary" onClick={downloadText}><Download /> DOWNLOAD RULES</button>
          <button className="primary" onClick={printRules}><Download /> PRINT / SAVE PDF</button>
        </div>
      </section>
    </div>
  );
}

export default function CompetitionBuilder({
  state,
  society,
  me,
  personalFavourites = [],
  groupFavourites = [],
  onToggleFavourite,
  onUseTemplate,
  courseManager,
  onClose,
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ audience: "", style: "", structure: "" });
  const [selectedId, setSelectedId] = useState("");
  const [infoId, setInfoId] = useState("");
  const [name, setName] = useState("");
  const [entrantIds, setEntrantIds] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [teeName, setTeeName] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [showCourses, setShowCourses] = useState(false);
  const allFavourites = [...new Set([...personalFavourites, ...groupFavourites])];
  const recommendations = useMemo(() => recommendTemplates(answers, allFavourites), [answers, allFavourites.join("|")]);
  const compatible = { audience: answers.audience };
  const styles = BUILDER_STYLES.filter((item) => recommendTemplates({ ...compatible, style: item.id }).length);
  const structures = BUILDER_STRUCTURES.filter((item) => recommendTemplates({ ...compatible, style: answers.style, structure: item.id }).length);
  const template = COMPETITION_TEMPLATES.find((item) => item.id === selectedId) || null;
  const groupPlayers = (society?.members || []).map((id) => state.players.find((player) => player.id === id)).filter(Boolean);
  const selectedCourse = (state.courses || []).find((course) => course.id === courseId);
  const [groupSize, setGroupSize] = useState(4);
  const teamSize = answers.audience === "groups" ? groupSize : 2;
  const [sideA, sideB] = ["A", "B"].map((side) => assignments.filter((item) => item.side === side).length);
  const entrantCount = answers.audience === "individual" ? entrantIds.length : assignments.length;
  const structureLabel = labels(BUILDER_STRUCTURES, answers.structure);

  function allocate(ids, chosen = template, size = teamSize) {
    if (chosen?.entrantRule?.sides) return automaticAssignments(ids, { sides: 2 });
    if (answers.audience === "individual") return [];
    return automaticAssignments(ids, { size });
  }
  const validation = validateBuilderSetup({
    template,
    entrantIds,
    courseId,
    teeName,
    state,
    teamAssignments: answers.audience === "individual" ? [] : assignments,
  });
  const blocked = validation.some((issue) => issue.level === "red");
  const stage = [1, 1, 1, 2, 3, 3, 4][step];

  function chooseTemplate(id) {
    const chosen = COMPETITION_TEMPLATES.find((item) => item.id === id);
    setSelectedId(id);
    setName(chosen?.name || "");
    const ids = groupPlayers.map((player) => player.id);
    setEntrantIds(ids);
    setAssignments(allocate(ids, chosen));
    setStep(4);
  }

  function updateEntrants(ids) {
    setEntrantIds(ids);
    setAssignments(allocate(ids));
  }

  function toggleEntrant(id) {
    updateEntrants(entrantIds.includes(id) ? entrantIds.filter((value) => value !== id) : [...entrantIds, id]);
  }

  const summaryAnswers = [
    labels(BUILDER_AUDIENCES, answers.audience),
    labels(BUILDER_STRUCTURES, answers.structure),
    labels(BUILDER_STYLES, answers.style),
  ];

  return (
    <div className="competitionBuilder">
      <div className="builderHeader">
        <button className="builderBack" aria-label="Back" onClick={() => step ? setStep(step - 1) : onClose()}><ArrowLeft /></button>
        <div><small>COMPETITION BUILDER</small><b>{step < 4 ? "Let GGC build your competition" : template?.name || "Build your competition"}</b></div>
        <span>Step {stage} of 5</span>
      </div>
      <div className="builderProgress"><i style={{ width: `${stage * 20}%` }} /></div>

      {step === 0 && <ChoiceList title="Who is taking part?" help="Choose the size of the competitive unit. You can select the actual golfers later." items={BUILDER_AUDIENCES} value={answers.audience} onChange={(audience) => { setAnswers({ audience, style: "", structure: "" }); setStep(1); }} />}
      {step === 1 && <ChoiceList title="How will golfers compete?" help="Choose how scores or matches are compared." items={styles} value={answers.style} onChange={(style) => { setAnswers({ ...answers, style, structure: "" }); setStep(2); }} />}
      {step === 2 && <ChoiceList title="How should the event be organised?" help="Choose the structure that fits your competition." items={structures} value={answers.structure} onChange={(structure) => { setAnswers({ ...answers, structure }); setStep(3); }} />}

      {step === 3 && (
        <section className="builderTemplates">
          <h2>Choose your competition</h2>
          <div className="builderAnswerChips">{summaryAnswers.map((answer) => <span key={answer}>{answer}</span>)}</div>
          <p className="muted">{recommendations.length} suitable competition template{recommendations.length === 1 ? "" : "s"}. Press ⓘ for an overview and full rules.</p>
          <div className="builderTemplateList">
            {recommendations.map((item) => {
              const favourite = allFavourites.includes(item.id);
              return <article className="builderTemplate" key={item.id}>
                <button className="builderTemplateMain" onClick={() => chooseTemplate(item.id)}>
                  <span><b>{item.name}</b><small>{item.summary}</small></span><ChevronRight />
                </button>
                <button className="builderTemplateIcon" aria-label={`Information about ${item.name}`} onClick={() => setInfoId(item.id)}><Info /></button>
                <button className={`builderTemplateIcon${favourite ? " active" : ""}`} aria-label={`${favourite ? "Remove" : "Add"} ${item.name} favourite`} onClick={() => onToggleFavourite?.(item.id, "personal")}><Star fill={favourite ? "currentColor" : "none"} /></button>
              </article>;
            })}
          </div>
          <button className="textbtn" onClick={() => { setAnswers({ audience: "", style: "", structure: "" }); setStep(0); }}>START AGAIN</button>
        </section>
      )}

      {step === 4 && template && (
        <section className="builderPersonalise">
          <p className="builderEyebrow">PERSONALISE</p><h2>Players and teams</h2>
          <label>Competition name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          {answers.audience === "groups" && <label>Golfers per team
            <select value={groupSize} onChange={(event) => {
              const size = Number(event.target.value);
              setGroupSize(size);
              setAssignments(allocate(entrantIds, template, size));
            }}><option value={3}>3</option><option value={4}>4</option></select>
          </label>}
          <div className="builderSelectAll"><b>ENTRANTS</b><button className="textbtn" onClick={() => updateEntrants(groupPlayers.map((player) => player.id))}>SELECT ALL</button></div>
          <div className="builderEntrants">{groupPlayers.map((player) => <label key={player.id}><input type="checkbox" checked={entrantIds.includes(player.id)} onChange={() => toggleEntrant(player.id)} /><span><b>{player.name}</b><small>HI {Number(player.hi || 0).toFixed(1)}</small></span></label>)}</div>
          {(answers.audience !== "individual" || template.entrantRule?.sides) && <><button className="secondary builderRandomise" onClick={() => setAssignments(allocate(entrantIds))}><Shuffle /> RANDOMISE {template.entrantRule?.sides ? "SIDES" : "TEAMS"}</button><div className="builderAssignments">{template.entrantRule?.sides ? ["A", "B"].map((side) => <div key={side}><b>SIDE {side}</b><span>{assignments.filter((item) => item.side === side).map((item) => state.players.find((player) => player.id === item.playerId)?.name).filter(Boolean).join(", ") || "No golfers"}</span></div>) : assignments.map((ids, index) => <div key={index}><b>TEAM {index + 1}</b><span>{ids.map((id) => state.players.find((player) => player.id === id)?.name).filter(Boolean).join(" + ")}</span></div>)}</div></>}
          <button className="primary" onClick={() => setStep(5)}>COURSE & TEES <ChevronRight /></button>
        </section>
      )}

      {step === 5 && template && (
        <section className="builderCourseStep">
          <p className="builderEyebrow">COURSE & TEES</p><h2>Choose where you’re playing</h2>
          <p className="muted">GGC saves a complete copy of the course and tee with the competition so later library changes cannot alter scoring.</p>
          <label>Golf course<select value={courseId} onChange={(event) => { setCourseId(event.target.value); setTeeName(""); }}><option value="">Choose a course</option>{(state.courses || []).map((course) => <option value={course.id} key={course.id}>{course.name}</option>)}</select></label>
          <label>Tees<select value={teeName} onChange={(event) => setTeeName(event.target.value)} disabled={!selectedCourse}><option value="">Choose tees</option>{(selectedCourse?.tees || []).map((tee) => <option value={tee.name} key={tee.id || tee.name}>{tee.name}{tee.rating ? ` · CR ${tee.rating} / ${tee.slope}` : ""}</option>)}</select></label>
          <button className="secondary" onClick={() => setShowCourses(!showCourses)}>{showCourses ? "CLOSE COURSE MANAGEMENT" : "ADD / MANAGE COURSES & TEES"}</button>
          {showCourses && <div className="builderCourseManager">{courseManager}</div>}
          <button className="primary" onClick={() => setStep(6)}>REVIEW SETUP <ChevronRight /></button>
        </section>
      )}

      {step === 6 && template && (
        <section className="builderReview">
          <p className="builderEyebrow">PREVIEW</p><h2>Review before creating</h2>
          <article className="builderPreviewCard"><small>{structureLabel}</small><h3>{name || template.name}</h3><p>{template.summary}</p><dl><div><dt>Entrants</dt><dd>{entrantIds.length}</dd></div><div><dt>Course</dt><dd>{selectedCourse?.name || "Not selected"}</dd></div><div><dt>Tees</dt><dd>{teeName || "Not selected"}</dd></div><div><dt>Handicaps</dt><dd>Automatic</dd></div>{template.entrantRule?.sides && <div><dt>Side sizes</dt><dd>{sideA} v {sideB}</dd></div>}
            {answers.structure === "round-robin" && <div><dt>Fixtures per leg</dt><dd>{entrantCount * (entrantCount - 1) / 2}</dd></div>}
            {answers.structure === "knockout" && entrantCount >= 2 && <div><dt>Bracket</dt><dd>{entrantCount - 1} matches · {2 ** Math.ceil(Math.log2(entrantCount)) - entrantCount} byes</dd></div>}
            {answers.structure === "group-stage" && <div><dt>Stages</dt><dd>Group matches → Knockout</dd></div>}
            {answers.structure === "season" && <div><dt>Default events</dt><dd>{template.defaultRounds}</dd></div>}
            {answers.structure === "team-event" && <div><dt>Draft matches</dt><dd>{template.id === "hollingsworth-trophy" ? Math.floor(sideA / 2) : sideA * 2}</dd></div>}</dl></article>
          <div className="builderValidation">{validation.map((issue) => <div className={issue.level} key={issue.code}><span>{issue.level === "green" ? "✓" : issue.level === "amber" ? "!" : "×"}</span><p>{issue.message}</p></div>)}</div>
          <div className="builderFavouriteActions"><button className="secondary" onClick={() => onToggleFavourite?.(template.id, "personal")}><Star /> {personalFavourites.includes(template.id) ? "PERSONAL FAVOURITE SAVED" : "SAVE PERSONAL FAVOURITE"}</button><button className="secondary" onClick={() => onToggleFavourite?.(template.id, "group")}><Star /> {groupFavourites.includes(template.id) ? "GROUP FAVOURITE SAVED" : "SAVE FOR THIS GROUP"}</button></div>
          <button className="primary" disabled={blocked} onClick={() => onUseTemplate?.(template, { name: name || template.name, societyId: society?.id, audience: answers.audience, structure: answers.structure, style: answers.style, entrantIds, courseId, teeName, assignments })}>{template.family === "team-event" ? "CREATE DRAFT EVENT" : "CONTINUE TO STEP 5"} <ChevronRight /></button>
          <button className="secondary" onClick={() => setInfoId(template.id)}><Info /> VIEW / DOWNLOAD FULL RULES</button>
        </section>
      )}

      {infoId && <RulesDialog template={COMPETITION_TEMPLATES.find((item) => item.id === infoId)} onClose={() => setInfoId("")} />}
    </div>
  );
}
