import test from 'node:test';
import assert from 'node:assert/strict';
import {FORMAT_RULES} from '../src/scoring.js';
import {groupScore} from '../src/groupScoring.js';
import {buildPublicLeaderboard} from '../src/publicLeaderboard.js';
import {groupStartError,groupHasScores,groupCompetitionUpdate,groupSubmissionError} from '../src/groupRound.js';

const holes=Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1}));
const courseSnapshot={id:'snapshot',name:'QA Par 72',tee:{name:'Green',slope:113,rating:72,holes}};
const players=['a','b','c','d'].map(id=>({id,name:id.toUpperCase(),hi:0}));
const group={id:'team',playerIds:players.map(p=>p.id)};
const base={id:'comp',societyId:'group',courseSnapshot,holesMode:'18',handicapAllowance:100,roundGroups:[group],entries:players.map(p=>p.id)};
function fixture(format){const c={...base,format};return {c,state:{players,courses:[],societies:[{id:'group'}],comps:[c],cards:players.map((p,i)=>({id:'card-'+p.id,playerId:p.id,compId:c.id,playingHandicap:0,gross:Array(18).fill(3+i)}))}};}

for(const [format,total] of Object.entries({best1:54,best2:90,best3:108,'cha-cha-cha':84}))test(`${format}: enabled metadata and independently specified 18-hole result without course library`,()=>{
 const {c,state}=fixture(format),before=JSON.stringify(state),r=groupScore(group,c,state);
 assert.equal(FORMAT_RULES[format].verified,true);assert.equal(FORMAT_RULES[format].category,'group');
 assert.equal(r.points,total);assert.equal(r.complete,18);assert.equal(JSON.stringify(state),before);
});

test('Best 1/2/3 named formats cannot silently use a conflicting legacy score count',()=>{
 for(const [format,total] of Object.entries({best1:54,best2:90,best3:108})){const {c,state}=fixture(format);assert.equal(groupScore(group,{...c,groupScoresCount:4},state).points,total);}
});

test('Cha Cha Cha repeats one/two/three counted scores including the back nine',()=>{
 const {c,state}=fixture('cha-cha-cha'),r=groupScore(group,c,state);
 assert.deepEqual(r.holes.map(h=>h.points),[3,5,6,3,5,6,3,5,6,3,5,6,3,5,6,3,5,6]);
 assert.equal(groupScore(group,{...c,holesMode:'back9'},state).points,42);
});

test('group minimums, duplicates and already assigned golfers are rejected before changing state',()=>{
 const c={...base,format:'best3',roundGroups:[]};
 assert.match(groupStartError({c,ids:['a','b'],me:players[0],admin:true}),/3–4/);
 assert.match(groupStartError({c,ids:['a','b','b'],me:players[0],admin:true}),/only once/);
 assert.match(groupStartError({c:{...c,roundGroups:[{id:'other',playerIds:['b']}]},ids:['a','b','c'],me:players[0],admin:true}),/already belongs/);
 assert.equal(groupStartError({c,ids:['a','b','c'],me:players[0],admin:true}),null);
});

test('member group changes include self and only already-entered partners',()=>{
 const c={...base,format:'best1',roundGroups:[],entries:['a','b']};
 assert.equal(groupStartError({c,ids:['a','b'],me:players[0]}),null);
 assert.match(groupStartError({c,ids:['a','c'],me:players[0]}),/enter this competition/);
 assert.match(groupStartError({c,ids:['b','c'],me:players[0]}),/include you/);
});

test('member persistence changes participation only and preserves competition timestamps/settings',()=>{
 const c={...base,updatedAt:'original',format:'best1',fee:12,starts:'original-start'};
 const patch={roundGroups:[{...group,submitted:true}],entries:[...base.entries]};
 const r=groupCompetitionUpdate(c,patch,{admin:false,now:'new'});
 assert.equal(r.updatedAt,'original');assert.equal(r.fee,12);assert.equal(r.starts,'original-start');
 assert.deepEqual({...r,entries:c.entries,roundGroups:c.roundGroups},c);
 assert.equal(groupCompetitionUpdate(c,patch,{admin:true,now:'new'}).updatedAt,'new');
});

test('N/R locks the roster and counts for submission; blank selected holes block submission',()=>{
 const {c,state}=fixture('best3');state.cards[0].gross[0]=0;
 assert.equal(groupHasScores(group,c,state),true);assert.equal(groupSubmissionError(group,c,state),null);
 state.cards[0].gross[1]='';assert.match(groupSubmissionError(group,c,state),/1 unplayed hole/);
 state.cards[0].gross[1]=0;state.cards[0].gross[17]='';
 assert.equal(groupSubmissionError(group,{...c,holesMode:'front9'},state),null);
});

test('restarting or changing one group never requires replacing other playing groups',()=>{
 const other={id:'other',playerIds:['x','y']};
 const c={...base,format:'best1',roundGroups:[group,other]};
 assert.equal(groupStartError({c,ids:['a','b'],me:players[0],admin:true,saved:group}),null);
 const r=groupCompetitionUpdate(c,{roundGroups:c.roundGroups.filter(g=>g.id!==group.id)},{admin:false});
 assert.deepEqual(r.roundGroups,[other]);assert.deepEqual(c.roundGroups,[group,other]);
});

for(const [format,total,partial] of [['best1',54,45],['best2',90,75],['best3',108,90],['cha-cha-cha',84,70]])test(`${format}: public result and 15-hole provisional projection use the same team calculation`,()=>{
 const {c,state}=fixture(format);const at=Date.parse('2026-10-30T12:00:00Z');
 const p=buildPublicLeaderboard(c,state,at);
 assert.equal(p.rows.length,1);assert.equal(p.rows[0].result,total+' pts');assert.equal(p.rows[0].complete,18);assert.deepEqual(p.rows[0].memberIds,['a','b','c','d']);
 const provisional=buildPublicLeaderboard({...c,resultsEmbargo:{enabled:true,visibleThroughHole:15,releaseAt:'2026-10-31T18:00:00Z'}},state,at);
 assert.equal(provisional.rows[0].result,partial+' pts');assert.equal(provisional.rows[0].complete,15);
});
