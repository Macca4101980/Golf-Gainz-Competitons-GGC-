import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8'),screen=fs.readFileSync(new URL('../src/GroupScoreScreen.jsx',import.meta.url),'utf8');
test('legacy Group without a code cannot crash join lookup',()=>assert.match(main,/String\(x\?\.code\|\|''\)\.toUpperCase\(\)/));
test('Group scorecard receives cloud persistence callback',()=>{assert.match(main,/onPersist=\{async next=>/);assert.match(screen,/await persist\(next\)/)});
test('Group scorecard has safe restart and audit',()=>{assert.match(screen,/RESTART GROUP ROUND/);assert.match(screen,/action:'RESTART GROUP ROUND'/);assert.match(screen,/action:'START GROUP ROUND'/);assert.match(screen,/action:'SUBMIT GROUP ROUND'/)});
test('Group scorecard honours front and back nine display',()=>assert.match(screen,/c\.holesMode==='front9'\?i<9:c\.holesMode==='back9'\?i>=9:true/));
test('Group competitions route through Group leaderboard for OOM',()=>{assert.match(main,/if\(isGroupFormat\(c\?\.format\)\)/);assert.match(main,/groupLeaderboard\(c,state\)/)});
