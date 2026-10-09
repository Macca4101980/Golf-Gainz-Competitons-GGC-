import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const sql=readFileSync(new URL('../docs/sql/V4_STATE_CAS_CUTOVER_HOLD.sql',import.meta.url),'utf8');
test('V4 app uses only protected cloud state writes',()=>{
 const fn=app.slice(app.indexOf('async function saveCloud('),app.indexOf('\ncreateRoot(',app.indexOf('async function saveCloud(')));
 assert.match(fn,/rpc\/ggc_save_state_cas/);
 assert.doesNotMatch(fn,/method:'PATCH'/);
 assert.doesNotMatch(fn,/resolution=merge-duplicates/);
 assert.doesNotMatch(fn,/VITE_GGC_CAS_WRITES|VITE_GGC_SERVER_CAS/);
});
test('conflict preserves attempted payload in memory and reports failure',()=>{
 assert.match(app,/pendingCloudSave=s/);
 assert.match(app,/Cloud conflict — your changes are retained/);
 assert.match(app,/return false/);
});
test('cutover SQL revokes legacy writes from clients',()=>{
 assert.match(sql,/revoke insert,update,delete on public\.ggc_state from anon,authenticated/i);
});
