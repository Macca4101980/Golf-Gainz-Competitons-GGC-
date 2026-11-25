export const BUILDER_AUDIENCES = Object.freeze([
  { id: "individual", label: "Individual golfers", detail: "One golfer, one score." },
  { id: "pairs", label: "Pairs", detail: "Teams of two golfers." },
  { id: "groups", label: "Teams of up to 4", detail: "Playing groups or small teams." },
  { id: "societies", label: "Large teams / club vs club", detail: "Society, club or county sides." },
]);

export const BUILDER_DURATIONS = Object.freeze([
  { id: "one-off", label: "One day / one-off", detail: "A single competition or match." },
  { id: "series", label: "Over several weeks or months", detail: "A League, tour or multi-stage event." },
  { id: "unsure", label: "I’m not sure", detail: "Show both suitable choices." },
]);

export const BUILDER_STYLES = Object.freeze([
  { id: "course", label: "Score against the course", detail: "Stableford, stroke play or points." },
  { id: "head-to-head", label: "Head-to-head competition", detail: "Golfers or teams play opponents." },
  { id: "mixed", label: "A mixture of both", detail: "Qualifying, tables and knockout stages." },
  { id: "unsure", label: "I’m not sure", detail: "Let GGC recommend the best fit." },
]);

const t = (template) => Object.freeze(template);

