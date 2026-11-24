import test from 'node:test';
import assert from 'node:assert/strict';
import{createGroupStage,createKnockout,createLeaguePlayoff,createRoundRobin,entrantFixtureSummary,fixtureResultFromMatchplay,groupStageKnockoutPreview,groupStageStandings,knockoutSeedOrder,qualifyGroupStage,qualifyLeaguePlayoff,recordConcession,recordFixtureResult,recordSuddenDeathHole,roundRobinStandings}from'../src/matchplayTournament.js';

const entrants=count=>Array.from({length:count},(_,index)=>({id:`p${index+1}`,name:`Player ${index+1}`,seed:index+1}));

test('Top 4 is seeded 1 v 4 and 2 v 3',()=>{
 const series=createKnockout({id:'top4',entrants:entrants(4)}),round=series.fixtures.filter(f=>f.round===1);
 assert.deepEqual(round.map(f=>[f.entrantAId,f.entrantBId]),[['p1','p4'],['p2','p3']]);
 assert.deepEqual(knockoutSeedOrder(8),[1,8,4,5,2,7,3,6]);
});

test('a custom knockout field gives the highest seeds byes without inventing entrants',()=>{
 const series=createKnockout({id:'five',entrants:entrants(5)}),first=series.fixtures.filter(f=>f.round===1);
 assert.equal(series.bracketSize,8);
 assert.equal(first.filter(f=>f.status==='bye').length,3);
 assert.deepEqual(first.find(f=>f.entrantAId==='p4').entrantBId,'p5');
 assert.equal(series.fixtures.find(f=>f.id==='five-r2-m1').entrantAId,'p1');
});

test('knockout winners automatically advance through the bracket',()=>{
 let series=createKnockout({id:'ko',entrants:entrants(4)});
 series=recordFixtureResult(series,'ko-r1-m1',{holesWonA:6,holesWonB:3,holesPlayed:15});
 series=recordFixtureResult(series,'ko-r1-m2',{holesWonA:4,holesWonB:5,holesPlayed:18});
 const final=series.fixtures.find(f=>f.round===2);
 assert.deepEqual([final.entrantAId,final.entrantBId],['p1','p3']);
 series=recordFixtureResult(series,final.id,{holesWonA:5,holesWonB:4,holesPlayed:18});
 assert.equal(series.championId,'p1');
});

test('a tied knockout enters sudden death and advances only after an outright hole',()=>{
 let series=createKnockout({id:'sd',entrants:entrants(2)});
 series=recordFixtureResult(series,'sd-r1-m1',{holesWonA:4,holesWonB:4,holesPlayed:18});
 assert.equal(series.fixtures[0].status,'sudden-death');
 series=recordSuddenDeathHole(series,'sd-r1-m1',{});
 assert.equal(series.fixtures[0].suddenDeath.holes.length,1);
 assert.equal(series.championId,null);
 series=recordSuddenDeathHole(series,'sd-r1-m1',{winnerId:'p2'});
 assert.equal(series.fixtures[0].suddenDeath.holes.length,2);
 assert.equal(series.championId,'p2');
});

test('a player or team can concede a knockout and the opponent advances 1 up',()=>{
 let series=createKnockout({id:'concede-ko',entrants:entrants(4)});
 series=recordConcession(series,'concede-ko-r1-m1',{concededById:'p4',completedAt:'2027-01-04T12:00:00Z'});
 const fixture=series.fixtures.find(f=>f.id==='concede-ko-r1-m1'),next=series.fixtures.find(f=>f.id==='concede-ko-r2-m1');
 assert.deepEqual({status:fixture.status,winnerId:fixture.winnerId,loserId:fixture.loserId,display:fixture.score.display,method:fixture.score.method},{status:'complete',winnerId:'p1',loserId:'p4',display:'1 UP',method:'concession'});
 assert.equal(fixture.score.holesPlayed,null);
 assert.equal(next.entrantAId,'p1');
});

