import test from 'node:test';
import assert from 'node:assert/strict';
import {winterLeagueTable} from '../src/winterLeague.js';
import {winterLeagueSeasonFixture} from './fixtures/winter-league-season.js';

const holes=Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1}));
function fixture({hi=0,settings={}}={}){
 const players=['a','b','c','d'].map(id=>({id,name:id,hi}));
 const league={id:'regression-league',teams:[{id:'ab',name:'AB',memberIds:['a','b']},{id:'cd',name:'CD',memberIds:['c','d']}],
  handicapSettings:{allowance:90,mode:'team',target:36,cutPerPoint:.5,direction:'down',teamAdjustment:'split',bestCount:8,...settings}};
 const comps=Array.from({length:10},(_,i)=>({id:'w'+(i+1),name:'Week '+(i+1),leagueId:league.id,course:'course',tee:'Green',format:'stableford',starts:`2026-11-${String(i+1).padStart(2,'0')}T08:00:00Z`,status:'live'}));
 return {league,state:{players,courses:[{id:'course',tees:[{name:'Green',slope:113,rating:72,holes}]}],comps,cards:[]}};
}
const card=(playerId,week,gross,extra={})=>({id:playerId+'-'+week,playerId,compId:week,gross:[...gross],...extra});

test('provisional results restrict holes and withhold official totals and cuts until release',()=>{
 const {league,state}=fixture({hi:10});state.cards=[card('a','w1',Array(18).fill(4))];
 state.comps[0].resultsEmbargo={enabled:true,visibleThroughHole:15,releaseAt:'2999-01-01T00:00:00Z',withholdOom:true};
 const pending=winterLeagueTable(league,state),row=pending.weekly[0].rows[0],team=pending.table.find(t=>t.id==='ab');
 assert.equal(row.provisional,true);assert.equal(row.points,39);assert.equal(row.complete,15);assert.equal(row.cut,0);
 assert.equal(team.total,0);assert.equal(team.played,0);assert.equal(team.finalCut,0);
 state.comps[0].resultsEmbargo.releaseAt='2000-01-01T00:00:00Z';
 const released=winterLeagueTable(league,state),final=released.table.find(t=>t.id==='ab');
 assert.equal(released.weekly[0].rows[0].provisional,false);assert.equal(released.weekly[0].rows[0].points,45);
 assert.equal(final.total,45);assert.equal(final.played,1);assert.equal(final.finalCut,2.25);
 assert.deepEqual(state.cards[0].gross,Array(18).fill(4));
});

test('league uses card course and tee for points and playing handicap',()=>{
 const {league,state}=fixture({hi:10});
 state.courses.unshift({id:'other',tees:[{name:'Yellow',slope:155,rating:80,holes}]});
 state.comps[0]={...state.comps[0],course:'other',tee:'Yellow'};
 state.cards=[card('a','w1',Array(18).fill(4),{courseId:'course',tee:'Green'})];
 const row=winterLeagueTable(league,state).weekly[0].rows[0];
 assert.equal(row.points,45);assert.equal(row.playerResults[0].playingHandicap,9);assert.equal(row.complete,18);
 state.courses.reverse();assert.equal(winterLeagueTable(league,state).weekly[0].rows[0].points,45);
});

test('cancelled weeks preserve scheduled numbers in results and handicap history',()=>{
 const {league,state}=fixture();state.comps[3].status='cancelled';
 state.cards=state.comps.map(c=>card('a',c.id,Array(18).fill(4)));
 const result=winterLeagueTable(league,state);
 assert.deepEqual(result.weekly.map(w=>w.weekNumber),[1,2,3,5,6,7,8,9,10]);
 assert.deepEqual(result.table.find(t=>t.id==='ab').weeks.map(w=>w.weekNumber),[1,2,3,5,6,7,8,9,10]);
 assert.equal(result.weekly.find(w=>w.weekNumber===5).comp.id,'w5');
 assert.equal(result.weekly.at(-1).weekNumber,10);
 assert.equal(result.table.find(t=>t.id==='ab').played,9);
});

test('single golfer produces a valid team week and leaves partner card absent',()=>{
 const {league,state}=fixture({hi:10});state.cards=[card('a','w1',Array(18).fill(4))];
 const before=JSON.stringify(state),result=winterLeagueTable(league,state),week=result.weekly[0].rows[0];
 assert.equal(week.points,45);assert.equal(week.playersPlayed,1);assert.equal(week.complete,18);
 assert.equal(state.cards.some(c=>c.playerId==='b'),false);assert.equal(JSON.stringify(state),before);
});

