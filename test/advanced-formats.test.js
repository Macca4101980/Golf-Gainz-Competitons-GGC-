import test from 'node:test';
import assert from 'node:assert/strict';
import {FORMAT_RULES} from '../src/scoring.js';
import {
 teamPlayingHandicap,matchPlayResult,skinsResult,nassauResult,
 quotaResult,splitSixesResult,sharedBallMatchResult
} from '../src/advancedScoring.js';
import {competitionPairs,isPairCompetition,pairDisplayName,pairForPlayers} from '../src/pairing.js';

const holes=Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1}));
function fixture(format='stableford'){
 const c={id:'c',format,holesMode:'18',handicapAllowance:100,pairs:[],roundGroups:[],courseSnapshot:{name:'QA',tee:{name:'Test',slope:113,rating:72,holes}}};
 const state={players:[{id:'a',name:'Player A',hi:10},{id:'b',name:'Player B',hi:20},{id:'c',name:'Player C',hi:0}],cards:[],courses:[],comps:[c],leagues:[]};
 const card=(playerId,gross,playingHandicap=0)=>state.cards.push({id:'card-'+playerId,compId:c.id,playerId,gross,playingHandicap,courseHandicap:playingHandicap});
 return{c,state,card};
}

test('every newly exposed format has a verified scoring route',()=>{
 for(const format of ['4bbb','aggregate-pairs','foursomes','greensomes','gruesomes','pinehurst','sixes','skins','nassau','matchplay','fourball-match','foursomes-match','quota']){
  assert.equal(FORMAT_RULES[format]?.verified,true,format);
 }
});

test('optional pair names fall back everywhere to Player A + Player B',()=>{
 const{c,state}=fixture('4bbb');c.pairs=[{id:'p',ids:['a','b']}];
 assert.equal(isPairCompetition(c.format),true);
 assert.equal(pairDisplayName(c.pairs[0],state),'Player A + Player B');
 assert.equal(pairForPlayers(c,['b','a']).id,'p');
 c.pairs[0].name='Christmas Crackers';
 assert.equal(pairDisplayName(c.pairs[0],state),'Christmas Crackers');
});

test('on-the-day pairings are derived from the playing group without rewriting competition setup',()=>{
 const{c}=fixture('4bbb-stableford');c.roundGroups=[{id:'fourball',playerIds:['a','b','c','d']}];
 assert.deepEqual(competitionPairs(c).map(pair=>pair.ids),[['a','b'],['c','d']]);
});

test('shared-ball pair handicap formulae follow the configured WHS allowances',()=>{
 const{c,state}=fixture('foursomes');
 assert.equal(teamPlayingHandicap(['a','b'],c,state),15);
 c.format='greensomes';assert.equal(teamPlayingHandicap(['a','b'],c,state),14);
 c.format='gruesomes';assert.equal(teamPlayingHandicap(['a','b'],c,state),14);
 c.format='pinehurst';assert.equal(teamPlayingHandicap(['a','b'],c,state),14);
 c.format='pairs-scramble';assert.equal(teamPlayingHandicap(['a','b'],c,state),7);
});

test('singles matchplay stops when the lead exceeds holes remaining',()=>{
 const{c,state,card}=fixture('matchplay');card('a',[...Array(10).fill(3),...Array(8).fill('')]);card('b',[...Array(10).fill(4),...Array(8).fill('')]);
 const result=matchPlayResult(c,state);
 assert.deepEqual({winner:result.winner,played:result.played,remaining:result.remaining,label:result.label},{winner:0,played:10,remaining:8,label:'10 & 8'});
});

test('skins carry on a tied hole and are awarded to the next unique winner',()=>{
 const{c,state,card}=fixture('skins');card('a',[3,4,3]);card('b',[4,4,4]);
 const result=skinsResult(c,state);
 assert.equal(result.rows.find(r=>r.player.id==='a').skins,3);
 assert.equal(result.carry,0);
});

test('Nassau scores front, back and overall without stopping at an early lead',()=>{
 const{c,state,card}=fixture('nassau');card('a',[...Array(9).fill(3),...Array(9).fill(4)]);card('b',[...Array(9).fill(4),...Array(9).fill(3)]);
 const result=nassauResult(c,state);
 assert.deepEqual([result.front.winner,result.back.winner,result.overall.winner],[0,1,null]);
 assert.equal(result.played,18);
});

test('Quota uses gross bogey/par/birdie values against 36 minus Course Handicap',()=>{
 const{c,state,card}=fixture('quota');state.players.find(p=>p.id==='c').hi=0;card('c',[4,3,5]);
 const result=quotaResult(state.cards[0],c,state);
 assert.deepEqual({points:result.quotaPoints,quota:result.quota,rank:result.rankValue},{points:7,quota:36,rank:-29});
});

test('Split Sixes applies 4-2-0 and fair tie splits',()=>{
 const{c,state,card}=fixture('sixes');card('a',[3,4,3]);card('b',[4,4,4]);card('c',[5,5,4]);
 const result=splitSixesResult(c,state);
 assert.deepEqual(Object.fromEntries(result.rows.map(r=>[r.player.id,r.points])),{a:11,b:6,c:1});
});

test('Foursomes match compares two shared-ball pair cards',()=>{
 const{c,state}=fixture('foursomes-match');
 c.roundGroups=[
  {id:'ab',playerIds:['a','b'],teamPlayingHandicap:0,teamGross:[...Array(10).fill(3),...Array(8).fill('')]},
  {id:'cd',playerIds:['c','d'],teamPlayingHandicap:0,teamGross:[...Array(10).fill(4),...Array(8).fill('')]}
 ];
 state.players.push({id:'d',name:'Player D',hi:0});
 const result=sharedBallMatchResult(c,state);
 assert.deepEqual({winner:result.winner,played:result.played,complete:result.complete},{winner:0,played:10,complete:true});
});
