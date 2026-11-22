import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const app=readFileSync(new URL('../src/GroupUpdates.jsx',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261122210000_group_updates_polls.sql',import.meta.url),'utf8');

test('only Group owners and admins can publish updates',()=>{
 assert.match(sql,/m\.role in \('owner','admin'\)/);
 assert.match(sql,/not private\.ggc_updates_group_admin\(p_group_id\).*GGC_GROUP_ADMIN_REQUIRED/s);
 assert.match(main,/updateAdminGroups=myGroups\.filter\(s=>adminGroupIds\.has\(s\.id\)\)/);
});

test('members can read and vote without direct table access',()=>{
 assert.match(sql,/private\.ggc_updates_group_member\(u\.group_id\)/);
 assert.match(sql,/revoke all on public\.ggc_group_updates,public\.ggc_group_update_votes,public\.ggc_group_update_reads from anon,authenticated/);
 assert.match(sql,/grant execute on function public\.ggc_group_updates_feed\(\).*to authenticated/);
 assert.match(app,/ggc_vote_group_poll/);
});

test('unread updates drive both navigation and installed app badges',()=>{
 assert.match(app,/navigator\.setAppBadge\(unread\)/);
 assert.match(app,/navigator\.clearAppBadge\(\)/);
 assert.match(main,/groupUpdates\.unread>0/);
});
