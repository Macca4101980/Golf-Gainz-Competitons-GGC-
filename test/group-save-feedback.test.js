import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/GroupScoreScreen.jsx',import.meta.url),'utf8');
test('group scorecard surfaces cloud save errors without treating them as success',()=>{
 assert.match(src,/const\[saveError,setSaveError\]=useState\(''\)/);
 assert.match(src,/catch\(error\)\{setSaveError\('Cloud save failed/);
 assert.match(src,/throw error/);
 assert.match(src,/role="alert"/);
});
test('group scorecard only navigates away after successful submission',()=>{
 assert.match(src,/await persist\(next\);back\(\)/);
});