test('a round-robin concession counts as a played 1-up win in the table',()=>{
 let series=createRoundRobin({id:'concede-rr',entrants:entrants(2)});
 series=recordConcession(series,series.fixtures[0].id,{concededById:'p2'});
 const table=roundRobinStandings(series),winner=table.find(row=>row.entrantId==='p1'),loser=table.find(row=>row.entrantId==='p2');
 assert.deepEqual({played:winner.played,won:winner.won,holesWon:winner.holesWon,holesLost:winner.holesLost,holeDifference:winner.holeDifference,points:winner.points},{played:1,won:1,holesWon:1,holesLost:0,holeDifference:1,points:3});
 assert.deepEqual({played:loser.played,lost:loser.lost,holeDifference:loser.holeDifference,points:loser.points},{played:1,lost:1,holeDifference:-1,points:0});
});

test('a League playoff is forecasted until final standings are qualified',()=>{
 const standings=[{teamId:'t1',position:1},{teamId:'t2',position:2},{teamId:'t3',position:3},{teamId:'t4',position:4},{teamId:'t5',position:5}];
 const original=structuredClone(standings),forecast=createLeaguePlayoff({id:'wl-playoff',leagueId:'winter',standings,size:4});
 assert.equal(forecast.sourceLeagueId,'winter');
 assert.equal(forecast.qualificationStatus,'forecasted');
 assert.ok(forecast.fixtures.every(f=>f.status==='forecasted'));
 assert.deepEqual(forecast.fixtures.filter(f=>f.round===1).map(f=>[f.entrantAId,f.entrantBId]),[['t1','t4'],['t2','t3']]);
 assert.throws(()=>recordFixtureResult(forecast,'wl-playoff-r1-m1',{holesWonA:5,holesWonB:4}),/Forecast playoff fixtures cannot be scored/);
 const series=qualifyLeaguePlayoff(forecast,{standings,qualifiedAt:'2027-01-03T18:00:00Z'});
 assert.equal(series.qualificationStatus,'qualified');
 assert.ok(series.fixtures.filter(f=>f.round===1).every(f=>f.status==='scheduled'));
 assert.deepEqual(standings,original);
});

test('a changing League table produces a fresh forecast without rewriting an earlier forecast',()=>{
 const first=createLeaguePlayoff({id:'forecast',leagueId:'winter',standings:[{teamId:'a'},{teamId:'b'},{teamId:'c'},{teamId:'d'}],size:4});
 const next=createLeaguePlayoff({id:'forecast',leagueId:'winter',standings:[{teamId:'b'},{teamId:'a'},{teamId:'d'},{teamId:'c'}],size:4});
 assert.deepEqual(first.fixtures.filter(f=>f.round===1).map(f=>[f.entrantAId,f.entrantBId]),[['a','d'],['b','c']]);
 assert.deepEqual(next.fixtures.filter(f=>f.round===1).map(f=>[f.entrantAId,f.entrantBId]),[['b','c'],['a','d']]);
 assert.equal(first.qualificationStatus,'forecasted');
});

test('single round robin schedules every pairing exactly once',()=>{
 const series=createRoundRobin({id:'rr',entrants:entrants(5)}),pairs=new Set(series.fixtures.map(f=>[f.entrantAId,f.entrantBId].sort().join(':')));
 assert.equal(series.fixtures.length,10);
 assert.equal(pairs.size,10);
 assert.ok(series.fixtures.every(f=>f.entrantAId&&f.entrantBId));
});

test('double round robin reverses every fixture',()=>{
 const series=createRoundRobin({id:'double',entrants:entrants(4),legs:2});
 assert.equal(series.fixtures.length,12);
 for(const fixture of series.fixtures.filter(f=>f.leg===1))assert.ok(series.fixtures.some(other=>other.leg===2&&other.entrantAId===fixture.entrantBId&&other.entrantBId===fixture.entrantAId));
});

