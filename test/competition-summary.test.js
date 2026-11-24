import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{competitionSetupDetails,competitionSetupSummary}from'../src/competitionSummary.js';

test('League information export contains rules, handicaps, money, schedule and playoffs',()=>{
 const league={id:'league',name:'Winter League',societyId:'group',memberIds:['a','b'],teams:[{id:'ab',name:'Team AB',memberIds:['a','b'],shareTwos:true}],oomSettings:{bestCount:8},handicapSettings:{allowance:90,lockStartingHandicaps:true,mode:'team',direction:'down',netParTarget:0,cutPerPoint:.5},moneySettings:{entryFee:12,twosFee:8,weeklyPrizePerPlayer:10,finalFirst:60,seasonPrizeDestination:'playoff',playoffFinalFirst:60}};
 const playoff={id:'playoff',recordType:'matchplay-series',sourceLeagueId:'league',societyId:'group',name:'Winter Knockouts',structure:'playoff'};
 const state={societies:[{id:'group',name:'Golf Group'}],players:[{id:'a',name:'Alice'},{id:'b',name:'Bob'}],leagues:[league,playoff],comps:[{id:'week',leagueId:'league',name:'Week 1',format:'stableford',starts:'2026-10-16T08:00:00Z',ends:'2026-10-23T18:00:00Z'}]};
 const summary=competitionSetupSummary(league,state);
 for(const text of['HANDICAPS','Starting allowance: 90%','MONEY','2s contribution per player: £8.00','TEAMS','COMPETITION SCHEDULE','LINKED MATCHPLAY / PLAYOFFS','Winter Knockouts'])assert.match(summary,new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 for(const text of['2S FUND — KEPT SEPARATE','rolls into the next completed week','Rounds: 2','Semi-final → Final'])assert.match(summary,new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
 const details=competitionSetupDetails(league,state),schedule=details.sections.find(section=>section.title==='Weekly competition schedule');
 assert.equal(schedule.cards[0].title,'Week 1 · Week 1');
 assert.deepEqual(schedule.cards[0].rows.map(row=>row.label),['Format','Opens','Closes','Provisional scores','Full scores']);
});

test('update composer uses aligned full-width auto-growing text areas',()=>{
 const component=readFileSync(new URL('../src/GroupUpdates.jsx',import.meta.url),'utf8'),css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(component,/className="updateDetailsField"/);
 assert.match(component,/onInput=\{grow\}/);
 assert.match(css,/\.updateDetailsField\{[^}]*width:100%/);
});
