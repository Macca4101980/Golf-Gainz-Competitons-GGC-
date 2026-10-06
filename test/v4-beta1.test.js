import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8'),league=fs.readFileSync(new URL('../src/CompetitionGroups.jsx',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8'),pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
test('V4 Beta 1 build identity is consistent',()=>{assert.equal(pkg.version,'4.0.0-beta.1');assert.match(main,/V4 Beta 1/);assert.match(league,/V4 Beta 1/)});
test('Golf Gain Comps branding is clean',()=>{assert.doesNotMatch(main,/Golf Gainz Comps|GOLF GAINZ COMPS|<em>GAINZ<\/em>/ )});
test('Golf Gain companion card uses supplied App Store listing and local image',()=>{assert.match(main,/https:\/\/apps\.apple\.com\/gb\/app\/golf-gain\/id6807343148/);assert.match(main,/src="\/golf-gain-app\.jpg"/);assert.match(css,/\.golfGainCard/)});
test('plus handicap input remains presentation plus and internal negative',()=>{assert.match(main,/rawHi\.startsWith\('\+'\)\?-Math\.abs\(parseFloat/);assert.match(main,/const formatHI=v=>\{const n=\+v\|\|0;return n<0\?\x60\+\$\{Math\.abs\(n\)\.toFixed\(1\)\}\x60/)});
test('group deletion tombstone protection remains',()=>{assert.match(main,/deletedSocietyIds/);assert.match(main,/deletedSocietySet/)});
test('league money reconciliation remains available',()=>{for(const s of['LEAGUE MONEY','MONZO SHOULD SHOW','WHO HAS PAID IN?','PAYOUTS','2s rollover'])assert.ok(main.includes(s))});
