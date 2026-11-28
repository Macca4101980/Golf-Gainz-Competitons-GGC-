import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{roundStartAudience}from'../src/roundStartNotifications.js';

test('round-start notifications default to admins and can be widened to the group',()=>{
 assert.equal(roundStartAudience({}),'admins');
 assert.equal(roundStartAudience({roundStartNotificationAudience:'admins'}),'admins');
 assert.equal(roundStartAudience({roundStartNotificationAudience:'group'}),'group');
 assert.equal(roundStartAudience({roundStartNotificationAudience:'unexpected'}),'admins');
});

test('round starts publish only through the validated server RPC',()=>{
 const helper=readFileSync(new URL('../src/roundStartNotifications.js',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 const group=readFileSync(new URL('../src/GroupScoreScreen.jsx',import.meta.url),'utf8');
 assert.match(helper,/ggc_publish_round_started_update/);
 assert.match(main,/publishRoundStarted/);
 assert.match(group,/publishRoundStarted/);
 assert.match(main,/tab!=='updates'.*clearLauncherBadge.*groupUpdates\.clearAll/s);
 assert.match(readFileSync(new URL('../src/GroupUpdates.jsx',import.meta.url),'utf8'),/Admins only[\s\S]*Everyone in Group/);
});
