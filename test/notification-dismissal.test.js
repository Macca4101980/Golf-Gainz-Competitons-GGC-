import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clearLauncherBadge,swipeRevealsDelete} from '../src/notificationBadges.js';
test('opening clears the launcher and delivered system notifications, without changing in-app unread state',async()=>{
 let badges=0,closed=0;
 await clearLauncherBadge({clearAppBadge:async()=>badges++,serviceWorker:{getRegistration:async()=>({getNotifications:async()=>[{close:()=>closed++},{close:()=>closed++}]})}});
 assert.equal(badges,1);assert.equal(closed,2);
 let count=-1;await clearLauncherBadge({setAppBadge:async n=>count=n});assert.equal(count,0);
 await clearLauncherBadge({clearAppBadge:async()=>{throw Error('unsupported')}});
});
test('only deliberate horizontal left swipes reveal deletion',()=>{
 assert.equal(swipeRevealsDelete(-80,10),true);assert.equal(swipeRevealsDelete(-80,100),false);assert.equal(swipeRevealsDelete(80,10),false);assert.equal(swipeRevealsDelete(-15,0),false);
});
test('personal deletion persists in the read marker, never deletes group updates',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261126120807_personal_group_update_dismissal.sql',import.meta.url),'utf8');
 assert.match(sql,/actor:=private\.ggc_current_player_id/);assert.match(sql,/on conflict\(update_id,player_id\) do update set dismissed_at/);
 assert.match(sql,/r\.player_id=private\.ggc_current_player_id\(\)/);assert.doesNotMatch(sql,/delete from public\.ggc_group_updates/i);
});
