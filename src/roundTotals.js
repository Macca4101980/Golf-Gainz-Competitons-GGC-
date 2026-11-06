import {competitionCourse} from './competitionCourse.js';
import {FORMAT_RULES,scoreCard,formatResult,pairScore,fourballMatchResult,fourballMatchHandicaps,normaliseBlindPairIds} from './scoring.js';
import {winterLeagueTable} from './winterLeague.js';
import {isNoReturnScore} from './scoreInput.js';

const entered=value=>isNoReturnScore(value)||(value!==''&&value!=null&&Number(value)>0);
const individualFormat=format=>['4bbb-stroke','aggregate-stroke','4bbb-match'].includes(format)?'stroke'
 :['4bbb-stableford','aggregate-stableford','blind-pairs'].includes(format)?'stableford':format;

// A read-only projection: never mask the saved cards or change their handicaps.
export function buildRoundTotals(c,state,playerIds){
 const {holes}=competitionCourse(c,state);
 const selected=holes.map((_,i)=>i).filter(i=>c.holesMode==='front9'?i<9:c.holesMode==='back9'?i>=9:true);
 const through=Math.max(1,Math.min(17,Number(c.resultsEmbargo?.visibleThroughHole)||15));
 const provisional=selected.filter(i=>i<through);
 const windows=[...(selected.length>provisional.length&&provisional.length?[{id:'provisional',label:`PROVISIONAL · 1–${through}`,indexes:provisional}]:[]),
  {id:'full',label:c.holesMode==='back9'?'BACK 9 · 10–18':c.holesMode==='front9'?'FRONT 9 · 1–9':`THROUGH ${holes.length}`,indexes:selected}];
 // Nine-hole competitions have just their selected nine, never a spurious 15-hole row.
 if(c.holesMode==='front9'||c.holesMode==='back9')windows.splice(0,windows.length-1);
 const league=(state.leagues||[]).find(l=>l.id===c.leagueId&&(l.teams||[]).length);
 const handicaps=league?Object.assign({},...winterLeagueTable(league,state).table.map(t=>t.weeks.find(w=>w.compId===c.id)?.playerHandicaps||{})):{};
 const matchPairs=c.format==='4bbb-match'&&(c.pairs||[]).length===2?c.pairs:null;
 const matchHandicaps=matchPairs?fourballMatchHandicaps(...matchPairs,c,state):{};
 const format=league?'stableford':individualFormat(c.format);
 const resultsByWindow=windows.map(window=>{
  const indexes=new Set(window.indexes);
  const cards=(state.cards||[]).map(card=>card.compId!==c.id?card:{...card,
   ...(handicaps[card.playerId]?{playingHandicap:handicaps[card.playerId].playingHandicap}:{}),
   ...(matchHandicaps[card.playerId]!=null?{playingHandicap:matchHandicaps[card.playerId]}:{}),
   gross:(card.gross||[]).map((g,i)=>indexes.has(i)?g:''),
   ...(card.eclecticRounds?{eclecticRounds:card.eclecticRounds.map(round=>({...round,gross:(round.gross||[]).map((g,i)=>indexes.has(i)?g:'')}))}:{})});
  const projected={...state,cards};
  const score=id=>{
   const card=cards.find(x=>x.compId===c.id&&x.playerId===id);
   if(!card)return {text:'—',entered:0,total:window.indexes.length};
   const result=scoreCard(card,{...c,format,handicapAllowance:c.handicapAllowance??FORMAT_RULES[c.format]?.defaultAllowance},projected);
   const source=format==='eclectic'?holes.map((_,i)=>Math.min(...(card.eclecticRounds||[]).map(r=>Number(r.gross?.[i])).filter(g=>g>0))):card.gross;
 const count=window.indexes.filter(i=>entered(source?.[i])&&Number.isFinite(Number(source?.[i]))).length;
   // N/R is an entered hole worth zero Stableford points, or a loss against par.
   const nr=window.indexes.filter(i=>isNoReturnScore(source?.[i])).length;
   if(format==='par-bogey')result.bogey-=nr;
   if(format==='modified-stableford')result.modified+=nr*Number(c.modifiedPoints?.double??-3);
   if(format==='max-score')for(const i of window.indexes.filter(i=>isNoReturnScore(source?.[i]))){
    const cap=c.maxScoreMode==='double-par'?holes[i].par*2:c.maxScoreMode==='net-double-bogey'?holes[i].par+2+result.holes[i].shots:Math.max(1,Number(c.maxScore)||8);
    result.net+=cap-result.holes[i].shots;
   }
   return {text:count?formatResult(result,format):'—',entered:count,total:window.indexes.length,result};
  };
  return {window,projected,score};
 });
 const individuals=playerIds.map(id=>({id,name:state.players.find(p=>p.id===id)?.name||'Golfer',scores:resultsByWindow.map(({score})=>score(id))}));
 const roster=league?league.teams.map(t=>({...t,ids:t.memberIds||[]}))
  :c.format==='blind-pairs'?(c.blindDraw?.pairs||[]).map((p,i)=>({id:`blind-${i}`,ids:normaliseBlindPairIds(p),name:p.name}))
  :(c.pairs||[]);
 const teams=roster.filter(t=>(t.ids||[]).some(id=>playerIds.includes(id))).map((team,i)=>({
  id:team.id||`pair-${i}`,name:team.name||`Team ${i+1}`,memberLine:(team.ids||[]).map(id=>state.players.find(p=>p.id===id)?.name||'Golfer').join(' & '),
  scores:resultsByWindow.map(({window,projected})=>{
   const ids=(team.ids||[]).filter(Boolean),cards=ids.map(id=>projected.cards.find(x=>x.compId===c.id&&x.playerId===id));
   const aggregate=['aggregate-stableford','aggregate-stroke','blind-pairs'].includes(c.format)&&!league;
   const count=window.indexes.filter(i=>aggregate?cards.every(card=>entered(card?.gross?.[i])):cards.some(card=>entered(card?.gross?.[i]))).length;
   const anyScores=cards.some(card=>window.indexes.some(i=>entered(card?.gross?.[i])));
   if(!anyScores)return {text:'—',entered:0,total:window.indexes.length};
   if(matchPairs){const match=fourballMatchResult(...matchPairs,c,projected);const up=matchPairs[0]===team?match.up:-match.up;
    return {text:match.played?(up===0?'All square':`${Math.abs(up)} ${up>0?'up':'down'}`):'No holes compared',entered:match.played,total:window.indexes.length};}
   const teamFormat=league?'4bbb-stableford':c.format;
   const result=pairScore({ids},{...c,format:teamFormat},projected);
   const stroke=['4bbb-stroke','aggregate-stroke'].includes(teamFormat);
   const noReturn=stroke&&window.indexes.some(i=>{
    const values=cards.map(card=>card?.gross?.[i]);
    return teamFormat==='aggregate-stroke'?values.some(isNoReturnScore):values.some(isNoReturnScore)&&!values.some(g=>Number(g)>0);
   });
   return {text:noReturn?'N/R':`${stroke?result.net:result.points} ${stroke?'net':'pts'}`,entered:count,total:window.indexes.length};
  })
 }));
 return {windows,individuals,teams,league:!!league};
}
