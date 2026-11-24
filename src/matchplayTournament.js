const TERMINAL=new Set(['complete','bye']);

const clone=value=>JSON.parse(JSON.stringify(value));
const asNumber=(value,fallback=0)=>Number.isFinite(+value)?+value:fallback;
const entrantId=row=>row?.entrantId||row?.teamId||row?.playerId||row?.id||null;

function normaliseEntrants(entrants){
 const seen=new Set();
 return (entrants||[]).map((entrant,index)=>typeof entrant==='string'?{id:entrant,seed:index+1}:{...entrant,id:entrant?.id||entrantId(entrant),seed:asNumber(entrant?.seed,index+1)})
  .filter(entrant=>entrant.id&&!seen.has(entrant.id)&&seen.add(entrant.id))
  .sort((a,b)=>a.seed-b.seed||String(a.id).localeCompare(String(b.id)));
}

function bracketSizeFor(count){
 if(count<2)throw new Error('A matchplay tournament needs at least two entrants.');
 if(count>64)throw new Error('A knockout field is limited to 64 entrants.');
 let size=2;while(size<count)size*=2;return size;
}

/** Standard seeded placement: 1 v last, 2 v second-last, preserving later-round balance. */
export function knockoutSeedOrder(size){
 if(size<2||(size&(size-1))!==0)throw new Error('Knockout bracket size must be a power of two.');
 let order=[1,2];
 while(order.length<size){const sum=order.length*2+1;order=order.flatMap(seed=>[seed,sum-seed]);}
 return order;
}

function refreshKnockout(source){
 const series=clone(source),byId=new Map(series.fixtures.map(fixture=>[fixture.id,fixture]));
 for(const fixture of series.fixtures.sort((a,b)=>a.round-b.round||a.slot-b.slot)){
  const sources=(fixture.sourceFixtureIds||[]).map(id=>byId.get(id));
  const sourcesResolved=fixture.round===1||sources.length===2&&sources.every(item=>TERMINAL.has(item?.status));
  if(fixture.round>1){
   if(TERMINAL.has(sources[0]?.status))fixture.entrantAId=sources[0]?.winnerId||null;
   if(TERMINAL.has(sources[1]?.status))fixture.entrantBId=sources[1]?.winnerId||null;
  }
  if(!sourcesResolved||TERMINAL.has(fixture.status)||fixture.status==='sudden-death')continue;
  const present=[fixture.entrantAId,fixture.entrantBId].filter(Boolean);
  if(present.length===1){
   fixture.status='bye';fixture.winnerId=present[0];fixture.loserId=null;fixture.completedAt=fixture.completedAt||series.createdAt;
  }else if(present.length===2){fixture.status=fixture.status==='live'?'live':'scheduled';}
 }
 const final=series.fixtures.find(fixture=>fixture.round===series.rounds&&fixture.slot===0);
 series.championId=TERMINAL.has(final?.status)?final.winnerId:null;
 return series;
}

export function createKnockout({id=`matchplay-${Date.now()}`,name='Matchplay Knockout',societyId=null,entrants,entrantType='individual',sourceLeagueId=null,createdAt=new Date().toISOString(),rules={}}={}){
 const seeded=normaliseEntrants(entrants),bracketSize=bracketSizeFor(seeded.length),rounds=Math.log2(bracketSize),order=knockoutSeedOrder(bracketSize),bySeed=new Map(seeded.map(entrant=>[entrant.seed,entrant.id])),fixtures=[];
 for(let round=1;round<=rounds;round++){
  const count=bracketSize/(2**round);
  for(let slot=0;slot<count;slot++){
   const fixture={id:`${id}-r${round}-m${slot+1}`,seriesId:id,stage:'knockout',round,slot,status:'scheduled',entrantAId:null,entrantBId:null,winnerId:null,loserId:null,draw:false,score:null,suddenDeath:null,sourceFixtureIds:[]};
   if(round===1){fixture.entrantAId=bySeed.get(order[slot*2])||null;fixture.entrantBId=bySeed.get(order[slot*2+1])||null;}
   else fixture.sourceFixtureIds=[`${id}-r${round-1}-m${slot*2+1}`,`${id}-r${round-1}-m${slot*2+2}`];
   fixtures.push(fixture);
  }
 }
 return refreshKnockout({id,name,societyId,type:'knockout',entrantType,sourceLeagueId,entrants:seeded,bracketSize,rounds,fixtures,championId:null,createdAt,rules:{tieBreak:'sudden-death',...rules}});
}

