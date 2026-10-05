import{courseHandicap,playingHandicap,holeStrokes}from'./scoring.js';

export const GROUP_FORMATS=new Set(['scramble','scramble-standard','florida','shamble','best1','best2','best3','cha-cha-cha','irish-fourball','bowmaker','alliance','yellow-ball']);
export const GROUP_FORMAT_RULES={
 scramble:{name:'Texas Scramble',mode:'team-gross',lowerWins:true},
 'scramble-standard':{name:'Scramble',mode:'team-gross',lowerWins:true},
 florida:{name:'Florida Scramble',mode:'team-gross',lowerWins:true},
 shamble:{name:'Shamble',mode:'stableford-combine',count:2,lowerWins:false},
 best1:{name:'Best 1',mode:'stableford-combine',count:1,lowerWins:false},
 best2:{name:'Best 2',mode:'stableford-combine',count:2,lowerWins:false},
 best3:{name:'Best 3',mode:'stableford-combine',count:3,lowerWins:false},
 'cha-cha-cha':{name:'Cha Cha Cha',mode:'stableford-combine',countByHole:i=>(i%3)+1,lowerWins:false},
 'irish-fourball':{name:'Irish Fourball',mode:'stableford-combine',countByHole:i=>i<6?1:i<12?2:i<17?3:4,lowerWins:false},
 bowmaker:{name:'Bowmaker',mode:'stableford-combine',count:2,lowerWins:false},
 alliance:{name:'Alliance',mode:'stableford-combine',count:2,lowerWins:false},
 'yellow-ball':{name:'Yellow Ball',mode:'yellow-ball',lowerWins:false}
};
export function isGroupFormat(format){return GROUP_FORMATS.has(format)}
export function stablefordPoints(gross,par,shots){return gross>0?Math.max(0,2+(par+shots-gross)):0}
function selectedIndexes(c,hs){return c.holesMode==='front9'?[0,1,2,3,4,5,6,7,8]:c.holesMode==='back9'?[9,10,11,12,13,14,15,16,17]:hs.map((_,i)=>i)}
function courseData(c,state){const course=(state.courses||[]).find(x=>x.id===c.course);const tee=course?.tees?.find(t=>t.name===c.tee);const holes=tee?.holes||[];const par=holes.reduce((n,h)=>n+(+h.par||0),0)||72;return{course,tee,holes,par}}
function cardFor(state,c,id){return(state.cards||[]).find(x=>x.compId===c.id&&x.playerId===id)}
function playerHole(state,c,id,h,i,tee,par){const p=(state.players||[]).find(x=>x.id===id);const card=cardFor(state,c,id);const allowance=c.handicapAllowance??95;const ph=card?.playingHandicap??playingHandicap(card?.handicapIndexUsed??p?.hi??0,tee,par,allowance);const gross=+(card?.gross?.[i]||0),shots=holeStrokes(ph,h.si);return{id,name:p?.name||'Golfer',gross,shots,net:gross?gross-shots:null,points:stablefordPoints(gross,h.par,shots)}}
export function scrambleTeamHandicap(playerIds,c,state){const{tee,par}=courseData(c,state);const hs=playerIds.map(id=>{const p=(state.players||[]).find(x=>x.id===id);return courseHandicap(p?.hi??0,tee,par)}).sort((a,b)=>a-b);const pct=hs.length>=4?[.25,.20,.15,.10]:hs.length===3?[.30,.20,.10]:hs.length===2?[.35,.15]:[1];return hs.reduce((n,h,i)=>n+h*(pct[i]??0),0)}
export function groupScore(group,c,state){
 const ids=[...(group?.playerIds||group?.ids||[])].filter(Boolean);const rule=GROUP_FORMAT_RULES[c.format];if(!rule)return null;const{holes,tee,par}=courseData(c,state);const selected=selectedIndexes(c,holes);
 if(rule.mode==='team-gross'){const gross=group?.teamGross||[];const rawHcap=Number.isFinite(+group?.teamPlayingHandicap)?+group.teamPlayingHandicap:scrambleTeamHandicap(ids,c,state);const teamHcap=Math.round(rawHcap);let grossTotal=0,played=0;const detail=holes.map((h,i)=>{if(!selected.includes(i))return null;const g=+(gross[i]||0);if(!g)return{hole:i+1,gross:0,net:null};grossTotal+=g;played++;return{hole:i+1,gross:g,net:g}});return{playerIds:ids,holes:detail,gross:grossTotal,teamHandicap:teamHcap,net:grossTotal-teamHcap,points:0,complete:played,rankValue:grossTotal-teamHcap,lowerWins:true}}
 let total=0,played=0;const detail=holes.map((h,i)=>{if(!selected.includes(i))return null;const rows=ids.map(id=>playerHole(state,c,id,h,i,tee,par));if(!rows.some(r=>r.gross>0))return{hole:i+1,points:0,counted:[],players:rows};let counted=[];
 if(rule.mode==='yellow-ball'){const yellowIndex=i%Math.max(1,ids.length),yellow=rows[yellowIndex],others=rows.filter((_,x)=>x!==yellowIndex&&_.gross>0).sort((a,b)=>b.points-a.points);counted=[yellow,...others.slice(0,1)].filter(r=>r?.gross>0)}
 else{const count=rule.countByHole?rule.countByHole(i):(c.groupScoresCount??rule.count??2);counted=rows.filter(r=>r.gross>0).sort((a,b)=>b.points-a.points).slice(0,count)}
 const pts=counted.reduce((n,r)=>n+r.points,0);total+=pts;played++;return{hole:i+1,points:pts,counted:counted.map(r=>r.id),yellowBallId:rule.mode==='yellow-ball'?ids[i%Math.max(1,ids.length)]:null,players:rows}});
 return{playerIds:ids,holes:detail,points:total,complete:played,rankValue:total,lowerWins:false}
}
export function groupLeaderboard(c,state){return(c.roundGroups||[]).map(g=>({...groupScore(g,c,state),groupId:g.id,name:g.name||((g.playerIds||[]).map(id=>(state.players||[]).find(p=>p.id===id)?.name?.split(' ')[0]).filter(Boolean).join(' · ')||'Group')})).filter(r=>r.complete>0).sort((a,b)=>a.lowerWins?a.rankValue-b.rankValue:b.rankValue-a.rankValue)}
