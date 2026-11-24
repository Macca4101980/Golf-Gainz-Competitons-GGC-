import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{automaticUpdateEvents}from'../src/automaticUpdates.js';
const sql=readFileSync(new URL('../supabase/migrations/20261122212953_automatic_group_updates.sql',import.meta.url),'utf8');

test('automatic competition events are deduplicated and audience scoped',()=>{
 const now=Date.parse('2026-11-22T12:00:00Z'),comp={id:'c1',societyId:'g1',name:'Saturday Comp',status:'live',starts:'2026-11-22T11:00:00Z',ends:'2026-11-22T12:30:00Z',invites:['p2'],entries:[],format:'stableford'};
 const events=automaticUpdateEvents({comps:[comp],players:[],cards:[],leagues:[]},new Set(['g1']),now);
 assert.deepEqual(events.map(x=>x.eventKey),['comp-live:c1:2026-11-22T11:00:00Z','comp-closing:c1:2026-11-22T12:30:00Z','comp-invite:c1:p2']);
 assert.equal(events.at(-1).audience,'member');assert.equal(events.at(-1).targetPlayerId,'p2');
});

test('old completed competitions do not create a backlog of notifications',()=>{
 const comp={id:'old',societyId:'g1',name:'Old Comp',status:'completed',starts:'2026-01-01T09:00:00Z',ends:'2026-01-01T14:00:00Z',entries:[],format:'stableford'};
 assert.deepEqual(automaticUpdateEvents({comps:[comp],players:[],cards:[],leagues:[]},new Set(['g1']),Date.parse('2026-11-22T12:00:00Z')),[]);
});

test('money changes create private, deduplicated member notifications',()=>{
 const now=Date.parse('2026-11-24T22:00:00Z'),league={id:'league',name:'Winter League',societyId:'g1',memberIds:['p1'],moneyActivity:[{id:'entry',type:'entry-status',playerId:'p1',paid:true,at:'2026-11-24T21:58:00Z'},{id:'payment',type:'payout',playerId:'p1',amountPence:1250,at:'2026-11-24T21:59:00Z'}]};
 const events=automaticUpdateEvents({comps:[],players:[{id:'p1',name:'Player'}],cards:[],leagues:[league]},new Set(['g1']),now);
 assert.deepEqual(events.map(event=>event.eventKey),['money-entry:league:entry','money-payment:league:payment']);
 assert.ok(events.every(event=>event.audience==='member'&&event.targetPlayerId==='p1'));
 assert.match(events[1].body,/£12\.50/);
});

test('database automatic updates support group, admin and private audiences safely',()=>{
 assert.match(sql,/audience in \('group','admins','member'\)/);
 assert.match(sql,/ggc_group_updates_event_key_uidx/);
 assert.match(sql,/ggc_membership_update_event/);
 assert.match(sql,/u\.audience='member' and u\.target_player_id=a\.player_id/);
 assert.match(sql,/u\.audience='admins' and private\.ggc_updates_group_admin/);
 assert.match(sql,/ggc_publish_automatic_update/);
});