export function createLeaguePlayoff({id,name,leagueId,societyId,standings,size=4,entrantType='team',leagueComplete=false,createdAt,rules}={}){
 const requested=Math.max(2,Math.min(64,Math.floor(asNumber(size,4))));
 const entrants=(standings||[]).map((row,index)=>({id:entrantId(row),name:row.name||row.teamName||row.player?.name,seed:asNumber(row.position,index+1)})).filter(row=>row.id).sort((a,b)=>a.seed-b.seed).slice(0,requested).map((row,index)=>({...row,seed:index+1}));
 if(entrants.length<2)throw new Error('The League does not have enough ranked entrants for a playoff.');
 const series=createKnockout({id,name:name||`Top ${entrants.length} Playoff`,societyId,entrants,entrantType,sourceLeagueId:leagueId,createdAt,rules:{qualificationSize:entrants.length,...rules}});
 series.qualificationStatus=leagueComplete?'qualified':'forecasted';
 series.qualificationSize=entrants.length;
 series.forecastedAt=leagueComplete?null:(createdAt||new Date().toISOString());
 series.qualifiedAt=leagueComplete?(createdAt||new Date().toISOString()):null;
 if(!leagueComplete)series.fixtures=series.fixtures.map(fixture=>({...fixture,status:'forecasted',winnerId:null,loserId:null,completedAt:null}));
 return series;
}

/** Locks the latest final standings into real fixtures. Forecast fixtures are never scored. */
export function qualifyLeaguePlayoff(forecast,{standings,qualifiedAt=new Date().toISOString()}={}){
 if(forecast?.qualificationStatus!=='forecasted')throw new Error('Only a forecasted playoff can be qualified.');
 return createLeaguePlayoff({id:forecast.id,name:forecast.name,leagueId:forecast.sourceLeagueId,societyId:forecast.societyId,standings,size:forecast.qualificationSize,entrantType:forecast.entrantType,leagueComplete:true,createdAt:qualifiedAt,rules:forecast.rules});
}

function circleFixtures(ids){
 const rotation=[...ids];if(rotation.length%2)rotation.push(null);
 const rounds=[];
 for(let round=0;round<rotation.length-1;round++){
  const pairs=[];
  for(let i=0;i<rotation.length/2;i++){
   let a=rotation[i],b=rotation[rotation.length-1-i];
   if(round%2===1&&i===0)[a,b]=[b,a];
   if(a&&b)pairs.push([a,b]);
  }
  rounds.push(pairs);
  rotation.splice(1,0,rotation.pop());
 }
 return rounds;
}

export function createRoundRobin({id=`matchplay-${Date.now()}`,name='Matchplay League',societyId=null,entrants,entrantType='individual',legs=1,createdAt=new Date().toISOString(),points={}}={}){
 const seeded=normaliseEntrants(entrants);if(seeded.length<2)throw new Error('A matchplay League needs at least two entrants.');
 const legCount=Math.max(1,Math.min(2,Math.floor(asNumber(legs,1)))),baseRounds=circleFixtures(seeded.map(item=>item.id)),fixtures=[];
 for(let leg=1;leg<=legCount;leg++)baseRounds.forEach((pairs,roundIndex)=>pairs.forEach(([first,second],slot)=>{
  const [entrantAId,entrantBId]=leg===1?[first,second]:[second,first],round=(leg-1)*baseRounds.length+roundIndex+1;
  fixtures.push({id:`${id}-l${leg}-r${roundIndex+1}-m${slot+1}`,seriesId:id,stage:'league',leg,round,slot,status:'scheduled',entrantAId,entrantBId,winnerId:null,loserId:null,draw:false,score:null,suddenDeath:null});
 }));
 return{id,name,societyId,type:'round-robin',entrantType,entrants:seeded,legs:legCount,rounds:baseRounds.length*legCount,fixtures,createdAt,rules:{winPoints:3,drawPoints:1,lossPoints:0,...points}};
}

