import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eclecticBestGross,
  eclecticRoundComplete,
  eclecticRoundNumber,
  eclecticRoundsRemaining,
  submitEclecticRound,
} from '../src/eclectic.js';
import {formatInformation} from '../src/formatInformation.js';
import {FORMAT_RULES,scoreCard} from '../src/scoring.js';

const holes=Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1}));
const course={id:'course',tees:[{name:'Green',rating:72,slope:113,holes}]};
const competition={id:'eclectic',format:'eclectic',course:'course',tee:'Green',holesMode:'18',eclecticRounds:3,eclecticScoring:'gross'};
const complete=Array(18).fill(5);

test('Eclectic submits each round separately and preserves the earlier cards',()=>{
 const card={id:'card',compId:'eclectic',playerId:'p',gross:[...complete],playingHandicap:10};
 assert.equal(eclecticRoundComplete(card,holes.map((_,i)=>i)),true);
 const afterOne=submitEclecticRound(card,competition,holes.map((_,i)=>i),{submittedAt:'2026-01-01T00:00:00Z',submittedBy:'p'});
 assert.equal(afterOne.eclecticRounds.length,1);
 assert.equal(afterOne.eclecticRounds[0].gross[0],5);
 assert.deepEqual(afterOne.gross,Array(18).fill(''));
 assert.equal(afterOne.submitted,false);
 assert.equal(eclecticRoundNumber(afterOne),2);
 assert.equal(eclecticRoundsRemaining(afterOne,competition),2);
});

test('Eclectic best card includes completed rounds and the active round',()=>{
 const card={eclecticRounds:[{round:1,gross:[5,4,6]},{round:2,gross:[4,5,5]}],gross:[6,3,'']};
 assert.deepEqual(eclecticBestGross(card,3),[4,3,5]);
});

test('final Eclectic submission marks only the completed series submitted',()=>{
 const card={id:'card',gross:[...complete],eclecticRounds:[{gross:[...complete]},{gross:[...complete]}]};
 const final=submitEclecticRound(card,competition,holes.map((_,i)=>i),{submittedAt:'2026-01-03T00:00:00Z'});
 assert.equal(final.eclecticRounds.length,3);
 assert.equal(final.submitted,true);
 assert.equal(final.submittedAt,'2026-01-03T00:00:00Z');
});

test('live Eclectic leaderboard uses the current round when it improves a hole',()=>{
 const card={id:'card',compId:'eclectic',playerId:'p',gross:[4,...Array(17).fill('')],eclecticRounds:[{gross:[5,...Array(17).fill(6)]}],playingHandicap:0};
 const state={players:[{id:'p',name:'Player',hi:0}],courses:[course],cards:[card]};
 const result=scoreCard(card,competition,state);
 assert.equal(result.holes[0].gross,4);
 assert.equal(result.gross,4+(17*6));
});

test('format information always exposes the same five information categories',()=>{
 const info=formatInformation('scramble',FORMAT_RULES.scramble,'Texas Scramble',100);
 assert.deepEqual(Object.keys(info).slice(0,6),['title','participants','howItWorks','scoreEntry','handicap','winner']);
 assert.match(info.handicap,/25%\/20%\/15%\/10%/);
 assert.match(info.note,/All golfers tee off/);
});

test('plain 4BBB remains supported as a legacy Stableford alias',()=>{
 assert.equal(FORMAT_RULES['4bbb'].verified,true);
 assert.equal(FORMAT_RULES['4bbb'].result,FORMAT_RULES['4bbb-stableford'].result);
});
