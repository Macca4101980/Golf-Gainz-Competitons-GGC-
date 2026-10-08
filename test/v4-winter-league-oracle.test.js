import test from 'node:test';
import assert from 'node:assert/strict';
import {winterLeagueTable,handicapAdjustment,leagueHandicapSettings} from '../src/winterLeague.js';

const holes=Array.from({length:18},(_,i)=>({par:4,si:i+1}));
const base={players:[{id:'a',name:'A',hi:0},{id:'b',name:'B',hi:0}],courses:[{id:'course',tees:[{name:'white',holes,slope:113,rating:72}]}],cards:[],comps:[]};
const league={id:'wl',teams:[{id:'team',name:'Team',memberIds:['a','b']}],startingHandicaps:{a:0,b:0},handicapSettings:{mode:'team',allowance:90,target:36,cutPerPoint:.5,giveBackPerPoint:0,direction:'down',teamAdjustment:'split',bestCount:8}};
const week=(n)=>({id:'week'+n,leagueId:'wl',name:'Week '+n,starts:'2026-10-'+String(n).padStart(2,'0'),course:'course',tee:'white',format:'stableford'});
const card=(id,n,gross)=>({id:id+'-'+n,compId:'week'+n,playerId:id,handicapIndexUsed:0,gross:Array(18).fill(gross)});
test('one teammate playing alone supplies valid weekly Stableford score',()=>{
 const state={...base,comps:[week(1)],cards:[card('a',1,4)]};
 const result=winterLeagueTable(league,state),r=result.table[0].weeks[0];
 assert.equal(r.points,36);assert.equal(r.playersPlayed,1);assert.equal(r.complete,18);
});
test('teammates on different days combine hole-by-hole Better Ball without overwriting cards',()=>{
 const state={...base,comps:[week(1)],cards:[card('a',1,4)]};
 const first=winterLeagueTable(league,state).table[0].weeks[0];
 assert.equal(first.points,36);
 const later={...state,cards:[...state.cards,{...card('b',1,5),gross:[3,...Array(17).fill(5)]}]};
 const combined=winterLeagueTable(league,later).table[0].weeks[0];
 assert.equal(combined.playersPlayed,2);
 assert.equal(combined.points,37);
 assert.equal(later.cards[0].gross[0],4);
 assert.equal(later.cards[1].gross[0],3);
});
test('team cuts apply to both partners starting next week and never recover on poor rounds',()=>{
 const state={...base,comps:[week(1),week(2)],cards:[card('a',1,4),card('a',2,6)]};
 const result=winterLeagueTable(league,state).table[0];
 assert.equal(result.weeks[0].points,36);
 assert.equal(result.weeks[0].afterAdjustments.a,0);
 assert.equal(result.weeks[1].beforeAdjustments.a,0);
 assert.equal(result.finalAdjustments.b,0);
 assert.equal(handicapAdjustment(46,leagueHandicapSettings(league)),-5);
 assert.equal(handicapAdjustment(30,leagueHandicapSettings(league)),0);
});
test('cancelled weeks are excluded from league table and best-X count',()=>{
 const state={...base,comps:[week(1),{...week(2),status:'cancelled'},week(3)],cards:[card('a',1,4),card('a',2,3),card('a',3,5)]};
 const result=winterLeagueTable(league,state);
 assert.deepEqual(result.comps.map(x=>x.id),['week1','week3']);
 assert.equal(result.table[0].played,2);
 assert.equal(result.table[0].total,36+18);
});
test('weekly countback prefers better back nine when totals tie',()=>{
 const comp=week(1),state={...base,players:[...base.players,{id:'c',name:'C',hi:0}],comps:[comp],cards:[
  {...card('a',1,4),gross:[...Array(9).fill(3),...Array(9).fill(5)]},
  {...card('c',1,4),gross:[...Array(9).fill(5),...Array(9).fill(3)]}
 ]};
 const l={...league,teams:[{id:'front',name:'Front',memberIds:['a']},{id:'back',name:'Back',memberIds:['c']}]};
 const rows=winterLeagueTable(l,state).weekly[0].rows;
 assert.equal(rows[0].teamId,'back');
 assert.equal(rows[0].points,36);
});