export function createGroupStage({id=`matchplay-${Date.now()}`,name='Matchplay Group Stage',societyId=null,entrants,entrantType='individual',groupCount=2,qualifiersPerGroup=2,legs=1,createdAt=new Date().toISOString(),points={}}={}){
 const seeded=normaliseEntrants(entrants),count=Math.floor(asNumber(groupCount,2));
 if(count<2||count>seeded.length/2)throw new Error('Group stage needs at least two groups with at least two entrants in each group.');
 const groups=Array.from({length:count},(_,index)=>({id:`${id}-group-${String.fromCharCode(65+index)}`,name:`Group ${String.fromCharCode(65+index)}`,index,entrantIds:[]}));
 seeded.forEach((entrant,index)=>{const block=Math.floor(index/count),offset=index%count,groupIndex=block%2===0?offset:count-1-offset;groups[groupIndex].entrantIds.push(entrant.id);});
 const qualify=Math.floor(asNumber(qualifiersPerGroup,2));
 if(qualify<1||groups.some(group=>qualify>=group.entrantIds.length))throw new Error('Each group must retain at least one non-qualifying entrant.');
 const rules={winPoints:3,drawPoints:1,lossPoints:0,...points},fixtures=[];
 groups.forEach(group=>{
  const groupEntrants=group.entrantIds.map(entrant=>seeded.find(item=>item.id===entrant));
  const schedule=createRoundRobin({id:group.id,name:group.name,societyId,entrants:groupEntrants,entrantType,legs,createdAt,points:rules});
  fixtures.push(...schedule.fixtures.map(fixture=>({...fixture,seriesId:id,stage:'group',groupId:group.id})));
 });
 return{id,name,societyId,type:'group-stage',entrantType,entrants:seeded,groups,qualifiersPerGroup:qualify,fixtures,createdAt,rules};
}

export function recordFixtureResult(source,fixtureId,{holesWonA=0,holesWonB=0,holesPlayed=0,winnerId=null,completedAt=new Date().toISOString()}={}){
 if(source?.qualificationStatus==='forecasted')throw new Error('Forecast playoff fixtures cannot be scored until the League is complete.');
 const series=clone(source),fixture=series.fixtures.find(item=>item.id===fixtureId);if(!fixture)throw new Error('Matchplay fixture not found.');
 if(!fixture.entrantAId||!fixture.entrantBId)throw new Error('Both fixture entrants must be known before recording a result.');
 if(TERMINAL.has(fixture.status))throw new Error('This fixture is already complete.');
 const a=Math.max(0,asNumber(holesWonA)),b=Math.max(0,asNumber(holesWonB));fixture.score={holesWonA:a,holesWonB:b,holesPlayed:Math.max(a+b,asNumber(holesPlayed))};
 const resolvedWinner=winnerId||(a>b?fixture.entrantAId:b>a?fixture.entrantBId:null);
 if(resolvedWinner&&![fixture.entrantAId,fixture.entrantBId].includes(resolvedWinner))throw new Error('The winner must be one of the fixture entrants.');
 if(series.type==='knockout'&&!resolvedWinner){fixture.status='sudden-death';fixture.suddenDeath={active:true,holes:[],winnerId:null};fixture.draw=false;return series;}
 fixture.status='complete';fixture.completedAt=completedAt;fixture.winnerId=resolvedWinner;fixture.draw=!resolvedWinner;fixture.loserId=resolvedWinner?(resolvedWinner===fixture.entrantAId?fixture.entrantBId:fixture.entrantAId):null;
 return series.type==='knockout'?refreshKnockout(series):series;
}

/** Records a voluntary concession as a 1-up result without inventing hole scores. */
export function recordConcession(source,fixtureId,{concededById,completedAt=new Date().toISOString()}={}){
 if(source?.qualificationStatus==='forecasted')throw new Error('Forecast playoff fixtures cannot be scored until the League is complete.');
 const series=clone(source),fixture=series.fixtures.find(item=>item.id===fixtureId);if(!fixture)throw new Error('Matchplay fixture not found.');
 if(!fixture.entrantAId||!fixture.entrantBId)throw new Error('Both fixture entrants must be known before recording a concession.');
 if(TERMINAL.has(fixture.status))throw new Error('This fixture is already complete.');
 if(![fixture.entrantAId,fixture.entrantBId].includes(concededById))throw new Error('The conceding player or team must be one of the fixture entrants.');
 const winnerId=concededById===fixture.entrantAId?fixture.entrantBId:fixture.entrantAId;
 fixture.status='complete';fixture.completedAt=completedAt;fixture.winnerId=winnerId;fixture.loserId=concededById;fixture.draw=false;
 fixture.score={method:'concession',display:'1 UP',margin:1,holesWonA:null,holesWonB:null,holesPlayed:null};
 fixture.concession={concededById,winnerId,completedAt};fixture.suddenDeath=null;
 return series.type==='knockout'?refreshKnockout(series):series;
}

