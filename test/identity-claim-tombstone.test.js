import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');

test('claimed golfer creates a permanent old-to-auth identity mapping',()=>{
 assert.match(src,/for\(const old of linkedIds\)identityLinks\[old\]=id/);
});
test('live merge preserves identity mappings and canonicalises group membership',()=>{
 assert.match(src,/const identityLinks=\{\.\.\.\(remote\.identityLinks\|\|\{\}\),\.\.\.\(local\.identityLinks\|\|\{\}\)\}/);
 assert.match(src,/members:\[\.\.\.new Set\(\(s\.members\|\|\[\]\)\.map\(canonicalId\)\)\]/);
});
test('a stale placeholder cannot downgrade an already claimed player',()=>{
 assert.match(src,/claimed=\[a,b\]\.find\(p=>p\?\.authUserId&&!p\?\.placeholder&&!p\?\.unclaimed\)/);
 assert.match(src,/membershipStatus:'member'/);
});
test('migration retains permanent identity mappings',()=>{
 assert.match(src,/identityLinks:y\.identityLinks\|\|\{\}/);
});
