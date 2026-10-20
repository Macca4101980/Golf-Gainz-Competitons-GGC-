import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreCard,pairScore,isNoReturnScore,displayGrossScore,normaliseGrossScore} from '../src/scoring.js';
import {winterLeagueTable} from '../src/winterLeague.js';

const holes=Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1}));
const state=()=>({
 players:[{id:'a',hi:0},{id:'b',hi:0}],
 courses:[{id:'course',tees:[{name:'Green',rating:72,slope:113,holes}]}],
 cards:[],
 comps:[],
});
const competition={id:'w1',leagueId:'league',course:'course',tee:'Green',format:'stableford',status:'live',starts:'2026-11-01T08:00:00Z'};
const card=(id,gross)=>({id:'card-'+id,playerId:id,compId:'w1',gross,courseId:'course',tee:'Green'});
const pars=()=>Array(18).fill(4);

test('explicit zero shows N/R, while blank is an unplayed hole',()=>{
 assert.equal(isNoReturnScore(0),true);
 assert.equal(isNoReturnScore('0'),true);
 assert.equal(isNoReturnScore(''),false);
 assert.equal(isNoReturnScore(null),false);
 assert.equal(displayGrossScore('0'),'N/R');
 assert.equal(displayGrossScore(0),'N/R');
 assert.equal(displayGrossScore(''),'');
 assert.equal(displayGrossScore('5'),'5');
 assert.equal(normaliseGrossScore('N/R'),'0');
 assert.equal(normaliseGrossScore('0'),'0');
 assert.equal(normaliseGrossScore(''),'');
});

test('N/R awards zero Stableford points for one hole without wiping other holes',()=>{
 const s=state(),gross=pars();gross[6]='0';
 const r=scoreCard(card('a',gross),competition,s);
 assert.equal(r.holes[6].noReturn,true);
 assert.equal(r.holes[6].points,0);
 assert.equal(r.holes[5].points,2);
 assert.equal(r.holes[7].points,2);
 assert.equal(r.points,34);
 assert.equal(r.complete,18,'an explicit N/R counts as a recorded hole');
 assert.equal(gross[6],'0','scoring does not rewrite saved scores');
 const unplayed=pars();unplayed[6]='';
 assert.equal(scoreCard(card('a',unplayed),competition,s).complete,17);
 assert.equal(scoreCard(card('a',pars()),competition,s).points,36);
});

test('4BBB takes partner valid score when one golfer records N/R',()=>{
 const s=state(),a=pars(),b=pars();a[0]='0';s.cards=[card('a',a),card('b',b)];
 const r=pairScore({ids:['a','b']},{...competition,format:'4bbb-stableford'},s);
 assert.equal(r.points,36);
 assert.equal(r.holes[0].value,2);
 assert.equal(r.complete,18);
 assert.equal(s.cards[0].gross[0],'0');
 assert.equal(s.cards[1].gross[0],4);
});

test('4BBB with both N/R records the hole at zero points without resetting other holes',()=>{
 const s=state(),a=pars(),b=pars();a[0]=0;b[0]='0';s.cards=[card('a',a),card('b',b)];
 const r=pairScore({ids:['a','b']},{...competition,format:'4bbb-stableford'},s);
 assert.equal(r.holes[0].value,0);
 assert.equal(r.points,34);
 assert.equal(r.complete,18);
});

test('Winter League keeps N/R in hole completion while preserving the partner score',()=>{
 const s=state(),a=pars(),b=pars();a[0]='0';s.cards=[card('a',a),card('b',b)];s.comps=[{...competition}];
 const league={id:'league',teams:[{id:'team',name:'Team',memberIds:['a','b']}],handicapSettings:{mode:'fixed',allowance:90}};
 const r=winterLeagueTable(league,s).weekly[0].rows[0];
 assert.equal(r.points,36);
 assert.equal(r.complete,18);
 assert.equal(r.holes[0],2);
 b[0]='0';
 const both=winterLeagueTable(league,s).weekly[0].rows[0];
 assert.equal(both.holes[0],0);
 assert.equal(both.complete,18);
 assert.equal(both.points,34);
});
