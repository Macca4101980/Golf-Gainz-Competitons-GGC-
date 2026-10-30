import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreCard,pairScore} from '../src/scoring.js';
import {groupScore} from '../src/groupScoring.js';
import {winterLeagueTable} from '../src/winterLeague.js';

const holes=Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1}));
const course={id:'qa-course',tees:[{name:'Green',rating:72,slope:113,holes}]};
const players=[{id:'a',name:'A',hi:10},{id:'b',name:'B',hi:0}];
const base={id:'qa-comp',course:course.id,tee:'Green',format:'stableford',handicapAllowance:100,holesMode:'18'};
const card=(gross,playerId='a')=>({id:playerId,playerId,compId:base.id,gross,playingHandicap:playerId==='a'?10:0});
const state=cards=>({players,courses:[course],cards});

test('entered 4 / N/R / 5 counts three holes, preserves five points and excludes blank holes',()=>{
 const c=card([4,0,5,'',null,undefined]);const r=scoreCard(c,base,state([c]));
 assert.equal(r.complete,3);assert.equal(r.points,5);
 assert.deepEqual(r.holes.slice(0,6).map(h=>h.entered),[true,true,true,false,false,false]);
 assert.equal(r.holes[1].noReturn,true);assert.equal(r.holes[1].points,0);
});

test('all eighteen Stableford N/R holes are entered with zero points',()=>{
 const c=card(Array(18).fill(0));const r=scoreCard(c,base,state([c]));
 assert.equal(r.complete,18);assert.equal(r.points,0);assert.equal(r.noReturn,false);
});

test('front/back-nine counters exclude N/R outside the selected nine',()=>{
 const c=card(Array(18).fill(0));const s=state([c]);
 for(const holesMode of ['front9','back9'])assert.equal(scoreCard(c,{...base,holesMode},s).complete,9);
});

test('entered N/R does not make a Medal card valid',()=>{
 const c=card([4,'0',5]);
 for(const format of ['stroke','gross-stroke']){const r=scoreCard(c,{...base,format},state([c]));assert.equal(r.complete,3);assert.equal(r.noReturn,true);assert.equal(r.rankValue,Infinity);}
});

test('Better Ball all-N/R hole counts once with zero points, unplayed hole stays absent',()=>{
 const cards=[card([0,4]),card([0,5],'b')],r=pairScore({ids:['a','b']},{...base,format:'4bbb-stableford'},state(cards));
 assert.equal(r.complete,2);assert.equal(r.holes[0].value,0);assert.equal(r.holes[2],null);assert.equal(r.points,3);
});

test('solo Better Ball retains entered N/R without inventing a partner card',()=>{
 const cards=[card([4,0,5])],s=state(cards),before=JSON.stringify(s);
 const r=pairScore({ids:['a','b']},{...base,format:'4bbb-stableford'},s);
 assert.equal(r.complete,3);assert.equal(r.points,5);assert.equal(JSON.stringify(s),before);
});

for(const format of ['best1','best2','best3','cha-cha-cha','irish-fourball','bowmaker','alliance','yellow-ball','shamble'])test(`${format} counts an entered N/R hole but leaves blanks unplayed`,()=>{
 const cards=[card([0]),card([0],'b')];const r=groupScore({playerIds:['a','b']},{...base,format},state(cards));
 assert.equal(r.complete,1);assert.equal(r.points,0);
});

test('Winter League solo N/R is a zero-point played hole, preserving team total and partner absence',()=>{
 const c={...base,leagueId:'qa-league',starts:'2026-01-01',ends:'2026-01-08',status:'completed'};
 const league={id:'qa-league',teams:[{id:'team',name:'Team',memberIds:['a','b']}],handicapSettings:{mode:'fixed',allowance:100,lockStartingHandicaps:false},oomSettings:{bestCount:0}};
 const cards=[card([4,0,5])],s={...state(cards),comps:[c]},r=winterLeagueTable(league,s).weekly[0].rows[0];
 assert.equal(r.complete,3);assert.equal(r.points,5);assert.equal(r.playersPlayed,1);assert.deepEqual(r.holes.slice(0,4),[3,0,2,null]);assert.equal(s.cards.length,1);
});


test('Eclectic blank holes remain unplayed and a valid round overrides an N/R',()=>{
 const c={...card([]),eclecticRounds:[{gross:[0,4]},{gross:[5,'']}]};
 const r=scoreCard(c,{...base,format:'eclectic'},state([c]));
 assert.equal(r.complete,2);assert.equal(r.holes[0].gross,5);assert.equal(r.holes[2].entered,false);
});
