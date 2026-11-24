import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');

test('temporary golfers join the selected Group immediately without reloading the app',()=>{
 assert.match(main,/societies:state\.societies\.map\(group=>group\.id===s\.id\?\{\.\.\.group,members:\[\.\.\.new Set\(\[\.\.\.\(group\.members\|\|\[\]\),p\.id\]\)\]\}:group\)/);
 assert.match(main,/if\(CLOUD&&auth\?\.access_token\)\{await saveCloud\(next,setCloud,auth\.access_token\);await runGroupAction\('ggc_group_add_temporary_golfer'/);
 const save=main.slice(main.indexOf('async function saveNewGolfer'),main.indexOf('async function inviteExisting'));
 assert.doesNotMatch(save,/location\.reload/);
});
