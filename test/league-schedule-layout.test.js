import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const scheduleSource=readFileSync(new URL('../src/CompetitionGroups.jsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');

test('league weeks render as compact summaries before editing',()=>{
 assert.match(scheduleSource,/leagueScheduleSummaryName/);
 assert.match(scheduleSource,/SCORING OPENS/);
 assert.match(scheduleSource,/ENTRY WINDOW/);
 assert.match(scheduleSource,/ENTRY CLOSES/);
 assert.match(scheduleSource,/FULL SCORES LIVE/);
 assert.match(scheduleSource,/PROVISIONAL CARDS/);
 assert.match(scheduleSource,/EDIT SCHEDULE/);
});

test('schedule editor opens as an accessible on-demand sheet',()=>{
 assert.match(scheduleSource,/role="dialog"/);
 assert.match(scheduleSource,/aria-modal="true"/);
 assert.match(scheduleSource,/SAVE CHANGES/);
 assert.match(scheduleSource,/Escape/);
 assert.match(styles,/\.leagueScheduleSheetBackdrop\{/);
 assert.match(styles,/max-height:94dvh/);
});

test('summary retains the date-driven lifecycle badge',()=>{
 assert.match(scheduleSource,/leagueCompetitionLifecycle\(comp\)/);
 assert.match(scheduleSource,/lifecycle==='closed'\?'COMPLETE'/);
 assert.match(scheduleSource,/pill \$\{lifecyclePill\}/);
 assert.match(styles,/\.leagueScheduleHeading \.pill\.live/);
 assert.match(styles,/\.leagueScheduleHeading \.pill\.completed/);
});

test('mobile editor exposes every action above the app navigation',()=>{
 assert.match(styles,/body:has\(\.leagueScheduleSheetBackdrop\) \.app>nav/);
 assert.match(styles,/visibility:hidden/);
 assert.match(styles,/SET DATE/);
 assert.match(styles,/\.leagueScheduleActions button\{min-height:39px/);
});

test('schedule editor uses the selected timeline layout',()=>{
 assert.match(scheduleSource,/leagueTimelineEditor/);
 assert.match(scheduleSource,/LeagueScheduleGlyph kind="launch"/);
 assert.match(scheduleSource,/7 days entry window|days entry window/);
 assert.match(scheduleSource,/leagueTimelinePicker/);
 assert.match(styles,/\.leagueTimeline::before/);
 assert.match(styles,/\.leagueTimelineIcon\.launch/);
});

test('timeline keeps duration and release controls editable',()=>{
 assert.match(scheduleSource,/aria-label="Entry window in days"/);
 assert.match(scheduleSource,/aria-label="Launch and scoring opens"/);
 assert.match(scheduleSource,/aria-label="Provisional cards release"/);
 assert.match(scheduleSource,/aria-label="Full scores release"/);
});


test('League teams use compact single-open accordion controls',()=>{
 assert.match(scheduleSource,/openTeamId/);
 assert.match(scheduleSource,/leagueTeamAccordion/);
 assert.match(scheduleSource,/aria-expanded=\{open\}/);
 assert.match(scheduleSource,/leagueTeamActions/);
 assert.match(styles,/\.leagueTeamAccordionList/);
 assert.match(styles,/\.leagueTeamActions\{display:grid;grid-template-columns:repeat\(2/);
});
