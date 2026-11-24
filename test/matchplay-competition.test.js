import test from'node:test';
import assert from'node:assert/strict';
import{syncMatchplayCompetitionResult}from'../src/matchplayCompetition.js';
import{buildMatchplayRecord,fixtureCompetitionPreset}from'../src/matchplaySeriesModel.js';
import{competitionHandicapIndex,fourballMatchHandicaps}from'../src/scoring.js';

const holes=Array.from({length:18},(_,index)=>({n:index+1,par:4,si:index+1}));
const courseSnapshot={name:'Test Course',tee:{name:'Test',slope:113,rating:72,holes}};

test('a completed singles scorecard advances its knockout winner',()=>{
 const entrants=[{id:'a',name:'A',memberIds:['a']},{id:'b',name:'B',memberIds:['b']}],record=buildMatchplayRecord({id:'singles',name:'Singles',societyId:'g',entrants,createdAt:'2027-01-01T12:00:00Z'}),preset=fixtureCompetitionPreset(record,record.matchplay.fixtures[0]);
 const comp={id:'comp',...preset,holesMode:'18',courseSnapshot},state={players:[{id:'a',hi:0},{id:'b',hi:0}],cards:[{id:'ca',compId:'comp',playerId:'a',gross:[...Array(10).fill(3),...Array(8).fill(4)]},{id:'cb',compId:'comp',playerId:'b',gross:Array(18).fill(4)}],leagues:[record]};
 const next=syncMatchplayCompetitionResult(state,comp,{completedAt:'2027-01-02T12:00:00Z'}),series=next.leagues[0].matchplay;
 assert.equal(series.fixtures[0].status,'complete');
 assert.equal(series.fixtures[0].winnerId,'a');
 assert.equal(series.championId,'a');
});

test('a completed four-ball scorecard advances the registered pair',()=>{
 const entrants=[{id:'ab',name:'AB',memberIds:['a','b']},{id:'cd',name:'CD',memberIds:['c','d']}],record=buildMatchplayRecord({id:'pairs',name:'Pairs',societyId:'g',entrants,entrantType:'team',createdAt:'2027-01-01T12:00:00Z'}),preset=fixtureCompetitionPreset(record,record.matchplay.fixtures[0]);
 const comp={id:'pair-comp',...preset,holesMode:'18',courseSnapshot},players=['a','b','c','d'].map(id=>({id,hi:0}));
 const cards=players.map(player=>({id:`card-${player.id}`,compId:comp.id,playerId:player.id,gross:Array(18).fill(4)}));cards[0].gross[0]=3;
 const next=syncMatchplayCompetitionResult({players,cards,leagues:[record]},comp),fixture=next.leagues[0].matchplay.fixtures[0];
 assert.equal(fixture.status,'complete');
 assert.equal(fixture.winnerId,'ab');
 assert.equal(fixture.score.holesWonA,1);
});

test('an unfinished linked scorecard does not alter its fixture',()=>{
 const entrants=[{id:'a',name:'A'},{id:'b',name:'B'}],record=buildMatchplayRecord({id:'unfinished',name:'Unfinished',societyId:'g',entrants,createdAt:'2027-01-01T12:00:00Z'}),preset=fixtureCompetitionPreset(record,record.matchplay.fixtures[0]),comp={id:'unfinished-comp',...preset,holesMode:'18',courseSnapshot};
 const state={players:[{id:'a',hi:0},{id:'b',hi:0}],cards:[{compId:comp.id,playerId:'a',gross:[3]},{compId:comp.id,playerId:'b',gross:[4]}],leagues:[record]};
 assert.equal(syncMatchplayCompetitionResult(state,comp),state);
});

test('matchplay scoring reads its saved handicap snapshot instead of later profile changes',()=>{
 const state={players:[{id:'a',hi:2},{id:'b',hi:30},{id:'c',hi:30},{id:'d',hi:30}],courses:[]};
 const comp={handicapAllowance:90,handicapSnapshot:{a:10,b:12,c:18,d:20},courseSnapshot};
 assert.equal(competitionHandicapIndex(comp,state,'a'),10);
 assert.deepEqual(fourballMatchHandicaps({ids:['a','b']},{ids:['c','d']},comp,state),{a:0,b:2,c:7,d:9});
});

test('optional League adjustments are carried into knockout match handicaps',()=>{
 const state={players:[{id:'a',hi:2},{id:'b',hi:30},{id:'c',hi:30},{id:'d',hi:30}],courses:[]};
 const comp={handicapAllowance:90,handicapSnapshot:{a:10,b:12,c:18,d:20},handicapAdjustments:{a:-2,b:-2,c:0,d:0},courseSnapshot};
 assert.deepEqual(fourballMatchHandicaps({ids:['a','b']},{ids:['c','d']},comp,state),{a:0,b:2,c:9,d:11});
});
