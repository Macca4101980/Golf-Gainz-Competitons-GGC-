import test from 'node:test';
import assert from 'node:assert/strict';
import {activePairField,cardHasPlayerActivity,finaliseScorecard,pairHasPlayerActivity,visibleHoleTarget} from '../src/competitionFinalisation.js';

const comp={id:'c',format:'stableford',holesMode:'18'};
const blank=()=>({id:'card',compId:'c',playerId:'a',gross:Array(18).fill(''),submitted:false});

test('untouched cards remain blank and do not become entrants at competition close',()=>{
 const card=blank(),closed=finaliseScorecard(card,comp,{at:'2026-11-24T17:00:00Z'});
 assert.equal(closed,card);
 assert.equal(cardHasPlayerActivity(closed,comp),false);
});

test('started cards are completed with traceable generated N/R holes',()=>{
 const card=blank();card.gross[3]=5;
 const closed=finaliseScorecard(card,comp,{at:'2026-11-24T17:00:00Z'});
 assert.equal(closed.gross[3],5);
 assert.equal(closed.gross[0],0);
 assert.equal(closed.generatedNoReturnHoles.length,17);
 assert.equal(closed.submitted,true);
 assert.equal(cardHasPlayerActivity(closed,comp),true);
});

test('a card containing only generated N/Rs is never treated as player activity',()=>{
 const card=blank();card.gross.fill(0);card.generatedNoReturnHoles=Array.from({length:18},(_,i)=>i);
 assert.equal(cardHasPlayerActivity(card,comp),false);
});

test('one active partner makes the registered pair active',()=>{
 const a=blank(),b={...blank(),id:'b',playerId:'b'};b.gross[8]=4;
 const state={cards:[a,b]};
 assert.equal(pairHasPlayerActivity({ids:['a','b']},comp,state),true);
 assert.equal(pairHasPlayerActivity({ids:['a','z']},comp,state),false);
});

test('OOM field counts both registered partners when either partner competes',()=>{
 const pairs=[{id:'p1',ids:['a','b']},{id:'p2',ids:['c','d']}];
 const a=blank(),c={...blank(),id:'c-card',playerId:'c'};a.gross[0]=5;
 const field=activePairField(pairs,comp,{cards:[a,c]});
 assert.deepEqual(field.activePairs.map(pair=>pair.id),['p1']);
 assert.deepEqual(field.playerIds.sort(),['a','b']);
});

test('provisional target reflects the visible scoring window',()=>{
 assert.equal(visibleHoleTarget(comp,{embargoActive:true,visibleThrough:15}),15);
 assert.equal(visibleHoleTarget(comp,{embargoActive:false}),18);
 assert.equal(visibleHoleTarget({...comp,holesMode:'front9'},{embargoActive:true}),9);
});