export const COMPETITION_TEMPLATES = Object.freeze([
  t({
    id: "traditional-golf-day",
    name: "Traditional Golf Day",
    family: "competition",
    audiences: ["individual", "pairs", "groups"],
    durations: ["one-off"],
    styles: ["course"],
    summary: "A one-day competition with automatic handicaps, live scoring and results.",
    overview: "Choose an individual, pairs or group format. GGC applies the format allowance, locks the course card and produces the leaderboard.",
    defaultFormat: "stableford",
    rules: ["One competition", "Automatic Playing Handicap", "Live leaderboard", "Optional prizes and 2s"],
    entrantRule: { min: 1 },
  }),
  t({
    id: "traditional-matchplay",
    name: "Traditional Matchplay",
    family: "matchplay",
    audiences: ["individual", "pairs"],
    durations: ["one-off", "series"],
    styles: ["head-to-head"],
    summary: "Singles or pairs head-to-head matchplay.",
    overview: "GGC calculates shots off the lowest player, follows the match hole by hole and detects the result automatically.",
    defaultFormat: "matchplay",
    matchplayMode: "knockout",
    rules: ["Singles or pairs", "Automatic match allowances", "Sudden death available", "Concessions supported"],
    entrantRule: { min: 2 },
  }),
  t({
    id: "club-championship",
    name: "Club Championship",
    family: "league",
    audiences: ["individual"],
    durations: ["series"],
    styles: ["course", "mixed"],
    summary: "Multi-round gross or nett championship with optional knockout stages.",
    overview: "Run qualifying rounds, retain complete score history and optionally progress the leading golfers into matchplay.",
    defaultFormat: "gross-stroke",
    defaultRounds: 2,
    rules: ["Multi-round championship", "Gross or nett scoring", "Optional qualification", "Optional knockout"],
    entrantRule: { min: 2 },
  }),
  t({
    id: "golf-tour",
    name: "Golf Tour",
    family: "league",
    audiences: ["individual", "pairs", "groups"],
    durations: ["series"],
    styles: ["course", "mixed"],
    summary: "A schedule of competitions across one or more courses.",
    overview: "Create the rounds, points table and counting-round rules while each event keeps its own course snapshot.",
    defaultFormat: "stableford",
    defaultRounds: 4,
    rules: ["Multiple venues", "Order of Merit", "Best-X counting", "Automatic schedule"],
    entrantRule: { min: 2 },
  }),
  t({
    id: "winter-league-farthingstone",
    name: "Winter League (Farthingstone)",
    family: "league",
    audiences: ["pairs"],
    durations: ["series"],
    styles: ["course", "mixed"],
    summary: "GGC’s established pairs Winter League rules packaged as a reusable template.",
    overview: "Weekly Individual Stableford cards combine as Better Ball. A solo card still counts. Starting allowance is 90% and team cuts carry forward.",
    defaultFormat: "stableford",
    defaultRounds: 10,
    rules: ["Pairs Better Ball", "Best 8 of 10 by default", "90% starting allowance", "Team cuts split equally", "Optional top-four playoff"],
    entrantRule: { min: 2, multiple: 2 },
  }),
  t({
    id: "order-of-merit",
    name: "Order of Merit",
    family: "league",
    audiences: ["individual", "pairs", "groups"],
    durations: ["series"],
    styles: ["course"],
    summary: "A season table built from linked competitions.",
    overview: "Choose points or cumulative scoring, decide how many rounds count and let every linked competition update the standings.",
    defaultFormat: "stableford",
    defaultRounds: 8,
    rules: ["Automatic standings", "Best-X option", "Multiple formats", "Cancelled rounds excluded"],
    entrantRule: { min: 2 },
  }),
  t({
    id: "race-to-dubai",
    name: "Race to Dubai",
    family: "league",
    audiences: ["individual"],
    durations: ["series"],
    styles: ["course"],
    summary: "Season-long points race with weighted events and a final.",
    overview: "Use Order of Merit points, optional enhanced points for selected events and a named season finale.",
    defaultFormat: "stableford",
    defaultRounds: 8,
    rules: ["Season points", "Weighted events", "Counting rounds", "Final standings"],
    entrantRule: { min: 2 },
  }),
  t({
    id: "fedex-cup",
    name: "FedEx Cup",
    family: "league",
    audiences: ["individual"],
    durations: ["series"],
    styles: ["course", "mixed"],
    summary: "Points season followed by progressive playoff events.",
    overview: "Build a season table, qualify a reduced field and carry the competition through staged playoffs.",
    defaultFormat: "stroke",
    defaultRounds: 8,
    rules: ["Points season", "Qualification cut", "Playoff stages", "Automatic progression"],
    entrantRule: { min: 4 },
  }),
  t({
    id: "football-league",
    name: "Football League",
    family: "matchplay",
    audiences: ["individual", "pairs", "societies"],
    durations: ["series"],
    styles: ["head-to-head"],
    summary: "Every entrant plays a round-robin fixture list with a league table.",
    overview: "GGC generates every fixture, records wins, draws and losses and calculates the table automatically.",
    defaultFormat: "matchplay",
    matchplayMode: "round-robin",
    rules: ["Automatic fixtures", "Single or double round robin", "Configurable W/D/L points", "Holes-difference tiebreak"],
    entrantRule: { min: 2 },
  }),
  t({
    id: "fa-cup",
    name: "FA Cup",
    family: "matchplay",
    audiences: ["individual", "pairs", "societies"],
    durations: ["series", "one-off"],
    styles: ["head-to-head"],
    summary: "Straight knockout with automatic byes and progression.",
    overview: "Any field size can enter. GGC expands the bracket, gives the highest seeds byes and advances winners automatically.",
    defaultFormat: "matchplay",
    matchplayMode: "knockout",
    rules: ["Automatic bracket", "Odd fields receive byes", "Configurable round deadlines", "Automatic final"],
    entrantRule: { min: 2, knockout: true },
  }),
  t({
    id: "world-cup",
    name: "World Cup",
    family: "matchplay",
    audiences: ["individual", "pairs", "societies"],
    durations: ["series"],
    styles: ["mixed", "head-to-head"],
    summary: "Balanced groups followed by a knockout.",
    overview: "GGC seeds the groups, generates each group fixture and progresses qualifiers into the complete knockout bracket.",
    defaultFormat: "matchplay",
    matchplayMode: "group-stage",
    rules: ["Balanced groups", "Round-robin group fixtures", "Automatic qualification", "Knockout progression"],
    entrantRule: { min: 4 },
  }),
  t({
    id: "champions-league",
    name: "Champions League",
    family: "matchplay",
    audiences: ["pairs", "societies"],
    durations: ["series"],
    styles: ["mixed", "head-to-head"],
    summary: "Seeded group stage and two-leg or single-leg knockout ties.",
    overview: "Use team entrants, group tables and an automatically generated knockout phase.",
    defaultFormat: "4bbb-match",
    matchplayMode: "group-stage",
    rules: ["Team groups", "Automatic fixtures", "Qualifiers progress", "Final winner"],
    entrantRule: { min: 4 },
  }),
  t({
    id: "ryder-solheim-cup",
    name: "Ryder / Solheim Cup",
    family: "team-event",
    audiences: ["societies"],
    durations: ["one-off", "series"],
    styles: ["head-to-head", "mixed"],
    summary: "Two large teams contest Four-Ball, Foursomes and Singles sessions.",
    overview: "Captains select line-ups for each session. GGC applies the correct match allowance and totals points into the event scoreboard.",
    defaultFormat: "4bbb-match",
    rules: ["Two sides", "Four-Ball session", "Foursomes session", "Singles session", "Aggregate event points"],
    entrantRule: { min: 8, sides: 2, perSide: 4 },
  }),
  t({
    id: "presidents-cup",
    name: "Presidents Cup",
    family: "team-event",
    audiences: ["societies"],
    durations: ["one-off", "series"],
    styles: ["head-to-head", "mixed"],
    summary: "Large-team matchplay event with configurable pairs and singles sessions.",
    overview: "Build two squads, set each session format and let GGC generate the line-up slots and overall points scoreboard.",
    defaultFormat: "4bbb-match",
    rules: ["Two squads", "Multiple sessions", "Pairs and singles", "Event scoreboard"],
    entrantRule: { min: 8, sides: 2, perSide: 4 },
  }),
  t({
    id: "county-handicap-league",
    name: "County Handicap League",
    family: "team-event",
    audiences: ["societies"],
    durations: ["series"],
    styles: ["head-to-head"],
    summary: "Club-v-club fixtures using six Four-Ball pairs and aggregate holes-up.",
    overview: "Designed from the county Handicap League pattern: 12 players per side, six 4BBB matches and a fixture result from aggregate holes-up.",
    defaultFormat: "4bbb-match",
    rules: ["12 players per side", "Six Four-Ball matches", "Aggregate holes-up", "League fixture table"],
    entrantRule: { min: 24, sides: 2, perSide: 12 },
  }),
  t({
    id: "hollingsworth-trophy",
    name: "Hollingsworth Trophy",
    family: "team-event",
    audiences: ["societies"],
    durations: ["one-off", "series"],
    styles: ["head-to-head"],
    summary: "Club-v-club handicap Foursomes arranged as five matches.",
    overview: "Ten players per side form five Foursomes pairs. Match results combine into the overall fixture.",
    defaultFormat: "foursomes-match",
    rules: ["10 players per side", "Five Foursomes matches", "Automatic pair handicaps", "Overall fixture result"],
    entrantRule: { min: 20, sides: 2, perSide: 10 },
  }),
  t({
    id: "the-open",
    name: "The Open",
    family: "league",
    audiences: ["individual"],
    durations: ["series"],
    styles: ["course"],
    summary: "Multi-round stroke play with a cut and final leaderboard.",
    overview: "Schedule qualifying rounds, apply a cut after the configured round and retain cumulative gross or nett totals.",
    defaultFormat: "gross-stroke",
    defaultRounds: 4,
    rules: ["Multi-round stroke play", "Cut after qualifying rounds", "Cumulative total", "Countback-ready results"],
    entrantRule: { min: 2 },
  }),
]);

