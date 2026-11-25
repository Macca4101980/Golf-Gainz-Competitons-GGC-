import{matchPlayResult}from'./advancedScoring.js';
import{fourballMatchResult}from'./scoring.js';
import{fixtureResultFromMatchplay,nextKnockoutLeg,recordFixtureResult,recordKnockoutLeg}from'./matchplayTournament.js';

function fourballFixtureResult(match,entrantAId,entrantBId){
 let holesWonA=0,holesWonB=0;
 for(const hole of match?.holes||[]){if(hole.a<hole.b)holesWonA++;else if(hole.b<hole.a)holesWonB++;}
 return{holesWonA,holesWonB,holesPlayed:match?.holes?.length||0,winnerId:match?.up>0?entrantAId:match?.up<0?entrantBId:null};
}

export function syncMatchplayCompetitionResult(state,competition,{completedAt=new Date().toISOString()}={}){
 if(!competition?.matchplaySeriesId||!competition?.matchplayFixtureId)return state;
 const index=(state.leagues||[]).findIndex(item=>item.id===competition.matchplaySeriesId&&item.recordType==='matchplay-series'&&item.matchplay);
 if(index<0)return state;
 const record=state.leagues[index],series=record.matchplay,fixture=series.fixtures.find(item=>item.id===competition.matchplayFixtureId);
 if(!fixture||!['scheduled','live'].includes(fixture.status))return state;
 const leg = competition.matchplayLeg || null;
 if (nextKnockoutLeg(series, fixture) !== leg || (leg && competition.holesMode && competition.holesMode !== "18")) return state;
 let result=null;
 if(['4bbb-match','fourball-match'].includes(competition.format)){
  const pairs=competition.pairs||[];
  if(pairs.length!==2)return state;
  const match=fourballMatchResult(pairs[0],pairs[1],competition,state);
  if(!match?.decided)return state;
  result=fourballFixtureResult(match,fixture.entrantAId,fixture.entrantBId);
 }else{
  const scoringState = leg ? {...state, cards: [...state.cards].sort((a,b) =>
    competition.entries.indexOf(a.playerId) - competition.entries.indexOf(b.playerId))} : state;
  const match=matchPlayResult(competition,scoringState,{stopWhenDecided:false});
  if(!match?.complete)return state;
  result=fixtureResultFromMatchplay(match,fixture.entrantAId,fixture.entrantBId);
 }
 const matchplay=leg
  ?recordKnockoutLeg(series,fixture.id,leg,{...result,completedAt})
  :recordFixtureResult(series,fixture.id,{...result,completedAt});
 const leagues=[...state.leagues];
 leagues[index]={...record,matchplay,updatedAt:completedAt};
 return{...state,leagues};
}
