import {winterLeagueTable} from './winterLeague.js';

export function publicVisibility(c,now=Date.now()){
 const e=c?.resultsEmbargo,release=Date.parse(e?.releaseAt);
 if(e?.enabled&&(!Number.isFinite(release)||(e.provisionalAt&&!Number.isFinite(Date.parse(e.provisionalAt)))))return {provisional:true,visibleThrough:0};
 const provisional=!!(e?.enabled&&Number.isFinite(release)&&now<release),at=Date.parse(e?.provisionalAt);
 return {provisional,visibleThrough:provisional?(Number.isFinite(at)&&now<at?0:Math.max(1,Math.min(17,Number(e.visibleThroughHole)||15))):18};
}

// One display projection for the app and public page; official scoring stays separate.
export function leagueDisplayTable(league,state,now=Date.now()){
 const visibility=new Map((state.comps||[]).filter(c=>c.leagueId===league.id).map(c=>[c.id,publicVisibility(c,now)]));
 const masked={...state,cards:(state.cards||[]).map(card=>{
  const view=visibility.get(card.compId);
  return view?.provisional?{...card,gross:(card.gross||[]).map((v,i)=>i<view.visibleThrough?v:'')}:card;
 })};
 const result=winterLeagueTable(league,masked,new Date(now));
 const blocked=new Set([...visibility].filter(([,v])=>v.provisional).map(([id])=>id));
 if(blocked.size){
  result.table=result.table.map(team=>{
   const visible=team.weeks.filter(w=>visibility.get(w.compId)?.visibleThrough!==0&&Number.isFinite(w.points));
   const counting=[...visible].sort((a,b)=>b.points-a.points).slice(0,result.bestCount);
   const official=team.weeks.filter(w=>!blocked.has(w.compId)&&Number.isFinite(w.points));
   return {...team,total:counting.reduce((n,w)=>n+w.points,0),played:visible.length,counting,countingIds:new Set(counting.map(w=>w.compId)),finalCut:Math.max(0,...official.map(w=>w.cut||0))};
  });
  result.table.sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
  result.table.forEach((team,i)=>{team.position=team.played?i+1:null});
 }
 result.weekly=result.weekly.map(w=>({...w,provisional:visibility.get(w.comp.id)?.provisional===true}));
 result.provisional=result.weekly.some(w=>w.provisional&&w.rows.some(r=>r.complete>0));
 result.visibleThrough=result.provisional?Math.min(...result.weekly.filter(w=>w.provisional&&w.rows.some(r=>r.complete>0)).map(w=>visibility.get(w.comp.id).visibleThrough)):18;
 return result;
}
