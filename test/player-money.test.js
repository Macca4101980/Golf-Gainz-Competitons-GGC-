import test from'node:test';
import assert from'node:assert/strict';
import{playerMoneySummaries}from'../src/leagueMoneyLedger.js';

test('a golfer sees the same weekly, season and payment arithmetic as League Money',()=>{
 const league={id:'league',name:'Winter League',societyId:'group',memberIds:['a','b','c','d'],teams:[{id:'ab',name:'A & B',memberIds:['a','b']},{id:'cd',name:'C & D',memberIds:['c','d']}],oomSettings:{bestCount:1},moneySettings:{entryFee:10,twosFee:0,weeklyPrizePerPlayer:5,finalFirst:60,seasonPrizeDestination:'league-table'},moneyPaidIn:{a:true},moneyPaymentsById:{paid:{id:'paid',playerId:'a',amountPence:400,description:'Bank payment'}}};
 const state={players:['a','b','c','d'].map(id=>({id,name:id.toUpperCase(),hi:10})),leagues:[league],cards:[],courses:[],comps:[{id:'week',leagueId:'league',societyId:'group',name:'Week 1',status:'completed',starts:'2026-11-01T08:00:00Z',ends:'2026-11-01T16:00:00Z',historicalTeamScores:{ab:40,cd:30}}]};
 const [row]=playerMoneySummaries(state,'a',Date.parse('2026-11-24T12:00:00Z'));
 assert.equal(row.entryPaid,true);
 assert.equal(row.entryDuePence,1000);
 assert.equal(row.earnedPence,1400);
 assert.equal(row.paidPence,400);
 assert.equal(row.owedPence,1000);
 assert.deepEqual(row.prizes.map(prize=>[prize.reason,prize.amountPence]),[['Week 1 winner',500],['League 1st',900]]);
 assert.deepEqual(row.prizes.map(prize=>[prize.displayPaidPence,prize.owedPence]),[[400,100],[0,900]]);
});
