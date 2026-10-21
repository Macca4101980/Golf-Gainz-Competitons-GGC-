import test from'node:test';
import assert from'node:assert/strict';
import{formatResult,scoreCard,pairScore}from'../src/scoring.js';
import{decrementHoleScore,displayHoleScore,incrementHoleScore,isNoReturnScore,normaliseHoleScoreInput}from'../src/scoreInput.js';

const holes=Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1}));
const course={id:'course',tees:[{name:'Green',slope:113,rating:72,holes}]};
const players=[{id:'a',name:'A',hi:0},{id:'b',name:'B',hi:0}];
const comp={id:'week',course:'course',tee:'Green',format:'stableford',holesMode:'18',handicapAllowance:100};

test('zero is stored as a hole-level no return and displayed as N/R',()=>{
 assert.equal(normaliseHoleScoreInput('0'),0);
 assert.equal(normaliseHoleScoreInput('N/R'),0);
 assert.equal(displayHoleScore(0),'N/R');
 assert.equal(isNoReturnScore('0'),true);
 assert.equal(decrementHoleScore(1,4),0);
 assert.equal(incrementHoleScore(0,4),1);
});

test('a no-return hole scores zero points without invalidating the rest of a Stableford card',()=>{
 const card={id:'ca',compId:'week',playerId:'a',gross:[0,...Array(17).fill(4)],playingHandicap:0};
 const result=scoreCard(card,comp,{players,courses:[course],cards:[card]});
 assert.equal(result.holes[0].gross,0);
 assert.equal(result.holes[0].points,0);
 assert.equal(result.points,34);
 assert.equal(result.complete,17);
});

test('a partner valid score still counts when the other partner records N/R',()=>{
 const cards=[
  {id:'ca',compId:'week',playerId:'a',gross:[0,...Array(17).fill(4)],playingHandicap:0},
  {id:'cb',compId:'week',playerId:'b',gross:Array(18).fill(4),playingHandicap:0}
 ];
 const result=pairScore({ids:['a','b']},{...comp,format:'4bbb-stableford'},{players,courses:[course],cards});
 assert.equal(result.points,36);
 assert.equal(result.complete,18);
});

test('a zero voids an individual nett Medal card and ranks it below valid cards',()=>{
 const nrCard={id:'ca',compId:'week',playerId:'a',gross:[0,...Array(17).fill(4)],playingHandicap:0};
 const validCard={id:'cb',compId:'week',playerId:'b',gross:Array(18).fill(5),playingHandicap:0};
 const medal={...comp,format:'stroke'};
 const state={players,courses:[course],cards:[nrCard,validCard]};
 const nr=scoreCard(nrCard,medal,state);
 const valid=scoreCard(validCard,medal,state);
 assert.equal(nr.noReturn,true);
 assert.equal(nr.rankValue,Number.POSITIVE_INFINITY);
 assert.equal(formatResult(nr,medal.format),'N/R');
 assert.equal(valid.noReturn,false);
 assert.ok(valid.rankValue<nr.rankValue);
});

test('a zero also voids an individual gross Medal card',()=>{
 const card={id:'ca',compId:'week',playerId:'a',gross:[0,...Array(17).fill(4)],playingHandicap:0};
 const medal={...comp,format:'gross-stroke'};
 const result=scoreCard(card,medal,{players,courses:[course],cards:[card]});
 assert.equal(result.noReturn,true);
 assert.equal(result.rankValue,Number.POSITIVE_INFINITY);
 assert.equal(formatResult(result,medal.format),'N/R');
});
