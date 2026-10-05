import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const src=fs.readFileSync(new URL('../src/CompetitionGroups.jsx',import.meta.url),'utf8');
test('group golfer add/edit parses + handicap as negative internal HI',()=>{assert.match(src,/startsWith\('\+'\)\?-Math\.abs\(parseFloat/);assert.match(src,/p\.hi<0\?'\+'\+Math\.abs\(p\.hi\)/)});
