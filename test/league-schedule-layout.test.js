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
 assert.match(scheduleSource,/lifecycle\.toUpperCase\(\)/);
 assert.match(styles,/\.leagueScheduleHeading small\.live/);
 assert.match(styles,/\.leagueScheduleHeading small\.closed/);
});

test('mobile editor exposes every action above the app navigation',()=>{
 assert.match(styles,/body:has\(\.leagueScheduleSheetBackdrop\) \.app>nav/);
 assert.match(styles,/visibility:hidden/);
 assert.match(styles,/SET DATE/);
 assert.match(styles,/\.leagueScheduleActions button\{min-height:39px/);
});

test('mobile editor uses compact label and value rows',()=>{
 assert.match(styles,/grid-template-columns:minmax\(118px,.8fr\) minmax\(0,1.2fr\)/);
 assert.match(styles,/\.leagueScheduleGrid label:not\(\.leagueScheduleName\) input\{grid-column:2/);
 assert.match(styles,/\.leagueScheduleName\{[\s\S]*grid-template-columns:1fr/);
});