export function recordSuddenDeathHole(source,fixtureId,{winnerId=null,playedAt=new Date().toISOString()}={}){
 const series=clone(source),fixture=series.fixtures.find(item=>item.id===fixtureId);if(!fixture||fixture.status!=='sudden-death')throw new Error('This fixture is not in sudden death.');
 if(winnerId&&![fixture.entrantAId,fixture.entrantBId].includes(winnerId))throw new Error('The sudden-death winner must be one of the fixture entrants.');
 fixture.suddenDeath.holes.push({number:fixture.suddenDeath.holes.length+1,winnerId,playedAt});
 if(!winnerId)return series;
 fixture.suddenDeath.active=false;fixture.suddenDeath.winnerId=winnerId;fixture.status='complete';fixture.completedAt=playedAt;fixture.winnerId=winnerId;fixture.loserId=winnerId===fixture.entrantAId?fixture.entrantBId:fixture.entrantAId;
 return refreshKnockout(series);
}

export function fixtureResultFromMatchplay(match,entrantAId,entrantBId){
 const holes=match?.holes||[];let holesWonA=0,holesWonB=0;
 holes.forEach(hole=>{if(hole.nets?.[0]<hole.nets?.[1])holesWonA++;else if(hole.nets?.[1]<hole.nets?.[0])holesWonB++;});
 return{holesWonA,holesWonB,holesPlayed:holes.length,winnerId:match?.winner===0?entrantAId:match?.winner===1?entrantBId:null};
}

export function roundRobinStandings(series){
 if(series?.type!=='round-robin')throw new Error('Standings require a round-robin series.');
 const table=new Map(series.entrants.map(entrant=>[entrant.id,{entrantId:entrant.id,name:entrant.name||entrant.id,seed:entrant.seed,played:0,won:0,drawn:0,lost:0,holesWon:0,holesLost:0,holeDifference:0,points:0}]));
 for(const fixture of series.fixtures.filter(item=>item.status==='complete')){
  const a=table.get(fixture.entrantAId),b=table.get(fixture.entrantBId);if(!a||!b)continue;
  let aw=asNumber(fixture.score?.holesWonA),bw=asNumber(fixture.score?.holesWonB);
  if(fixture.score?.method==='concession'){aw=fixture.winnerId===a.entrantId?1:0;bw=fixture.winnerId===b.entrantId?1:0;}
  a.played++;b.played++;a.holesWon+=aw;a.holesLost+=bw;b.holesWon+=bw;b.holesLost+=aw;
  if(fixture.draw){a.drawn++;b.drawn++;a.points+=series.rules.drawPoints;b.points+=series.rules.drawPoints;}
  else if(fixture.winnerId===a.entrantId){a.won++;b.lost++;a.points+=series.rules.winPoints;b.points+=series.rules.lossPoints;}
  else{b.won++;a.lost++;b.points+=series.rules.winPoints;a.points+=series.rules.lossPoints;}
 }
 for(const row of table.values())row.holeDifference=row.holesWon-row.holesLost;
 return[...table.values()].sort((a,b)=>b.points-a.points||b.holeDifference-a.holeDifference||b.holesWon-a.holesWon||b.won-a.won||a.seed-b.seed).map((row,index)=>({...row,position:index+1}));
}

export function groupStageStandings(series){
 if(series?.type!=='group-stage')throw new Error('Group standings require a group-stage series.');
 return series.groups.map(group=>{
  const entrants=group.entrantIds.map(id=>series.entrants.find(item=>item.id===id)).filter(Boolean);
  const fixtures=series.fixtures.filter(item=>item.groupId===group.id);
  return{groupId:group.id,name:group.name,standings:roundRobinStandings({type:'round-robin',entrants,fixtures,rules:series.rules})};
 });
}

