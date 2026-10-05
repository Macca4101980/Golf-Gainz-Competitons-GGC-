import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const leagues=fs.readFileSync(new URL('../src/CompetitionGroups.jsx',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const wl=fs.readFileSync(new URL('../src/winterLeague.js',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));

test('current build marker is Beta.11',()=>{
  assert.equal(pkg.version,'3.9.6-beta.10');
  assert.match(main,/Build 3\.9\.6 Beta\.11/);
  assert.match(leagues,/GGC v3\.9\.6 Beta\.11/);
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


test('CP1 Results use the actual League name, not a hard-coded Winter League label',()=>{
  assert.match(main,/<h3>\{league\.name\} LEAGUE TABLE<\/h3>/);
  assert.match(main,/<h3>\{league\.name\} HANDICAPS<\/h3>/);
  assert.doesNotMatch(main,/<h3>WINTER LEAGUE TABLE<\/h3>/);
  assert.doesNotMatch(main,/<h3>WINTER LEAGUE HANDICAPS<\/h3>/);
});


test('CP2 identity links placeholders by verified email and never by name',()=>{
  assert.match(main,/const verifiedEmail=String\(auth\?\.user\?\.email/);
  assert.match(main,/normEmail\(q\.email\)===verifiedEmail/);
  assert.doesNotMatch(main,/norm\(q\.name\)===norm\(claimed\.name\)/);
  assert.match(main,/membershipStatus:'member'/);
  assert.match(main,/Build 3\.9\.6 Beta\.11/);
});
