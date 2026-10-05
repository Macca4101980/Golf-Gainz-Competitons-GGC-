import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const leagues=fs.readFileSync(new URL('../src/CompetitionGroups.jsx',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const wl=fs.readFileSync(new URL('../src/winterLeague.js',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));

test('CP1 build marker is Beta.9',()=>{
  assert.equal(pkg.version,'3.9.6-beta.9');
  assert.match(main,/Build 3\.9\.6 Beta\.9/);
  assert.match(leagues,/GGC v3\.9\.6 Beta\.9/);
});

test('CP1 team rename preserves team identity and updates linked pair display',()=>{
  assert.match(leagues,/function renameTeam\(team\)/);
  assert.match(leagues,/t\.id===team\.id\?\{\.\.\.t,name\}:t/);
  assert.match(leagues,/p\.id===team\.id\?\{\.\.\.p,name\}:p/);
  assert.match(leagues,/RENAME LEAGUE TEAM/);
});

test('CP1 competition can link or unlink a League',()=>{
  assert.match(main,/const\[leagueId,setLeagueId\]/);
  assert.match(main,/<option value="">None<\/option>/);
  assert.match(main,/leagueId:leagueId\|\|null/);
  assert.match(main,/leagueOomSettings:inheritedOom/);
});

test('CP1 League length is initial setup quantity, not a hard cap',()=>{
  assert.match(leagues,/Initial number of competitions/);
  assert.match(leagues,/\+ ADD ANOTHER LEAGUE COMPETITION/);
  assert.doesNotMatch(leagues,/comps\.length>0&&comps\.length<\(league\.targetCompetitions/);
});

test('CP1 League OOM and Best-X persist on the League',()=>{
  assert.match(leagues,/oomSettings:\{enabled:true,mode:'automatic',bestCount:0/);
  assert.match(leagues,/function setLeagueOomRule/);
  assert.match(leagues,/leagueOomSettings:\{\.\.\.oomSettings\}/);
  assert.match(wl,/league\?\.oomSettings\?\.bestCount/);
});
