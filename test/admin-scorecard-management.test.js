import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';

const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const compact=main.replace(/\s+/g,'');
const css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const access=fs.readFileSync(new URL('../supabase/migrations/20261019154508_add_ggc_app_fields.sql',import.meta.url),'utf8');

test('Group Owner or Admin receives the scorecard administration list',()=>{
 assert.match(compact,/constadmin=!!me&&\(society\?\.ownerId===me\.id\|\|\(society\?\.admins\|\|\[\]\)\.includes\(me\.id\)\)/);
 for(const label of['SCORECARD ADMIN','OPEN','DELETE','CREATE NEW SCORECARD','SCORECARD LIST'])assert.ok(main.includes(label));
 assert.match(css,/\.adminRoundRow/);
 assert.match(main,/\(live\|\|\(admin&&status==='completed'\)\)&&<button className="primary" onClick=\{enter\}>/);
 assert.match(compact,/effectiveCompStatus\(c\)!==['"]live['"]&&!admin/);
 assert.match(main,/done\.map\(c=><CompCard[^\n]+enter=\{\(\)=>enter\(c\)\}/);
});

test('admin-created card defaults to the acting golfer but all four slots remain selectable',()=>{
 assert.match(compact,/setGroupIds\(\[me\.id\]\);setSetup\(true\)/);
 assert.match(compact,/\[0,1,2,3\]\.map\(\(i\)=>\(<labelkey=\{i\}>Golfer\{i\+1\}<select/);
});

test('admin deletion is confirmed, audited and removes only the selected competition cards',()=>{
 assert.match(compact,/Deletethescorecardfor\$\{names\}\?/);
 assert.match(compact,/action:['"]ADMINDELETESCORECARD['"]/);
 assert.match(compact,/card\.compId===c\.id&&ids\.has\(card\.playerId\)/);
 assert.match(compact,/roundGroups:\(q\.roundGroups\|\|\[\]\)\.filter\(\(g\)=>g\.id!==row\.id\)/);
 assert.match(compact,/deletedCardIds:\[\.\.\.newSet\(\[\.\.\.\(state\.deletedCardIds\|\|\[\]\),\.\.\.removedCards\.map\(\(card\)=>card\.id\)/);
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
