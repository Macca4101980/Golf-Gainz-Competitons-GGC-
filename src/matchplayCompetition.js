import{matchPlayResult}from'./advancedScoring.js';
import{fourballMatchResult}from'./scoring.js';
import{fixtureResultFromMatchplay,recordFixtureResult}from'./matchplayTournament.js';
import{isMatchplaySeries}from'./matchplaySeriesModel.js';

function fourballFixtureResult(match,entrantAId,entrantBId){
 let holesWonA=0,holesWonB=0;
 for(const hole of match?.holes||[]){if(hole.a<hole.b)holesWonA++;else if(hole.b<hole.a)holesWonB++;}
 return{holesWonA,holesWonB,holesPlayed:match?.holes?.length||0,winnerId:match?.up>0?entrantAId:match?.up<0?entrantBId:null};
}

export function syncMatchplayCompetitionResult(state,competition,{completedAt=new Date().toISOString()}={}){
 if(!competition?.matchplaySeriesId||!competition?.matchplayFixtureId)return state;
 const index=(state.leagues||[]).findIndex(item=>item.id===competition.matchplaySeriesId&&isMatchplaySeries(item));
 if(index<0)return state;
 const record=state.leagues[index],series=record.matchplay,fixture=series.fixtures.find(item=>item.id===competition.matchplayFixtureId);
 if(!fixture||['complete','bye','forecasted'].includes(fixture.status))return state;
 let result=null;
 if(['4bbb-match','fourball-match'].includes(competition.format)){
  const pairs=competition.pairs||[];
  if(pairs.length!==2)return state;
  const match=fourballMatchResult(pairs[0],pairs[1],competition,state);
  if(!match?.decided)return state;
  result=fourballFixtureResult(match,fixture.entrantAId,fixture.entrantBId);
 }else{
  const match=matchPlayResult(competition,state,{stopWhenDecided:false});
  if(!match?.complete)return state;
  result=fixtureResultFromMatchplay(match,fixture.entrantAId,fixture.entrantBId);
 }
 const matchplay=recordFixtureResult(series,fixture.id,{...result,completedAt}),leagues=[...state.leagues];
 leagues[index]={...record,matchplay,updatedAt:completedAt};
 return{...state,leagues};
}