test('football-style table records W D L holes difference and custom points',()=>{
 let series=createRoundRobin({id:'table',entrants:entrants(3),points:{winPoints:3,drawPoints:1,lossPoints:0}});
 const one=series.fixtures.find(f=>[f.entrantAId,f.entrantBId].includes('p1')&&[f.entrantAId,f.entrantBId].includes('p2'));
 series=recordFixtureResult(series,one.id,{holesWonA:6,holesWonB:3,holesPlayed:15,winnerId:'p1'});
 const two=series.fixtures.find(f=>[f.entrantAId,f.entrantBId].includes('p1')&&[f.entrantAId,f.entrantBId].includes('p3'));
 series=recordFixtureResult(series,two.id,{holesWonA:4,holesWonB:4,holesPlayed:18});
 const table=roundRobinStandings(series),p1=table.find(row=>row.entrantId==='p1'),p2=table.find(row=>row.entrantId==='p2');
 assert.deepEqual({played:p1.played,won:p1.won,drawn:p1.drawn,lost:p1.lost,holesWon:p1.holesWon,holesLost:p1.holesLost,holeDifference:p1.holeDifference,points:p1.points},{played:2,won:1,drawn:1,lost:0,holesWon:10,holesLost:7,holeDifference:3,points:4});
 assert.deepEqual({lost:p2.lost,points:p2.points,holeDifference:p2.holeDifference},{lost:1,points:0,holeDifference:-3});
});

test('players can see who they have played and who remains',()=>{
 let series=createRoundRobin({id:'remaining',entrants:entrants(4)}),fixture=series.fixtures.find(f=>f.entrantAId==='p1'||f.entrantBId==='p1');
 series=recordFixtureResult(series,fixture.id,{holesWonA:5,holesWonB:4,holesPlayed:18});
 const summary=entrantFixtureSummary(series,'p1');
 assert.equal(summary.played,1);assert.equal(summary.remaining,2);assert.equal(summary.playedOpponentIds.length,1);assert.equal(summary.remainingOpponentIds.length,2);
});

test('the existing scorecard engine result maps to tournament holes won and winner',()=>{
 const mapped=fixtureResultFromMatchplay({winner:0,holes:[{nets:[4,5]},{nets:[4,4]},{nets:[6,5]}]},'a','b');
 assert.deepEqual(mapped,{holesWonA:1,holesWonB:1,holesPlayed:3,winnerId:'a'});
});

test('round-robin fixture generation is complete and duplicate-free from 2 to 32 entrants',()=>{
 for(let count=2;count<=32;count++){
  const single=createRoundRobin({id:`rr-${count}`,entrants:entrants(count)}),expected=count*(count-1)/2;
  assert.equal(single.fixtures.length,expected,`single ${count}`);
  const pairs=single.fixtures.map(f=>[f.entrantAId,f.entrantBId].sort().join(':'));
  assert.equal(new Set(pairs).size,expected,`unique ${count}`);
  for(const entrant of single.entrants)assert.equal(single.fixtures.filter(f=>f.entrantAId===entrant.id||f.entrantBId===entrant.id).length,count-1,`schedule ${count} ${entrant.id}`);
  const double=createRoundRobin({id:`double-${count}`,entrants:entrants(count),legs:2});
  assert.equal(double.fixtures.length,expected*2,`double ${count}`);
 }
});

test('World Cup-style groups use balanced seeding and complete round robins',()=>{
 const series=createGroupStage({id:'world-cup',entrants:entrants(16),groupCount:4,qualifiersPerGroup:2});
 assert.deepEqual(series.groups.map(group=>group.entrantIds),[['p1','p8','p9','p16'],['p2','p7','p10','p15'],['p3','p6','p11','p14'],['p4','p5','p12','p13']]);
 assert.equal(series.fixtures.length,24);
 assert.ok(series.fixtures.every(fixture=>fixture.groupId&&fixture.stage==='group'));
 assert.deepEqual(groupStageStandings(series).map(group=>group.standings.length),[4,4,4,4]);
 assert.throws(()=>qualifyGroupStage(series),/must be complete/);
});