export function templateById(id) {
  return COMPETITION_TEMPLATES.find((template) => template.id === id) || null;
}

const matches = (values, choice) =>
  choice === "unsure" || values.includes(choice) || (choice === "mixed" && values.includes("head-to-head"));

export function recommendTemplates(answers = {}, favourites = []) {
  const audience = answers.audience || "individual";
  const duration = answers.duration || "unsure";
  const style = answers.style || "unsure";
  return COMPETITION_TEMPLATES
    .map((template) => {
      let score = 0;
      if (template.audiences.includes(audience)) score += 8;
      else score -= 12;
      if (matches(template.durations, duration)) score += 4;
      else if (duration !== "unsure") score -= 4;
      if (matches(template.styles, style)) score += 5;
      else if (style !== "unsure") score -= 3;
      if (favourites.includes(template.id)) score += 1;
      return { ...template, recommendationScore: score };
    })
    .filter((template) => template.recommendationScore >= 8)
    .sort((a, b) => b.recommendationScore - a.recommendationScore || a.name.localeCompare(b.name));
}

export function validateBuilderSetup({ template, entrantIds = [], courseId, teeName, state, teamAssignments = [] } = {}) {
  const issues = [];
  if (!template) return [{ level: "red", code: "template", message: "Choose a competition template." }];
  const count = new Set(entrantIds).size;
  const rule = template.entrantRule || {};
  if (count < (rule.min || 1)) {
    const detail = rule.perSide
      ? `This template needs at least ${rule.perSide} golfers per side (${rule.min} in total).`
      : `This template needs at least ${rule.min || 1} golfer${(rule.min || 1) === 1 ? "" : "s"}.`;
    issues.push({ level: "red", code: "entrants-min", message: detail });
  }
  if (rule.multiple && count >= (rule.min || 1) && count % rule.multiple !== 0)
    issues.push({ level: "amber", code: "entrants-multiple", message: `This format works in groups of ${rule.multiple}. GGC will leave one golfer unassigned until another is added.` });
  if (rule.knockout && count > 2 && (count & (count - 1)) !== 0)
    issues.push({ level: "amber", code: "knockout-byes", message: `A ${count}-entrant knockout is not a power of two. GGC will give the highest seeds automatic byes.` });
  if (rule.sides === 2 && teamAssignments.length) {
    const sides = [teamAssignments.filter((item) => item.side === "A").length, teamAssignments.filter((item) => item.side === "B").length];
    if (Math.min(...sides) < rule.perSide)
      issues.push({ level: "red", code: "side-min", message: `Each side needs at least ${rule.perSide} golfers. Current sides: ${sides[0]} and ${sides[1]}.` });
    else if (sides[0] !== sides[1])
      issues.push({ level: "amber", code: "side-balance", message: `The sides contain ${sides[0]} and ${sides[1]} golfers. Balance them before launch.` });
  }
  const course = (state?.courses || []).find((item) => item.id === courseId);
  const tee = course?.tees?.find((item) => item.name === teeName || item.id === teeName);
  if (!courseId) issues.push({ level: "red", code: "course", message: "Choose or add the golf course before creating the competition." });
  else if (!course) issues.push({ level: "red", code: "course-missing", message: "The selected course is no longer available." });
  if (!teeName) issues.push({ level: "red", code: "tee", message: "Choose the tees before creating the competition." });
  else if (!tee) issues.push({ level: "red", code: "tee-missing", message: "The selected tees are not available for this course." });
  else {
    const holes = Array.isArray(tee.holes) ? tee.holes : [];
    const complete = holes.length === 18 && holes.every((hole) => Number(hole.par) >= 3 && Number(hole.si) >= 1);
    if (!complete || !(Number(tee.rating) > 0) || !(Number(tee.slope) >= 55))
      issues.push({ level: "red", code: "tee-incomplete", message: "The selected tee needs a complete 18-hole card, Course Rating and Slope." });
  }
  if (!issues.some((issue) => issue.level === "red"))
    issues.push({ level: "green", code: "ready", message: "Entrants, format, course and tees are ready. GGC will calculate handicaps and fixtures automatically." });
  return issues;
}

