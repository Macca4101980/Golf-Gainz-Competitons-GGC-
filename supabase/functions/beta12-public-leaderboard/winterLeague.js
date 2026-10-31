import{playingHandicap,scoreCard,whsRound}from'./scoring.js';
import{competitionCourse}from'./competitionCourse.js';

export const WL_DEFAULTS={mode:'team',allowance:90,bestCount:8,target:36,netParTarget:0,cutPerPoint:.5,giveBackPerPoint:0,direction:'down',teamAdjustment:'split',adjustFromNext:true,lockStartingHandicaps:true};

export function leagueCompetitionLifecycle(comp,now=new Date()){
 if(comp?.status==='cancelled')return'cancelled';
 if(comp?.status==='draft')return'draft';
 const at=now instanceof Date?now.getTime():new Date(now).getTime();
 const starts=comp?.starts?new Date(comp.starts).getTime():NaN;
 const ends=comp?.ends?new Date(comp.ends).getTime():NaN;
 if(Number.isFinite(ends)&&Number.isFinite(at)&&at>=ends)return'closed';
 if(Number.isFinite(starts)&&Number.isFinite(at))return at>=starts?'live':'scheduled';
 return comp?.status==='completed'?'closed':'scheduled';
}

export function leagueHandicapSettings(league){
 const legacy=league?.wlSettings||{};
 return{...WL_DEFAULTS,...legacy,...(league?.handicapSettings||{}),
  target:+(league?.handicapSettings?.target??legacy.target??((legacy.cutStart??37)-1)??36),
  cutPerPoint:+(league?.handicapSettings?.cutPerPoint??legacy.cutPerPoint??.5),
  allowance:+(league?.handicapSettings?.allowance??legacy.allowance??90)}
}
function compCourse(c,state,card){return competitionCourse(c,state,card)}
export function handicapAdjustment(score,settings=WL_DEFAULTS){
 if(!Number.isFinite(score)||settings.mode==='fixed'||settings.mode==='manual')return 0;
 const target=+(settings.target??36),buffer=+(settings.netParTarget??0),above=score-target-buffer,cut=+(settings.cutPerPoint??0),back=+(settings.giveBackPerPoint??0);
 if(above>0)return -(above*cut);
 if(above<0&&settings.direction==='both')return Math.abs(above)*back;
 return 0
}
export function wlCutForScore(score,settings=WL_DEFAULTS){return Math.max(0,-handicapAdjustment(score,{...settings,mode:'team',direction:'down'}))}
function manualFor(league,playerId,throughDate){return(league?.manualHandicapAdjustments||[]).filter(x=>x.playerId===playerId&&(!throughDate||!x.effectiveFrom||new Date(x.effectiveFrom)<=new Date(throughDate))).reduce((a,x)=>a+(+x.shots||0),0)}
function leagueBaseHi(league,player,c,settings){if(!settings.lockStartingHandicaps)return player?.hi;const snap=league?.startingHandicaps||{};return Number.isFinite(+snap[player?.id])?+snap[player.id]:player?.hi}
export function leagueHandicapForWeek(playerId,c,state,adjustment=0,settings=WL_DEFAULTS,league={}){const player=(state.players||[]).find(p=>p.id===playerId);const card=(state.cards||[]).find(x=>x.compId===c.id&&x.playerId===playerId);const{tee,par}=compCourse(c,state,card);const handicapIndex=Number(card?.handicapIndexUsed??leagueBaseHi(league,player,c,settings))||0;const basePlayingHandicap=playingHandicap(handicapIndex,tee,par,settings.allowance);return{handicapIndex,basePlayingHandicap,playingHandicap:whsRound(basePlayingHandicap+(Number(adjustment)||0)),adjustment:Number(adjustment)||0,tee:card?.tee||c.tee||tee?.name||''}}
function adjustedCard(card,player,c,state,adjustment,settings,league){const h=leagueHandicapForWeek(player?.id,c,state,adjustment,settings,league);return{...card,playingHandicap:h.playingHandicap,courseHandicap:card?.courseHandicap}}
function playerResult(id,c,state,adjustment,settings,league){const player=(state.players||[]).find(p=>p.id===id);const card=(state.cards||[]).find(x=>x.compId===c.id&&x.playerId===id);if(!card)return null;return{...scoreCard(adjustedCard(card,player,c,state,adjustment,settings,league),{...c,format:'stableford',handicapAllowance:settings.allowance},state),playerId:id}}
function betterBall(ids,c,state,adjustments,settings,league){const results=ids.map(id=>playerResult(id,c,state,adjustments[id]||0,settings,league)).filter(Boolean);if(!results.length)return null;const n=Math.max(...results.map(r=>r.holes.length));const holes=[];let points=0;for(let i=0;i<n;i++){const vals=results.map(r=>r.holes[i]).filter(h=>h?.gross>0).map(h=>h.points);const v=vals.length?Math.max(...vals):null;holes.push(v);if(v!=null)points+=v}return{points,holes,playersPlayed:results.length,complete:holes.filter(v=>v!=null).length,playerResults:results}}
function countbackKey(holes){const sum=n=>(holes||[]).slice(-n).reduce((a,v)=>a+(v||0),0);return[sum(9),sum(6),sum(3),sum(1)]}
function compareWeek(a,b){if(b.points!==a.points)return b.points-a.points;const ak=countbackKey(a.holes),bk=countbackKey(b.holes);for(let i=0;i<ak.length;i++)if(bk[i]!==ak[i])return bk[i]-ak[i];return 0}
export function winterLeagueTable(league,state,at=new Date()){
 const nowTime=at instanceof Date?at.getTime():new Date(at).getTime();
 const settings=leagueHandicapSettings(league);const scheduled=(state.comps||[]).filter(c=>c.leagueId===league.id).sort((a,b)=>new Date(a.starts||0)-new Date(b.starts||0));const weekNumbers=new Map(scheduled.map((c,i)=>[c.id,i+1]));const comps=scheduled.filter(c=>c.status!=='cancelled');
 const teams=(league.teams||[]).map(t=>({...t,weeks:[],adjustments:Object.fromEntries((t.memberIds||[]).map(id=>[id,Number(manualFor(league,id,comps[0]?.starts))||0]))}));
 const weekly=[];
 for(const c of comps){const embargo=c.resultsEmbargo;const now=nowTime;const provisional=!!(embargo?.enabled&&embargo.releaseAt&&now<new Date(embargo.releaseAt).getTime());const provisionalAt=embargo?.provisionalAt?new Date(embargo.provisionalAt).getTime():NaN;const resultsHidden=!!(provisional&&Number.isFinite(provisionalAt)&&now<provisionalAt);const through=Math.max(1,Math.min(17,Number(embargo?.visibleThroughHole)||15));const scoringState=provisional?{...state,cards:(state.cards||[]).map(card=>card.compId===c.id?{...card,gross:(card.gross||[]).map((g,i)=>i<through?g:'')}:card)}:state;const rows=[];for(const t of teams){const before={...t.adjustments};const playerHandicaps=Object.fromEntries((t.memberIds||[]).map(id=>[id,leagueHandicapForWeek(id,c,state,before[id]||0,settings,league)]));const historical=Number.isFinite(c?.historicalTeamScores?.[t.id])?{points:+c.historicalTeamScores[t.id],holes:[],playersPlayed:+c.historicalTeamScores[t.id]>0?2:0,complete:+c.historicalTeamScores[t.id]>0?18:0,playerResults:[]}:null;const r=resultsHidden?null:(historical||betterBall(t.memberIds||[],c,scoringState,t.adjustments,settings,league));if(r){
   const changes={};if(settings.mode==='team'){const d=handicapAdjustment(r.points,settings),ids=t.memberIds||[],perPlayer=settings.teamAdjustment==='each'?d:(ids.length?d/ids.length:d);for(const id of ids)changes[id]=perPlayer}
   else if(settings.mode==='individual'){for(const pr of r.playerResults){const id=pr.playerId;changes[id]=handicapAdjustment(pr.points,settings)}}
   else for(const id of t.memberIds||[])changes[id]=0;
   for(const id of t.memberIds||[])t.adjustments[id]=(t.adjustments[id]||0)+(changes[id]||0);
   const vals=Object.values(changes);const displayChange=vals.length?Math.min(...vals):0;const w={compId:c.id,weekNumber:weekNumbers.get(c.id),name:c.name,date:c.starts,points:r.points,provisional,holes:r.holes,playersPlayed:r.playersPlayed,complete:r.complete,change:displayChange,cut:Math.max(0,-displayChange),beforeAdjustments:before,afterAdjustments:{...t.adjustments},playerHandicaps,playerResults:r.playerResults};t.weeks.push(w);rows.push({teamId:t.id,teamName:t.name,badgeImage:t.badgeImage||null,...w})
  }else t.weeks.push({compId:c.id,weekNumber:weekNumbers.get(c.id),name:c.name,date:c.starts,points:null,holes:[],playersPlayed:0,complete:0,change:0,cut:0,beforeAdjustments:before,afterAdjustments:{...t.adjustments},playerHandicaps});
 }rows.sort(compareWeek);rows.forEach((r,i)=>r.position=i+1);weekly.push({comp:c,weekNumber:weekNumbers.get(c.id),rows,resultsHidden})}
 const hasLeagueBest=Object.prototype.hasOwnProperty.call(league?.oomSettings||{},'bestCount');const configuredBest=Math.max(0,Number(league?.oomSettings?.bestCount)||0);const requestedBest=hasLeagueBest?(configuredBest||comps.length):+(settings.bestCount??8);const bestCount=Math.min(requestedBest,comps.length);const table=teams.map(t=>{const scored=t.weeks.filter(w=>!w.provisional&&Number.isFinite(w.points));const counting=[...scored].sort((a,b)=>b.points-a.points).slice(0,bestCount);const total=counting.reduce((a,w)=>a+w.points,0);const countingIds=new Set(counting.map(w=>w.compId));const vals=Object.values(t.adjustments||{});const finalCut=vals.length?Math.max(0,-Math.min(...vals)):0;const provisionalCut=t.weeks.some(w=>w.provisional&&w.cut>0);return{...t,total,counting,countingIds,played:scored.length,finalCut,provisionalCut,finalAdjustments:{...t.adjustments}}});
 table.sort((a,b)=>{if(b.total!==a.total)return b.total-a.total;const ac=[...a.counting].sort((x,y)=>new Date(x.date||0)-new Date(y.date||0)),bc=[...b.counting].sort((x,y)=>new Date(x.date||0)-new Date(y.date||0));for(const n of [3,2,1]){const av=ac.slice(-n).reduce((s,w)=>s+w.points,0),bv=bc.slice(-n).reduce((s,w)=>s+w.points,0);if(bv!==av)return bv-av}return a.name.localeCompare(b.name)});table.forEach((r,i)=>r.position=r.played?i+1:null);
 return{settings,comps,weekly,table,bestCount}
}