test('group-stage results can preview every knockout round before qualification',()=>{
 const series=createGroupStage({id:'preview',name:'World Cup',entrants:entrants(8),groupCount:2,qualifiersPerGroup:2});
 const preview=groupStageKnockoutPreview(series),first=preview.fixtures.filter(fixture=>fixture.round===1),final=preview.fixtures.find(fixture=>fixture.round===2);
 assert.equal(preview.preview,true);
 assert.deepEqual(first.map(fixture=>[preview.entrants.find(item=>item.id===fixture.entrantAId)?.name,preview.entrants.find(item=>item.id===fixture.entrantBId)?.name]),[['Group A · 1st','Group B · 2nd'],['Group B · 1st','Group A · 2nd']]);
 assert.ok(first.every(fixture=>fixture.status==='forecasted'));
 assert.equal(final.status,'forecasted');
 assert.deepEqual([final.entrantAId,final.entrantBId],[null,null]);
});

test('completed group tables qualify into cross-group knockout fixtures',()=>{
 let series=createGroupStage({id:'groups',entrants:entrants(8),groupCount:2,qualifiersPerGroup:2});
 for(const fixture of series.fixtures)series=recordFixtureResult(series,fixture.id,{holesWonA:1,holesWonB:0,holesPlayed:1});
 const tables=groupStageStandings(series),knockout=qualifyGroupStage(series,{id:'groups-ko'}),first=knockout.fixtures.filter(fixture=>fixture.round===1);
 assert.equal(knockout.sourceGroupStageId,'groups');
 assert.equal(knockout.entrants.length,4);
 assert.deepEqual(first.map(fixture=>[fixture.entrantAId,fixture.entrantBId]),[[tables[0].standings[0].entrantId,tables[1].standings[1].entrantId],[tables[1].standings[0].entrantId,tables[0].standings[1].entrantId]]);
});

test('every knockout size from 2 to 32 safely resolves to one champion',()=>{
 for(let count=2;count<=32;count++){
  let series=createKnockout({id:`ko-${count}`,entrants:entrants(count)}),guard=0;
  while(!series.championId&&guard++<100){
   const fixture=series.fixtures.find(item=>item.status==='scheduled'&&item.entrantAId&&item.entrantBId);
   assert.ok(fixture,`resolvable fixture ${count}`);
   series=recordFixtureResult(series,fixture.id,{holesWonA:1,holesWonB:0,holesPlayed:1});
  }
  assert.ok(series.championId,`champion ${count}`);
  assert.ok(series.entrants.some(item=>item.id===series.championId),`real champion ${count}`);
  assert.equal(series.fixtures.length,series.bracketSize-1,`fixture count ${count}`);
 }
});

test('round-robin draws remain draws and never start sudden death',()=>{
 let series=createRoundRobin({id:'draw',entrants:entrants(2),points:{winPoints:5,drawPoints:2,lossPoints:-1}}),fixture=series.fixtures[0];
 series=recordFixtureResult(series,fixture.id,{holesWonA:4,holesWonB:4,holesPlayed:18});
 assert.equal(series.fixtures[0].status,'complete');
 assert.equal(series.fixtures[0].draw,true);
 assert.equal(series.fixtures[0].suddenDeath,null);
 assert.deepEqual(roundRobinStandings(series).map(row=>row.points),[2,2]);
});

test('invalid tournament states fail closed',()=>{
 assert.throws(()=>createKnockout({id:'one',entrants:entrants(1)}),/at least two entrants/);
 assert.throws(()=>createKnockout({id:'large',entrants:entrants(65)}),/limited to 64 entrants/);
 const series=createKnockout({id:'invalid-winner',entrants:entrants(2)});
 assert.throws(()=>recordFixtureResult(series,series.fixtures[0].id,{winnerId:'outsider'}),/winner must be one of the fixture entrants/);
 assert.throws(()=>recordSuddenDeathHole(series,series.fixtures[0].id,{winnerId:'p1'}),/not in sudden death/);
});

