import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');

test('group deletion creates a persistent society tombstone',()=>{
  assert.match(src,/deletedSocietyIds:\[\.\.\.new Set\(\[\.\.\.\(state\.deletedSocietyIds\|\|\[\]\),target\.id\]\)\]/);
});

test('live merge unions group tombstones before merging societies',()=>{
  assert.match(src,/const deletedSocietyIds=\[\.\.\.new Set/);
  assert.match(src,/societies=byId\(local\.societies,remote\.societies,newer\)\.filter\(s=>!deletedSocietySet\.has\(s\.id\)\)/);
});

test('migration retains group tombstones',()=>{
  assert.match(src,/deletedSocietyIds:y\.deletedSocietyIds\|\|\[\]/);
});
