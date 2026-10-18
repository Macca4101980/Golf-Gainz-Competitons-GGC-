import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
test('group scorecard rejects unauthenticated save rather than reporting success',()=>{
 assert.match(src,/onPersist=\{async next=>\{if\(!CLOUD\|\|!auth\?\.access_token\)throw Error\('GGC_SIGN_IN_REQUIRED'\)/);
 assert.match(src,/await saveCloud\(next,setCloud,auth.access_token\)/);
});
