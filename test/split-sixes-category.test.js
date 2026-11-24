import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FORMAT_RULES } from '../src/scoring.js';

const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('Split Sixes is listed under Group matches and retains its dedicated engine', () => {
  assert.equal(FORMAT_RULES.sixes.category, 'group');
  assert.ok(main.includes("['sixes','Split Sixes','Exactly three golfers share six points on every hole.','points','Group']"));
  assert.ok(main.includes("c.format==='sixes'"));
  assert.ok(main.includes('splitSixesResult(c,displayState)'));
});
