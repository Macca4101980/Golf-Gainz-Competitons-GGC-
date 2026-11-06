import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublicLeagueLeaderboard} from '../src/publicLeaderboard.js';
import {leagueDisplayTable} from '../src/leagueDisplay.js';
import {winterLeagueTable} from '../src/winterLeague.js';

const now=Date.parse('2026-10-31T18:00:00Z');
function fixture(){
 const holes=Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1}));
 const league={id:'league',name:'QA League',teams:[{id:'ab',name:'Team AB',memberIds:['a','b']}],handicapSettings:{mode:'fixed'},oomSettings:{bestCount:8}};
 const base={societyId:'group',leagueId:'league',format:'4bbb-stableford',courseSnapshot:{name:'QA',tee:{name:'Green',slope:113,rating:72,holes}}};
 const comps=[{...base,id:'w1',starts:'2026-10-16',resultsEmbargo:{enabled:true,releaseAt:'2026-10-23T18:00:00Z',visibleThroughHole:15}},{...base,id:'w2',starts:'2026-10-31',resultsEmbargo:{enabled:true,releaseAt:'2026-11-06T18:00:00Z',visibleThroughHole:15}}];
 const state={players:[{id:'a',name:'A',hi:0},{id:'b',name:'B',hi:0}],comps,cards:comps.map(c=>({id:c.id,compId:c.id,playerId:'a',gross:Array(18).fill(4)})),leagues:[league],courses:[]};
 return {league,state};
}
test('overall public display includes Week 1 plus provisional Week 2, while official totals stay unchanged',()=>{
 const {league,state}=fixture();const before=JSON.stringify(state);
 const publicResult=buildPublicLeagueLeaderboard(league,state,now);
 assert.equal(publicResult.rows[0].result,'66 pts');assert.equal(publicResult.rows[0].played,2);assert.deepEqual(publicResult.rows[0].counting,[36,30]);
 assert.equal(publicResult.provisional,true);assert.equal(publicResult.visibleThrough,15);
 assert.equal(leagueDisplayTable(league,state,now).table[0].total,66);
 assert.equal(winterLeagueTable(league,state,new Date(now)).table[0].total,36);
 assert.equal(JSON.stringify(state),before);
});
test('refresh uses saved score changes, but hidden final holes cannot affect the provisional total',()=>{
 const {league,state}=fixture();state.cards[1].gross[0]=3;
 assert.equal(buildPublicLeagueLeaderboard(league,state,now).rows[0].result,'67 pts');
 state.cards[1].gross[17]=1;
 assert.equal(buildPublicLeagueLeaderboard(league,state,now).rows[0].result,'67 pts');
});
test('release switches both app and public display to all eighteen holes',()=>{
 const {league,state}=fixture();const at=Date.parse('2026-11-06T18:00:00Z');
 const result=buildPublicLeagueLeaderboard(league,state,at);
 assert.equal(result.rows[0].result,'72 pts');assert.equal(result.provisional,false);assert.equal(result.visibleThrough,18);
 assert.equal(result.rows[0].result,leagueDisplayTable(league,state,at).table[0].total+' pts');
});
test('a future provisional opening hides that week, including any saved scores',()=>{
 const {league,state}=fixture();state.comps[1].resultsEmbargo.provisionalAt='2026-11-01T00:00:00Z';
 const result=buildPublicLeagueLeaderboard(league,state,now);
 assert.equal(result.rows[0].result,'36 pts');assert.equal(result.rows[0].played,1);
});
test('cancelled weeks and configured best count apply to the same app/public results',()=>{
 const {league,state}=fixture();league.oomSettings.bestCount=1;
 assert.deepEqual(buildPublicLeagueLeaderboard(league,state,now).rows[0].counting,[36]);
 state.comps[0].status='cancelled';
 assert.equal(buildPublicLeagueLeaderboard(league,state,now).rows[0].result,'30 pts');
});
