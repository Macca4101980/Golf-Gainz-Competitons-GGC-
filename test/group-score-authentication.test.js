import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
test('group scoring requires authentication before cloud persistence',()=>{
 assert.match(source,/onPersist=\{async next=>\{if\(!CLOUD\|\|!auth\?\.access_token\)throw Error/);
});
