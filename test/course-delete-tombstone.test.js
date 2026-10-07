import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');

test('course deletion creates a persistent tombstone',()=>{
  assert.match(src,/deletedCourseIds:\[\.\.\.new Set\(\[\.\.\.\(state\.deletedCourseIds\|\|\[\]\),c\.id\]\)\]/);
});

test('live merge unions course tombstones and blocks stale resurrection',()=>{
  assert.match(src,/const deletedCourseIds=\[\.\.\.new Set/);
  assert.match(src,/courses=byId\(local\.courses,remote\.courses,newer\)\.filter\(c=>!deletedCourseSet\.has\(c\.id\)\)/);
});

test('migration retains tombstones and does not reseed a deleted built-in course',()=>{
  assert.match(src,/deletedCourseIds=y\.deletedCourseIds\|\|\[\]/);
  assert.match(src,/if\(deletedCourseSet\.has\(b\.id\)\)continue/);
});
