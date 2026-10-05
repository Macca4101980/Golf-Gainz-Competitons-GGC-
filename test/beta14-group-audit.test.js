import test from'node:test';import assert from'node:assert/strict';import{groupScore,groupLeaderboard,stablefordPoints,scrambleTeamHandicap}from'../src/groupScoring.js';

const holes=Array.from({length:18},(_,i)=>({n:i+1,par:[4,3,5][i%3],si:i+1}));
const tee={name:'White',rating:72,slope:113,holes};const course={id:'audit-course',tees:[tee]};
const players=[{id:'a',name:'A',hi:0},{id:'b',name:'B',hi:8},{id:'c',name:'C',hi:18},{id:'d',name:'D',hi:28}];
const ids=players.map(p=>p.id),group={id:'g',playerIds:ids};
function state(cards=[]){return{players,courses:[course],cards}}
function card(pid,gross,ph){return{id:'card-'+pid,compId:'comp',playerId:pid,courseId:'audit-course',tee:'White',gross,handicapIndexUsed:players.find(p=>p.id===pid).hi,playingHandicap:ph}}
function comp(format,extra={}){return{id:'comp',format,course:'audit-course',tee:'White',holesMode:'18',handicapAllowance:100,...extra}}
function independentPoints(gross,h,ph){const base=Math.trunc(ph/18),rem=Math.abs(ph%18),shots=ph>=0?base+(h.si<=rem?1:0):base-(rem>0&&h.si>18-rem?1:0);return gross?Math.max(0,2+(h.par+shots-gross)):0}
function expectedCombined(format,cards){let total=0;for(let i=0;i<18;i++){const pts=cards.map((x,j)=>({id:ids[j],pts:independentPoints(x[i],holes[i],players[j].hi),gross:x[i]}));let chosen=[];if(format==='yellow-ball'){const y=i%4;chosen=[pts[y],...pts.filter((_,j)=>j!==y).sort((a,b)=>b.pts-a.pts).slice(0,1)].filter(x=>x.gross)}else{const count=format==='best1'?1:format==='best2'||format==='bowmaker'||format==='alliance'||format==='shamble'?2:format==='best3'?3:format==='cha-cha-cha'?(i%3)+1:i<6?1:i<12?2:i<17?3:4;chosen=pts.filter(x=>x.gross).sort((a,b)=>b.pts-a.pts).slice(0,count)}total+=chosen.reduce((n,x)=>n+x.pts,0)}return total}

const gross=[
 holes.map((h,i)=>h.par+(i%4===0?-1:0)),
 holes.map((h,i)=>h.par+(i%5===0?1:0)),
 holes.map((h,i)=>h.par+1),
 holes.map((h,i)=>h.par+2)
];
for(const format of['best1','best2','best3','cha-cha-cha','irish-fourball','bowmaker','alliance','yellow-ball','shamble'])test(format+' agrees with independent mixed-handicap calculation',()=>{const cards=gross.map((g,i)=>card(ids[i],g,players[i].hi));assert.equal(groupScore(group,comp(format),state(cards)).points,expectedCombined(format,gross))});

test('front nine scores only selected nine holes',()=>{const cards=gross.map((g,i)=>card(ids[i],g,players[i].hi)),c=comp('best2',{holesMode:'front9'}),r=groupScore(group,c,state(cards));let expected=0;for(let i=0;i<9;i++)expected+=ids.map((x,j)=>independentPoints(gross[j][i],holes[i],players[j].hi)).sort((a,b)=>b-a).slice(0,2).reduce((a,b)=>a+b,0);assert.equal(r.points,expected);assert.equal(r.complete,9)});

test('back nine scores only selected nine holes',()=>{const cards=gross.map((g,i)=>card(ids[i],g,players[i].hi)),c=comp('best2',{holesMode:'back9'}),r=groupScore(group,c,state(cards));let expected=0;for(let i=9;i<18;i++)expected+=ids.map((x,j)=>independentPoints(gross[j][i],holes[i],players[j].hi)).sort((a,b)=>b-a).slice(0,2).reduce((a,b)=>a+b,0);assert.equal(r.points,expected);assert.equal(r.complete,9)});

test('incomplete player score does not become a phantom counting score',()=>{const g=gross.map(x=>[...x]);g[0][0]=0;const cards=g.map((x,i)=>card(ids[i],x,players[i].hi));assert.equal(groupScore(group,comp('best2'),state(cards)).points,expectedCombined('best2',g))});
test('three-player yellow ball rotates only through actual players',()=>{const three=group.playerIds.slice(0,3),cards=gross.slice(0,3).map((g,i)=>card(ids[i],g,players[i].hi)),r=groupScore({id:'g3',playerIds:three},comp('yellow-ball'),state(cards));assert.deepEqual(r.holes.slice(0,6).map(h=>h.yellowBallId),['a','b','c','a','b','c'])});
test('stableford points floor at zero',()=>{assert.equal(stablefordPoints(12,4,0),0);assert.equal(stablefordPoints(3,4,0),3)});
test('scramble explicit team handicap is preserved and gross/net totals are correct',()=>{const g={...group,teamGross:holes.map(h=>h.par),teamPlayingHandicap:7},r=groupScore(g,comp('scramble'),state());assert.equal(r.gross,72);assert.equal(r.teamHandicap,7);assert.equal(r.net,65);assert.equal(r.complete,18)});
test('Florida and standard Scramble use isolated team gross scoring path',()=>{for(const format of['florida','scramble-standard']){const g={...group,teamGross:holes.map(h=>h.par),teamPlayingHandicap:8},r=groupScore(g,comp(format),state());assert.equal(r.net,64);assert.equal(r.lowerWins,true)}});
test('scramble default allowance is deterministic low-to-high',()=>{const h=scrambleTeamHandicap(ids,comp('scramble'),state());assert.equal(h,0*.25+8*.20+18*.15+28*.10)});
test('team gross incomplete holes are not added to gross total',()=>{const scores=holes.map(h=>h.par);scores[17]='';const r=groupScore({...group,teamGross:scores,teamPlayingHandicap:8},comp('scramble'),state());assert.equal(r.complete,17);assert.equal(r.gross,67)});
test('leaderboard orders Stableford high-to-low and scramble nett low-to-high',()=>{const cards=gross.map((g,i)=>card(ids[i],g,players[i].hi));const c=comp('best1');c.roundGroups=[{id:'one',playerIds:ids},{id:'two',playerIds:['a','b']}];const b=groupLeaderboard(c,state(cards));assert.ok(b[0].points>=b[1].points);const sc=comp('scramble');sc.roundGroups=[{id:'x',playerIds:ids,teamGross:holes.map(h=>h.par),teamPlayingHandicap:8},{id:'y',playerIds:ids,teamGross:holes.map(h=>h.par+1),teamPlayingHandicap:8}];const sb=groupLeaderboard(sc,state());assert.ok(sb[0].rankValue<sb[1].rankValue)});