/** Builds the planned knockout bracket using group-position placeholders. */
export function groupStageKnockoutPreview(source){
 if(source?.type!=='group-stage')throw new Error('A knockout preview requires a group-stage series.');
 if(source.groups.length%2!==0)throw new Error('Cross-group qualification requires an even number of groups.');
 const pairs=[];
 for(let index=0;index<source.groups.length;index+=2){
  const left=source.groups[index],right=source.groups[index+1];
  for(let rank=0;rank<source.qualifiersPerGroup;rank++){
   const leftPosition={id:`${left.id}-position-${rank+1}`,name:`${left.name} · ${ordinal(rank+1)}`};
   const reverseRank=source.qualifiersPerGroup-rank;
   const rightPosition={id:`${right.id}-position-${reverseRank}`,name:`${right.name} · ${ordinal(reverseRank)}`};
   pairs.push(rank%2===0?[leftPosition,rightPosition]:[rightPosition,leftPosition]);
  }
 }
 const field=pairs.length*2,order=knockoutSeedOrder(field),entrants=[];
 pairs.forEach((pair,index)=>pair.forEach((entrant,side)=>entrants.push({...entrant,seed:order[index*2+side]})));
 const preview=createKnockout({id:`${source.id}-planned-knockout`,name:`${source.name} Knockout`,societyId:source.societyId,entrants,entrantType:source.entrantType,createdAt:source.createdAt,rules:{preview:true,sourceGroupStageId:source.id}});
 preview.fixtures=preview.fixtures.map(fixture=>({...fixture,status:'forecasted'}));
 preview.preview=true;
 return preview;
}

function ordinal(value){
 const remainder=value%100;
 if(remainder>=11&&remainder<=13)return`${value}th`;
 return`${value}${value%10===1?'st':value%10===2?'nd':value%10===3?'rd':'th'}`;
}

/** Converts final group tables into a cross-group knockout (A1 v B2, B1 v A2, and so on). */
export function qualifyGroupStage(source,{id=`${source?.id}-knockout`,name=`${source?.name||'Matchplay'} Knockout`,qualifiedAt=new Date().toISOString()}={}){
 if(source?.type!=='group-stage')throw new Error('Only a group-stage series can be qualified.');
 if(source.fixtures.some(fixture=>fixture.status!=='complete'))throw new Error('Every group-stage fixture must be complete before qualification.');
 if(source.groups.length%2!==0)throw new Error('Cross-group qualification requires an even number of groups.');
 const tables=groupStageStandings(source),pairs=[];
 for(let index=0;index<tables.length;index+=2){
  const left=tables[index].standings,right=tables[index+1].standings;
  for(let rank=0;rank<source.qualifiersPerGroup;rank++){
   const pair=[left[rank],right[source.qualifiersPerGroup-1-rank]];pairs.push(rank%2===0?pair:pair.reverse());
  }
 }
 const field=pairs.length*2,order=knockoutSeedOrder(field),entrantById=new Map(source.entrants.map(item=>[item.id,item])),qualified=[];
 pairs.forEach((pair,index)=>pair.forEach((row,side)=>qualified.push({...entrantById.get(row.entrantId),seed:order[index*2+side],sourceGroupId:tables.find(table=>table.standings.some(item=>item.entrantId===row.entrantId))?.groupId,groupPosition:row.position})));
 const knockout=createKnockout({id,name,societyId:source.societyId,entrants:qualified,entrantType:source.entrantType,createdAt:qualifiedAt,rules:{sourceGroupStageId:source.id,qualifiersPerGroup:source.qualifiersPerGroup}});
 knockout.sourceGroupStageId=source.id;knockout.qualifiedAt=qualifiedAt;return knockout;
}

export function entrantFixtureSummary(series,id){
 const fixtures=(series?.fixtures||[]).filter(fixture=>fixture.entrantAId===id||fixture.entrantBId===id),complete=fixtures.filter(fixture=>TERMINAL.has(fixture.status));
 return{entrantId:id,played:complete.length,remaining:fixtures.length-complete.length,completedFixtures:complete.map(fixture=>fixture.id),remainingFixtures:fixtures.filter(fixture=>!TERMINAL.has(fixture.status)).map(fixture=>fixture.id),playedOpponentIds:complete.map(fixture=>fixture.entrantAId===id?fixture.entrantBId:fixture.entrantAId).filter(Boolean),remainingOpponentIds:fixtures.filter(fixture=>!TERMINAL.has(fixture.status)).map(fixture=>fixture.entrantAId===id?fixture.entrantBId:fixture.entrantAId).filter(Boolean)};
}

