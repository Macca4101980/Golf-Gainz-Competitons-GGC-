import test from 'node:test';
import assert from 'node:assert/strict';
import {FORMAT_RULES,pairScore} from '../src/scoring.js';
import {buildRoundTotals} from '../src/roundTotals.js';

function fixture(holesMode='18'){
 const holes=Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1}));
 const c={id:'multiplier',format:'multiplier-stableford',holesMode,handicapAllowance:100,pairs:[{id:'ab',ids:['a','b']}],courseSnapshot:{name:'QA',tee:{name:'Green',slope:113,rating:72,holes}}};
 const state={players:[{id:'a',name:'A',hi:0},{id:'b',name:'B',hi:0}],cards:[],courses:[],comps:[c],leagues:[]};
 const add=(playerId,gross)=>state.cards.push({id:`card-${playerId}`,compId:c.id,playerId,playingHandicap:0,gross});
 return {c,state,add};
}

test('Pairs Multiplier Stableford is an enabled pairs format with a 95% default allowance',()=>{
 assert.deepEqual(FORMAT_RULES['multiplier-stableford'],{
  verified:true,category:'pairs',defaultAllowance:95,lowerWins:false,
  description:'Both partners play their own ball. Their Stableford points are multiplied together on every hole.',
  entry:'Each partner enters their own gross score. Both scores must be entered before the team hole is complete.',
  result:'The partners’ points are multiplied hole by hole; if either scores zero, the team scores zero. Highest total wins.'
 });
});

test('multiplies partners’ Stableford points hole by hole and zero from either golfer makes zero',()=>{
 const {c,state,add}=fixture();add('a',[4,3,0]);add('b',[3,4,3]);
 const result=pairScore(c.pairs[0],c,state);
 assert.equal(result.points,12);
 assert.equal(result.rankValue,12);
 assert.equal(result.complete,3);
 assert.deepEqual(result.holes.slice(0,3),[{value:6},{value:6},{value:0}]);
});

test('does not complete or score a team hole until both partners have entered it',()=>{
 const {c,state,add}=fixture();add('a',[3,4]);add('b',[3,'']);
 const result=pairScore(c.pairs[0],c,state);
 assert.equal(result.points,9);
 assert.equal(result.complete,1);
 assert.deepEqual(result.holes.slice(0,2),[{value:9},null]);
 const totals=buildRoundTotals(c,state,['a','b']).teams[0].scores.at(-1);
 assert.deepEqual({text:totals.text,entered:totals.entered,total:totals.total},{text:'9 pts',entered:1,total:18});
});

test('supports Front 9 and Back 9 competitions without counting the inactive nine',()=>{
 const {c,state,add}=fixture('front9');add('a',Array(18).fill(4));add('b',Array(18).fill(4));
 let result=pairScore(c.pairs[0],c,state);
 assert.equal(result.points,36);assert.equal(result.complete,9);
 let total=buildRoundTotals(c,state,['a','b']).teams[0].scores[0];
 assert.deepEqual({text:total.text,entered:total.entered,total:total.total},{text:'36 pts',entered:9,total:9});
 c.holesMode='back9';state.cards.forEach(card=>card.gross=Array(18).fill(3));
 result=pairScore(c.pairs[0],c,state);
 assert.equal(result.points,81);assert.equal(result.complete,9);
 total=buildRoundTotals(c,state,['a','b']).teams[0].scores[0];
 assert.deepEqual({text:total.text,entered:total.entered,total:total.total},{text:'81 pts',entered:9,total:9});
});

test('the production competition menu exposes Pairs Multiplier Stableford',async()=>{
 const source=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../src/main.jsx',import.meta.url),'utf8'));
 assert.match(source,/\['multiplier-stableford','Pairs Multiplier Stableford'/);
});
