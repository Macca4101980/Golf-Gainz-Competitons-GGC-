import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

test('matchplay has its own creation action and results surface',async()=>{
 const source=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(source,/CREATE MATCHPLAY/);
 assert.match(source,/CREATE MATCHPLAY LEAGUE OR KNOCKOUT/);
 assert.match(source,/modal==='newmatchplay'/);
 assert.match(source,/<MatchplayResults/);
 assert.match(source,/<MatchplayFixtures/);
 assert.match(source,/tab==='comps'/);
 assert.match(source,/playoffs=\{series\.filter\(record=>record\.sourceLeagueId===l\.id\)\}/);
 assert.match(source,/className="card wlMatchplayCard wlSection"/);
});

test('matchplay management can rebuild or delete a standalone competition safely',async()=>{
 const main=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8'),series=await readFile(new URL('../src/MatchplaySeries.jsx',import.meta.url),'utf8');
 assert.match(series,/Structure/);
 assert.match(series,/rebuildMatchplayRecord/);
 assert.match(series,/DELETE MATCHPLAY &amp; ALL MATCHES/);
 assert.match(main,/REBUILD MATCHPLAY STRUCTURE/);
 assert.match(main,/action:'DELETE MATCHPLAY'/);
 assert.match(main,/deletedCompIds/);
 assert.match(main,/deletedCardIds/);
});

test('round-robin remaining fixtures and group-to-knockout controls are present',async()=>{
 const source=await readFile(new URL('../src/MatchplaySeries.jsx',import.meta.url),'utf8');
 assert.match(source,/Left to play:/);
 assert.match(source,/LOCK GROUPS &amp; CREATE KNOCKOUT/);
 assert.match(source,/qualifyGroupStage/);
});

test('admins manage matchplay in Settings with exactly three handicap bases',async()=>{
 const main=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8'),series=await readFile(new URL('../src/MatchplaySeries.jsx',import.meta.url),'utf8'),leagues=await readFile(new URL('../src/CompetitionGroups.jsx',import.meta.url),'utf8');
 assert.match(main,/modal==='editmatchplay'/);
 assert.match(leagues,/MATCHPLAY &amp; KNOCKOUTS/);
 assert.match(leagues,/MATCHPLAY COMPETITIONS/);
 assert.match(leagues,/ggc-manage-matchplay/);
 assert.doesNotMatch(series,/MANAGE KNOCKOUTS/);
 assert.match(series,/Start-of-competition handicap position/);
 assert.match(series,/End-of-competition handicap position/);
 assert.match(series,/Current GGC Handicap Index/);
 assert.match(series,/handicapSettings:/);
 assert.match(series,/handicapAdjustmentMode/);
 assert.match(series,/Handicap rules are locked because a knockout scorecard has already\s+been created/);
});

test('matchplay entrants default selected and have select-all controls',async()=>{
 const series=await readFile(new URL('../src/MatchplaySeries.jsx',import.meta.url),'utf8');
 assert.match(series,/setSelected\(choices\.map\(\(item\) => item\.id\)\)/);
 assert.match(series,/SELECT ALL/);
 assert.match(series,/CLEAR ALL/);
});

test('players only receive their fixtures while admins can expand other matches',async()=>{
 const series=await readFile(new URL('../src/MatchplaySeries.jsx',import.meta.url),'utf8');
 assert.match(series,/fixtureParticipant/);
 assert.match(series,/const others = isAdmin/);
 assert.match(series,/OTHER MATCHES/);
});

test('League result sections use the requested order',async()=>{
 const main=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
 const start=main.indexOf('function HistoricalLeagueResults');
 const section=main.slice(start,main.indexOf('function HistoricalLeagueTable',start)>start?main.indexOf('function HistoricalLeagueTable',start):start+30000);
 const positions=['WEEKLY RESULTS','LEAGUE TABLE','playoffs.map','HANDICAPS'].map(value=>section.indexOf(value));
 assert.ok(positions.every(value=>value>=0));
 assert.deepEqual([...positions].sort((a,b)=>a-b),positions);
 assert.doesNotMatch(section,/onManage=/);
 assert.doesNotMatch(section,/onScorecard=/);
});

test('matchplay persistence records are excluded from ordinary League management',async()=>{
 const leagueSource=await readFile(new URL('../src/CompetitionGroups.jsx',import.meta.url),'utf8'),mainSource=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(leagueSource,/recordType!=='matchplay-series'/);
 assert.match(mainSource,/recordType !== "matchplay-series"/);
});
