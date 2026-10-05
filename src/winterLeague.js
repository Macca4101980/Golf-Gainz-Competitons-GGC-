import{playingHandicap,scoreCard,whsRound}from'./scoring.js';

export const WL_DEFAULTS={mode:'team',allowance:90,bestCount:8,target:36,netParTarget:0,cutPerPoint:.5,giveBackPerPoint:0,direction:'down',teamAdjustment:'split',adjustFromNext:true,lockStartingHandicaps:true};

export function leagueHandicapSettings(league){
 const legacy=league?.wlSettings||{};
 return{...WL_DEFAULTS,...legacy,...(league?.handicapSettings||{}),
  target:+(league?.handicapSettings?.target??legacy.target??((legacy.cutStart??37)-1)??36),
  cutPerPoint:+(league?.handicapSettings?.cutPerPoint??legacy.cutPerPoint??.5),
  allowance:+(league?.handicapSettings?.allowance??legacy.allowance??90)}
}
function compCourse(c,state){const course=(state.courses||[]).find(x=>x.id===c.course);const tee=course?.tees?.find(t=>t.name===c.tee);const par=(tee?.holes||[]).reduce((a,h)=>a+(+h.par||0),0)||72;return{course,tee,par}}
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
function adjustedCard(card,player,c,state,adjustment,settings,league){const{tee,par}=compCourse(c,state);const base=playingHandicap(card?.handicapIndexUsed??leagueBaseHi(league,player,c,settings),tee,par,settings.allowance);const effective=whsRound(base+adjustment);return{...card,playingHandicap:effective,courseHandicap:card?.courseHandicap}}
function playerResult(id,c,state,adjustment,settings,league){const player=(state.players||[]).find(p=>p.id===id);const card=(state.cards||[]).find(x=>x.compId===c.id&&x.playerId===id);if(!card)return null;return{...scoreCard(adjustedCard(card,player,c,state,adjustment,settings,league),{...c,format:'stableford',handicapAllowance:settings.allowance},state),playerId:id}}
function betterBall(ids,c,state,adjustments,settings,league){const results=ids.map(id=>playerResult(id,c,state,adjustments[id]||0,settings,league)).filter(Boolean);if(!results.length)return null;const n=Math.max(...results.map(r=>r.holes.length));const holes=[];let points=0;for(let i=0;i<n;i++){const vals=results.map(r=>r.holes[i]).filter(h=>h?.gross>0).map(h=>h.points);const v=vals.length?Math.max(...vals):null;holes.push(v);if(v!=null)points+=v}return{points,holes,playersPlayed:results.length,complete:holes.filter(v=>v!=null).length,playerResults:results}}
function countbackKey(holes){const sum=n=>(holes||[]).slice(-n).reduce((a,v)=>a+(v||0),0);return[sum(9),sum(6),sum(3),sum(1)]}
function compareWeek(a,b){if(b.points!==a.points)return b.points-a.points;const ak=countbackKey(a.holes),bk=countbackKey(b.holes);for(let i=0;i<ak.length;i++)if(bk[i]!==ak[i])return bk[i]-ak[i];return 0}
export function winterLeagueTable(league,state){
 const settings=leagueHandicapSettings(league);const comps=(state.comps||[]).filter(c=>c.leagueId===league.id&&c.status!=='cancelled').sort((a,b)=>new Date(a.starts||0)-new Date(b.starts||0));
 const teams=(league.teams||[]).map(t=>({...t,weeks:[],adjustments:Object.fromEntries((t.memberIds||[]).map(id=>[id,Number(manualFor(league,id,comps[0]?.starts))||0]))}));
 const weekly=[];
 for(const c of comps){const rows=[];for(const t of teams){const before={...t.adjustments};const historical=Number.isFinite(c?.historicalTeamScores?.[t.id])?{points:+c.historicalTeamScores[t.id],holes:[],playersPlayed:+c.historicalTeamScores[t.id]>0?2:0,complete:+c.historicalTeamScores[t.id]>0?18:0,playerResults:[]}:null;const r=historical||betterBall(t.memberIds||[],c,state,t.adjustments,settings,league);if(r){
   const changes={};if(settings.mode==='team'){const d=handicapAdjustment(r.points,settings),ids=t.memberIds||[],perPlayer=settings.teamAdjustment==='each'?d:(ids.length?d/ids.length:d);for(const id of ids)changes[id]=perPlayer}
   else if(settings.mode==='individual'){for(const pr of r.playerResults){const id=pr.playerId;changes[id]=handicapAdjustment(pr.points,settings)}}
   else for(const id of t.memberIds||[])changes[id]=0;
   for(const id of t.memberIds||[])t.adjustments[id]=(t.adjustments[id]||0)+(changes[id]||0);
   const vals=Object.values(changes);const displayChange=vals.length?Math.min(...vals):0;const w={compId:c.id,name:c.name,date:c.starts,points:r.points,holes:r.holes,playersPlayed:r.playersPlayed,complete:r.complete,change:displayChange,cut:Math.max(0,-displayChange),beforeAdjustments:before,afterAdjustments:{...t.adjustments},playerResults:r.playerResults};t.weeks.push(w);rows.push({teamId:t.id,teamName:t.name,badgeImage:t.badgeImage||null,...w})
  }else t.weeks.push({compId:c.id,name:c.name,date:c.starts,points:null,holes:[],playersPlayed:0,complete:0,change:0,cut:0,beforeAdjustments:before,afterAdjustments:{...t.adjustments}});
 }rows.sort(compareWeek);rows.forEach((r,i)=>r.position=i+1);weekly.push({comp:c,rows})}
 const hasLeagueBest=Object.prototype.hasOwnProperty.call(league?.oomSettings||{},'bestCount');const configuredBest=Math.max(0,Number(league?.oomSettings?.bestCount)||0);const requestedBest=hasLeagueBest?(configuredBest||comps.length):+(settings.bestCount??8);const bestCount=Math.min(requestedBest,comps.length);const table=teams.map(t=>{const scored=t.weeks.filter(w=>Number.isFinite(w.points));const counting=[...scored].sort((a,b)=>b.points-a.points).slice(0,bestCount);const total=counting.reduce((a,w)=>a+w.points,0);const countingIds=new Set(counting.map(w=>w.compId));const vals=Object.values(t.adjustments||{});const finalCut=vals.length?Math.max(0,-Math.min(...vals)):0;return{...t,total,counting,countingIds,played:scored.length,finalCut,finalAdjustments:{...t.adjustments}}});
 table.sort((a,b)=>{if(b.total!==a.total)return b.total-a.total;const ac=[...a.counting].sort((x,y)=>new Date(x.date||0)-new Date(y.date||0)),bc=[...b.counting].sort((x,y)=>new Date(x.date||0)-new Date(y.date||0));for(const n of [3,2,1]){const av=ac.slice(-n).reduce((s,w)=>s+w.points,0),bv=bc.slice(-n).reduce((s,w)=>s+w.points,0);if(bv!==av)return bv-av}return a.name.localeCompare(b.name)});table.forEach((r,i)=>r.position=r.played?i+1:null);
 return{settings,comps,weekly,table,bestCount}
}
