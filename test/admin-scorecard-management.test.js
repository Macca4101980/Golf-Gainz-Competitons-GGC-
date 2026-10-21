import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';

const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const access=fs.readFileSync(new URL('../supabase/migrations/20261019154508_add_ggc_app_fields.sql',import.meta.url),'utf8');

test('Group Owner or Admin receives the scorecard administration list',()=>{
 assert.match(main,/const admin=!!me&&\(society\?\.ownerId===me\.id\|\|\(society\?\.admins\|\|\[\]\)\.includes\(me\.id\)\)/);
 for(const label of['SCORECARD ADMIN','OPEN','DELETE','CREATE NEW SCORECARD','SCORECARD LIST'])assert.ok(main.includes(label));
 assert.match(css,/\.adminRoundRow/);
 assert.match(main,/\(live\|\|admin\)&&<button className="primary" onClick=\{enter\}>/);
 assert.match(main,/effectiveCompStatus\(c\)!=='live'&&!admin/);
});

test('admin-created card defaults to the acting golfer but all four slots remain selectable',()=>{
 assert.match(main,/setGroupIds\(\[me\.id\]\);setSetup\(true\)/);
 assert.match(main,/\[0,1,2,3\]\.map\(i=><label key=\{i\}>Golfer \{i\+1\}<select/);
});

test('admin deletion is confirmed, audited and removes only the selected competition cards',()=>{
 assert.match(main,/Delete the scorecard for \$\{names\}\?/);
 assert.match(main,/action:'ADMIN DELETE SCORECARD'/);
 assert.match(main,/card\.compId===c\.id&&ids\.has\(card\.playerId\)/);
 assert.match(main,/roundGroups:\(q\.roundGroups\|\|\[\]\)\.filter\(g=>g\.id!==row\.id\)/);
});

test('opening Scorecard Admin does not silently enter the Admin into the competition',()=>{
 assert.match(main,/if\(!admin\)setState\(x=>/);
 assert.match(main,/live\?\(invited\?'ACCEPT INVITE & ENTER':'ENTER \/ CONTINUE ROUND'\):'SCORECARD ADMIN'/);
});

test('Supabase card write access explicitly includes society Admins and Owners',()=>{
 assert.match(access,/if p_kind='cards' then/);
 assert.match(access,/if p_write then return admin or/);
 assert.match(access,/society->>'ownerId'=uid or society->>'ownerId'=any\(myplayerids\)/);
});
