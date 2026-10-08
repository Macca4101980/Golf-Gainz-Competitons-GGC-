import test from 'node:test';
import assert from 'node:assert/strict';
import {groupScore,groupLeaderboard,GROUP_FORMATS} from '../src/groupScoring.js';

// Independently specified 18-hole oracle: par 4, zero playing handicap.
// Each hole awards Stableford points [3,2,1,0], rotated through four golfers.
// Expected totals below are calculated from those point values, not groupScore().
const ids=['a','b','c','d'];
const holes=Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1}));
const players=ids.map((id,i)=>({id,name:'Golfer '+id,hi:0}));
const cards=ids.map((id,p)=>({
 id:'card-'+id,compId:'comp',playerId:id,playingHandicap:0,
 gross:holes.map((_,i)=>6-([3,2,1,0][(p-i+4*18)%4]))
}));
const state={players,cards,courses:[{id:'course',tees:[{name:'white',holes,courseRating:72,slopeRating:113}]}]};
const group={id:'round',playerIds:ids,teamGross:Array(18).fill(4),teamPlayingHandicap:0};
const expected={
 scramble:72,'scramble-standard':72,florida:72,
 shamble:90,best1:54,best2:90,best3:108,
 'cha-cha-cha':84,'irish-fourball':84,bowmaker:90,alliance:90,'yellow-ball':90
};
test('all configured group formats have independently specified 18-hole expected totals',()=>{
 assert.deepEqual([...GROUP_FORMATS].sort(),Object.keys(expected).sort());
 for(const [format,total] of Object.entries(expected)){
  const result=groupScore(group,{id:'comp',format,course:'course',tee:'white'},state);
  assert.equal(result.rankValue,total,format+' total');
  assert.equal(result.complete,18,format+' completed holes');
  assert.equal(result.holes.filter(Boolean).length,18,format+' hole details');
 }
});
test('group leaderboard ranks high points first but low scramble net first',()=>{
 const second={...group,id:'second',playerIds:ids,teamGross:Array(18).fill(5)};
 const comp={id:'comp',format:'scramble',course:'course',tee:'white',roundGroups:[second,group]};
 assert.deepEqual(groupLeaderboard(comp,state).map(x=>x.groupId),['round','second']);
});
test('front-nine selection excludes all back-nine contributions',()=>{
 const result=groupScore(group,{id:'comp',format:'best2',course:'course',tee:'white',holesMode:'front9'},state);
 assert.equal(result.points,45);
 assert.equal(result.complete,9);
 assert.equal(result.holes.slice(9).every(x=>x===null),true);
});
