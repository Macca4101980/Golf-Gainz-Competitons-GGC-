import React, { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Download, Info, Shuffle, Star, X } from "lucide-react";
import {
  BUILDER_AUDIENCES,
  BUILDER_DURATIONS,
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
      <p className="builderEyebrow">UNDERSTAND YOUR COMPETITION</p>
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
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return alert("Allow pop-ups to open the printable rules.");
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
        <div className="builderAutomation"><b>GGC HANDLES AUTOMATICALLY</b><span>Handicap allocations, randomisation, fixtures, scoring and progression where the template requires them.</span></div>
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
  const [answers, setAnswers] = useState({ audience: "", duration: "", style: "" });
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
  const template = COMPETITION_TEMPLATES.find((item) => item.id === selectedId) || null;
  const groupPlayers = (society?.members || []).map((id) => state.players.find((player) => player.id === id)).filter(Boolean);
  const selectedCourse = (state.courses || []).find((course) => course.id === courseId);
  const teamSize = answers.audience === "groups" ? 4 : 2;
  const validation = validateBuilderSetup({
    template,
    entrantIds,
    courseId,
    teeName,
    state,
    teamAssignments: template?.entrantRule?.sides ? assignments : [],
  });
  const blocked = validation.some((issue) => issue.level === "red");
  const progress = Math.round(((step + 1) / 7) * 100);

  function chooseTemplate(id) {
    const chosen = COMPETITION_TEMPLATES.find((item) => item.id === id);
    setSelectedId(id);
    setName(chosen?.name || "");
    const ids = groupPlayers.map((player) => player.id);
    setEntrantIds(ids);
    setAssignments(chosen?.entrantRule?.sides ? automaticAssignments(ids, { sides: 2 }) : automaticAssignments(ids, { size: answers.audience === "groups" ? 4 : 2 }));
    setStep(4);
  }

  function randomise() {
    setAssignments(template?.entrantRule?.sides
      ? automaticAssignments(entrantIds, { sides: 2, seed: Date.now() })
      : automaticAssignments(entrantIds, { size: teamSize, seed: Date.now() }));
  }

  function toggleEntrant(id) {
    setEntrantIds((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      setAssignments(template?.entrantRule?.sides
        ? automaticAssignments(next, { sides: 2 })
        : automaticAssignments(next, { size: teamSize }));
      return next;
    });
  }

  const summaryAnswers = [
    labels(BUILDER_AUDIENCES, answers.audience),
    labels(BUILDER_DURATIONS, answers.duration),
    labels(BUILDER_STYLES, answers.style),
  ];

  return (
    <div className="competitionBuilder">
      <div className="builderHeader">
        <button className="builderBack" aria-label="Back" onClick={() => step ? setStep(step - 1) : onClose()}><ArrowLeft /></button>
        <div><small>COMPETITION BUILDER</small><b>{step < 4 ? "Find the right format" : template?.name || "Build your competition"}</b></div>
        <span>{progress}%</span>
      </div>
      <div className="builderProgress"><i style={{ width: `${progress}%` }} /></div>

      {step === 0 && <ChoiceList title="Who is taking part?" help="Choose the size of the competitive unit. You can select the actual golfers later." items={BUILDER_AUDIENCES} value={answers.audience} onChange={(audience) => { setAnswers({ ...answers, audience }); setStep(1); }} />}
      {step === 1 && <ChoiceList title="How long will it run?" help="This separates a one-off day from a League, tour or staged event." items={BUILDER_DURATIONS} value={answers.duration} onChange={(duration) => { setAnswers({ ...answers, duration }); setStep(2); }} />}
      {step === 2 && <ChoiceList title="How should the winner be decided?" help="Choose the closest description. You can still adjust the final scoring setup." items={BUILDER_STYLES} value={answers.style} onChange={(style) => { setAnswers({ ...answers, style }); setStep(3); }} />}

      {step === 3 && (
        <section className="builderTemplates">
          <p className="builderEyebrow">CHOOSE YOUR COMPETITION</p>
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
          <button className="textbtn" onClick={() => { setAnswers({ audience: "", duration: "", style: "" }); setStep(0); }}>START AGAIN</button>
        </section>
      )}

      {step === 4 && template && (
        <section className="builderPersonalise">
          <p className="builderEyebrow">PERSONALISE</p><h2>Players and teams</h2>
          <label>Competition name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <div className="builderSelectAll"><b>ENTRANTS</b><button className="textbtn" onClick={() => { const ids = groupPlayers.map((player) => player.id); setEntrantIds(ids); setAssignments(template.entrantRule?.sides ? automaticAssignments(ids, { sides: 2 }) : automaticAssignments(ids, { size: teamSize })); }}>SELECT ALL</button></div>
          <div className="builderEntrants">{groupPlayers.map((player) => <label key={player.id}><input type="checkbox" checked={entrantIds.includes(player.id)} onChange={() => toggleEntrant(player.id)} /><span><b>{player.name}</b><small>HI {Number(player.hi || 0).toFixed(1)}</small></span></label>)}</div>
          {(answers.audience !== "individual" || template.entrantRule?.sides) && <><button className="secondary builderRandomise" onClick={randomise}><Shuffle /> RANDOMISE {template.entrantRule?.sides ? "SIDES" : "TEAMS"}</button><div className="builderAssignments">{template.entrantRule?.sides ? ["A", "B"].map((side) => <div key={side}><b>SIDE {side}</b><span>{assignments.filter((item) => item.side === side).map((item) => state.players.find((player) => player.id === item.playerId)?.name).filter(Boolean).join(", ") || "No golfers"}</span></div>) : assignments.map((ids, index) => <div key={index}><b>TEAM {index + 1}</b><span>{ids.map((id) => state.players.find((player) => player.id === id)?.name).filter(Boolean).join(" + ")}</span></div>)}</div></>}
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
          <article className="builderPreviewCard"><small>{template.family.replace("-", " ").toUpperCase()}</small><h3>{name || template.name}</h3><p>{template.summary}</p><dl><div><dt>Entrants</dt><dd>{entrantIds.length}</dd></div><div><dt>Course</dt><dd>{selectedCourse?.name || "Not selected"}</dd></div><div><dt>Tees</dt><dd>{teeName || "Not selected"}</dd></div><div><dt>Handicaps</dt><dd>Automatic</dd></div><div><dt>Fixtures / teams</dt><dd>Automatic</dd></div></dl></article>
          <div className="builderValidation">{validation.map((issue) => <div className={issue.level} key={issue.code}><span>{issue.level === "green" ? "✓" : issue.level === "amber" ? "!" : "×"}</span><p>{issue.message}</p></div>)}</div>
          <div className="builderFavouriteActions"><button className="secondary" onClick={() => onToggleFavourite?.(template.id, "personal")}><Star /> {personalFavourites.includes(template.id) ? "PERSONAL FAVOURITE SAVED" : "SAVE PERSONAL FAVOURITE"}</button><button className="secondary" onClick={() => onToggleFavourite?.(template.id, "group")}><Star /> {groupFavourites.includes(template.id) ? "GROUP FAVOURITE SAVED" : "SAVE FOR THIS GROUP"}</button></div>
          <button className="primary" disabled={blocked} onClick={() => onUseTemplate?.(template, { name: name || template.name, societyId: society?.id, audience: answers.audience, duration: answers.duration, style: answers.style, entrantIds, courseId, teeName, assignments })}>USE THIS TEMPLATE <ChevronRight /></button>
          <button className="secondary" onClick={() => setInfoId(template.id)}><Info /> VIEW / DOWNLOAD FULL RULES</button>
        </section>
      )}

      {infoId && <RulesDialog template={COMPETITION_TEMPLATES.find((item) => item.id === infoId)} onClose={() => setInfoId("")} />}
    </div>
  );
}
