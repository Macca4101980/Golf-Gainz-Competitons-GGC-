import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRoundTotals} from '../src/roundTotals.js';

function fixture(format='stableford'){
 const holes=Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1}));
 const c={id:'comp',format,holesMode:'18',handicapAllowance:100,courseSnapshot:{name:'QA',tee:{name:'Green',slope:113,rating:72,holes}}};
 const state={players:['a','b','c','d'].map(id=>({id,name:id.toUpperCase(),hi:0})),comps:[c],leagues:[],courses:[],cards:[]};
 const add=(id,gross,extra={})=>state.cards.push({id:'card-'+id,compId:c.id,playerId:id,playingHandicap:0,gross,...extra});
 return {c,state,add};
}
test('column totals keep first 15 distinct from 18 and count N/R as entered, without mutating cards',()=>{
 const {c,state,add}=fixture();add('a',[...Array(14).fill(4),0,3,5,4]);
 const before=JSON.stringify(state),result=buildRoundTotals(c,state,['a','b']);
 assert.deepEqual(result.individuals[0].scores.map(({text,entered,total})=>({text,entered,total})),[
  {text:'28 pts',entered:15,total:15},{text:'34 pts',entered:18,total:18}]);
 assert.deepEqual(result.individuals[1].scores.map(s=>s.text),['—','—']);
 assert.equal(JSON.stringify(state),before);
});
test('provisional window uses hole positions, never replaces N/R with holes 16–18',()=>{
 const {c,state,add}=fixture();c.resultsEmbargo={visibleThroughHole:15};add('a',[0,...Array(14).fill(4),1,1,1]);
 const result=buildRoundTotals(c,state,['a']);
 assert.equal(result.individuals[0].scores[0].text,'28 pts');
 assert.equal(result.individuals[0].scores[1].text,'43 pts');
});
test('in-progress cards show only entered holes and do not invent totals for blank cards',()=>{
 const {c,state,add}=fixture();add('a',[4,'',0]);add('b',Array(18).fill(''));
 const result=buildRoundTotals(c,state,['a','b']);
 assert.equal(result.individuals[0].scores[1].text,'2 pts');
 assert.equal(result.individuals[0].scores[1].entered,2);
 assert.equal(result.individuals[1].scores[1].text,'—');
});
test('nett Medal and gross Medal use strokes, while N/R voids the affected total',()=>{
 const {c,state,add}=fixture('stroke');add('a',[...Array(15).fill(4),0,4,4],{playingHandicap:18});
 const result=buildRoundTotals(c,state,['a']);
 assert.equal(result.individuals[0].scores[0].text,'45 net');
 assert.equal(result.individuals[0].scores[1].text,'N/R');
 c.format='gross-stroke';state.cards[0].playingHandicap=0;
 assert.equal(buildRoundTotals(c,state,['a']).individuals[0].scores[0].text,'60 gross');
});
test('par/bogey and modified Stableford display their actual format results, including N/R',()=>{
 const {c,state,add}=fixture('par-bogey');add('a',[3,5,4,0]);
 assert.equal(buildRoundTotals(c,state,['a']).individuals[0].scores[1].text,'-1');
 c.format='modified-stableford';
 assert.equal(buildRoundTotals(c,state,['a']).individuals[0].scores[1].text,'-2 pts');
 c.format='waltz';state.cards[0].gross=[4,4,4];
 assert.equal(buildRoundTotals(c,state,['a']).individuals[0].scores[1].text,'12 pts');
});
test('nine-hole competitions total only their selected side and have no 15-hole row',()=>{
 const {c,state,add}=fixture();add('a',[...Array(9).fill(3),...Array(9).fill(5)]);
 c.holesMode='back9';let result=buildRoundTotals(c,state,['a']);
 assert.equal(result.windows.length,1);assert.equal(result.individuals[0].scores[0].text,'9 pts');
 c.holesMode='front9';result=buildRoundTotals(c,state,['a']);
 assert.equal(result.windows.length,1);assert.equal(result.individuals[0].scores[0].text,'27 pts');
});
test('Better Ball combines each hole and aggregate adds both players rather than taking the best card',()=>{
 const {c,state,add}=fixture('4bbb-stableford');c.pairs=[{id:'ab',ids:['a','b']}];
 add('a',Array.from({length:18},(_,i)=>i%2?5:3));add('b',Array.from({length:18},(_,i)=>i%2?3:5));
 let result=buildRoundTotals(c,state,['a','b']);
 assert.deepEqual(result.teams[0].scores.map(s=>s.text),['45 pts','54 pts']);
 assert.deepEqual(result.individuals.map(p=>p.scores[1].text),['36 pts','36 pts']);
 c.format='aggregate-stableford';result=buildRoundTotals(c,state,['a','b']);
 assert.equal(result.teams[0].scores[1].text,'72 pts');
});
test('League teams stay fixed even when playing group columns contain different partners',()=>{
 const {c,state,add}=fixture('4bbb-stableford');c.leagueId='league';
 state.leagues=[{id:'league',teams:[{id:'ac',name:'Team AC',memberIds:['a','c']},{id:'bd',name:'Team BD',memberIds:['b','d']}],handicapSettings:{allowance:90,mode:'fixed'}}];
 c.pairs=[{id:'wrong',ids:['a','b']}];
 add('a',Array(18).fill(4));add('b',Array(18).fill(5));add('c',Array(18).fill(3));
 const before=JSON.stringify(state),result=buildRoundTotals(c,state,['a','b']);
 assert.deepEqual(result.teams.map(t=>[t.id,t.scores[1].text]),[['ac','54 pts'],['bd','18 pts']]);
 assert.equal(result.teams[0].memberLine,'A & C');assert.equal(JSON.stringify(state),before);
});
test('League individual and team totals use the current week cut instead of stale saved handicaps',()=>{
 const {c,state,add}=fixture();c.leagueId='league';c.starts='2026-11-02';
 const first={...c,id:'previous',starts:'2026-11-01',historicalTeamScores:{ab:40}};state.comps=[first,c];
 state.leagues=[{id:'league',teams:[{id:'ab',memberIds:['a','b']}],handicapSettings:{allowance:90,mode:'team',target:36,cutPerPoint:.5,teamAdjustment:'split'}}];
 add('a',Array(18).fill(4),{playingHandicap:20});
 const result=buildRoundTotals(c,state,['a']);
 assert.equal(result.individuals[0].scores[1].text,'35 pts');
 assert.equal(result.teams[0].scores[1].text,'35 pts');
});
test('pairs Matchplay displays the match result for each team',()=>{
 const {c,state,add}=fixture('4bbb-match');c.pairs=[{id:'ab',ids:['a','b']},{id:'cd',ids:['c','d']}];
 add('a',[3]);add('b',[4]);add('c',[4]);add('d',[5]);
 assert.deepEqual(buildRoundTotals(c,state,['a','b','c','d']).teams.map(t=>t.scores[1].text),['1 up','1 down']);
});
test('maximum score pickups use the configured cap instead of contributing zero nett strokes',()=>{
 const {c,state,add}=fixture('max-score');c.maxScoreMode='fixed';c.maxScore=8;add('a',[4,0]);
 assert.equal(buildRoundTotals(c,state,['a']).individuals[0].scores[1].text,'12 net');
 c.maxScoreMode='net-double-bogey';
 assert.equal(buildRoundTotals(c,state,['a']).individuals[0].scores[1].text,'10 net');
});
test('aggregate totals remain in progress until both partners have entered each hole',()=>{
 const {c,state,add}=fixture('aggregate-stableford');c.pairs=[{id:'ab',ids:['a','b']}];add('a',Array(18).fill(4));
 const result=buildRoundTotals(c,state,['a']);
 assert.equal(result.teams[0].scores[1].text,'36 pts');assert.equal(result.teams[0].scores[1].entered,0);
});
test('individual columns preserve the competition allowance when no handicap was captured on the card',()=>{
 const {c,state,add}=fixture('4bbb-stableford');delete c.handicapAllowance;state.players[0].hi=18;
 add('a',Array(18).fill(4),{playingHandicap:undefined});
 assert.equal(buildRoundTotals(c,state,['a']).individuals[0].scores[1].text,'51 pts');
});