test('partners playing on different days combine hole-by-hole Better Ball, not whole-card maximum',()=>{
 const {league,state}=fixture();
 state.cards=[card('a','w1',Array.from({length:18},(_,i)=>i%2?5:3),{playedAt:'2026-11-01'}),card('b','w1',Array.from({length:18},(_,i)=>i%2?3:5),{playedAt:'2026-11-03'})];
 const row=winterLeagueTable(league,state).weekly[0].rows[0];
 assert.equal(row.points,54);assert.equal(row.playersPlayed,2);assert.deepEqual(row.holes,Array(18).fill(3));
 assert.equal(state.cards[0].gross[0],3);assert.equal(state.cards[1].gross[0],5);
});

test('90% allowance and team cut carry to future weeks, poor scores give no recovery',()=>{
 const {league,state}=fixture({hi:10});
 state.cards=[card('a','w1',Array(18).fill(4)),card('a','w2',Array(18).fill(6)),card('a','w3',Array(18).fill(4))];
 const table=winterLeagueTable(league,state),team=table.table.find(t=>t.id==='ab');
 assert.equal(team.weeks[0].points,45);
 assert.deepEqual(team.weeks[0].afterAdjustments,{a:-2.25,b:-2.25});
 assert.deepEqual(team.weeks[1].afterAdjustments,{a:-2.25,b:-2.25});
 assert.equal(team.weeks[2].points,43);
 assert.deepEqual(state.players.map(p=>p.hi),[10,10,10,10]);
});

test('cancelled week is excluded from scores and handicap cuts',()=>{
 const {league,state}=fixture();state.comps[0].status='cancelled';
 state.cards=[card('a','w1',Array(18).fill(1)),card('a','w2',Array(18).fill(4))];
 const result=winterLeagueTable(league,state),team=result.table.find(t=>t.id==='ab');
 assert.equal(result.weekly.length,9);assert.equal(team.weeks[0].compId,'w2');
 assert.deepEqual(team.weeks[0].beforeAdjustments,{a:0,b:0});assert.equal(team.total,36);
});

test('weekly tied totals use back-nine countback',()=>{
 const {league,state}=fixture({settings:{mode:'fixed'}});league.teams.reverse();
 state.cards=[card('a','w1',[...Array(9).fill(5),...Array(9).fill(3)]),card('c','w1',[...Array(9).fill(3),...Array(9).fill(5)])];
 const rows=winterLeagueTable(league,state).weekly[0].rows;
 assert.deepEqual(rows.map(r=>[r.teamId,r.points,r.position]),[['ab',36,1],['cd',36,2]]);
});

test('best eight of ten counts 31 through 38 and all-rounds mode counts 29 through 38',()=>{
 const {league,state}=fixture();state.comps=state.comps.map((c,i)=>({...c,historicalTeamScores:{ab:29+i}}));
 assert.equal(winterLeagueTable(league,state).table.find(t=>t.id==='ab').total,276);
 league.oomSettings={bestCount:0};assert.equal(winterLeagueTable(league,state).table.find(t=>t.id==='ab').total,335);
});

test('weekly results retain all teams who scored, including outside top three',()=>{
 const {league,state}=fixture({settings:{mode:'fixed'}});
 league.teams=['a','b','c','d'].map(id=>({id,name:id,memberIds:[id]}));
 state.cards=state.players.map((p,i)=>card(p.id,'w1',Array(18).fill(i+3)));
 assert.equal(winterLeagueTable(league,state).weekly[0].rows.length,4);
});

test('complete ten-week fixture matches independently calculated scores, cuts and best-eight totals',()=>{
 const {league,state}=winterLeagueSeasonFixture(),before=JSON.stringify(state),result=winterLeagueTable(league,state);
 assert.equal(result.weekly.length,9);assert.equal(result.bestCount,8);
 assert.deepEqual(result.table.map(t=>[t.name,t.total,t.played]),[
  ['QA Better Ball',352,9],['QA Solo',321,9],['QA Level Par',288,9],['QA No Recovery',80,9],
 ]);
 const best=result.table[0],solo=result.table[1];
 assert.deepEqual(best.weeks.map(w=>w.points),[54,49,46,44,42,40,39,38,38]);
 assert.deepEqual(solo.weeks.map(w=>w.points),[45,43,41,40,39,38,38,37,37]);
 assert.deepEqual(Object.values(best.finalAdjustments),[-16.5,-16.5]);
 assert.deepEqual(Object.values(solo.finalAdjustments),[-8.5,-8.5]);
 assert.equal(best.weeks[0].playersPlayed,2);assert.equal(solo.weeks[0].playersPlayed,1);
 assert.ok(result.weekly.every(w=>w.rows.length===4));
 assert.equal(JSON.stringify(state),before,'scoring must preserve cards, links and badges');
});
