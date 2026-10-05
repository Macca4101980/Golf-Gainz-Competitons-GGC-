import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
const src=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
test('actual Groups Add New Golfer parses + HI as negative',()=>assert.match(src,/newGolfer\.hi[\s\S]{0,180}rawHi\.startsWith\('\+'\)\?-Math\.abs\(parseFloat/));
test('actual Groups Manage golfer parses + HI as negative and displays plus when editing',()=>{assert.match(src,/prompt\('Handicap Index:',p\.hi<0\?'\+'\+Math\.abs\(p\.hi\)/);assert.match(src,/const rawHi=String\(h\)[\s\S]{0,100}startsWith\('\+'\)\?-Math\.abs/);});