export function seededShuffle(values, seed = Date.now()) {
  const output = [...values];
  let value = Number(seed) || 1;
  const random = () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

export function automaticAssignments(playerIds, { size = 2, sides = 0, seed = Date.now() } = {}) {
  const shuffled = seededShuffle([...new Set(playerIds)], seed);
  if (sides === 2)
    return shuffled.map((playerId, index) => ({ playerId, side: index % 2 ? "B" : "A" }));
  const groups = [];
  for (let index = 0; index < shuffled.length; index += size)
    groups.push(shuffled.slice(index, index + size));
  return groups;
}

export function templatePreset(template, setup = {}) {
  if (!template) return {};
  const base = {
    name: setup.name || template.name,
    societyId: setup.societyId,
    format: template.defaultFormat || "stableford",
    entries: [...new Set(setup.entrantIds || [])],
    course: setup.courseId || "",
    tee: setup.teeName || "",
    handicapAllowance: setup.handicapAllowance,
    builderTemplateId: template.id,
  };
  if (Array.isArray(setup.assignments) && setup.assignments.length && !template.entrantRule?.sides) {
    base.pairs = setup.assignments.map((ids, index) => ({ id: `builder-team-${Date.now()}-${index}`, name: `Team ${index + 1}`, ids }));
    base.pairingMode = "preset";
  }
  return base;
}

export function builderRulesText(template) {
  if (!template) return "";
  return [
    template.name,
    template.summary,
    "",
    template.overview,
    "",
    "DEFAULT RULES",
    ...template.rules.map((rule) => `• ${rule}`),
    "",
    "GGC AUTOMATION",
    "• Handicap allocations use the selected format and saved Handicap Indexes.",
    "• Fixtures, brackets or groups are generated by GGC when the template requires them.",
    "• The selected course and tee are saved as an immutable competition snapshot.",
    "• The organiser can review every setting before launch.",
  ].join("\n");
}
