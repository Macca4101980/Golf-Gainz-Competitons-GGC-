import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

test('matchplay has its own creation action and results surface',async()=>{
 const source=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(source,/CREATE MATCHPLAY/);
 assert.match(source,/modal==='newmatchplay'/);
 assert.match(source,/<MatchplayResults/);
});

test('round-robin remaining fixtures and group-to-knockout controls are present',async()=>{
 const source=await readFile(new URL('../src/MatchplaySeries.jsx',import.meta.url),'utf8');
 assert.match(source,/Left to play:/);
 assert.match(source,/LOCK GROUPS &amp; CREATE KNOCKOUT/);
 assert.match(source,/qualifyGroupStage/);
});

test('matchplay persistence records are excluded from ordinary League management',async()=>{
 const leagueSource=await readFile(new URL('../src/CompetitionGroups.jsx',import.meta.url),'utf8'),mainSource=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(leagueSource,/recordType!=='matchplay-series'/);
 assert.match(mainSource,/recordType !== "matchplay-series"/);
});
