import{competitionCourse}from'./competitionCourse.js';
import{courseHandicap,holeStrokes,scoreCard,whsRound}from'./scoring.js';
import{isEnteredHoleScore,isNoReturnScore}from'./scoreInput.js';

const selectedIndexes=(c,holes)=>c.holesMode==='front9'?holes.map((_,i)=>i).filter(i=>i<9):c.holesMode==='back9'?holes.map((_,i)=>i).filter(i=>i>=9):holes.map((_,i)=>i);
const cardsFor=(c,state)=>(state.cards||[]).filter(card=>card.compId===c.id&&state.players.some(p=>p.id===card.playerId));
const resultLabel=(up,played,total)=>{const left=total-played,decided=played>0&&(left===0||Math.abs(up)>left);if(up===0)return decided?'Match halved':'All Square';return decided&&left>0?`${Math.abs(up)} & ${left}`:`${Math.abs(up)} UP`};

export function teamPlayingHandicap(ids,c,state){
 const{tee,par}=competitionCourse(c,state);const values=ids.map(id=>courseHandicap(state.players.find(p=>p.id===id)?.hi??0,tee,par)).sort((a,b)=>a-b);
 if(!values.length)return 0;
 if(c.format==='foursomes'||c.format==='foursomes-match')return whsRound(values.reduce((a,n)=>a+n,0)*.5);
 if(['greensomes','gruesomes','pinehurst'].includes(c.format))return whsRound((values[0]||0)*.6+(values[1]||0)*.4);
 if(c.format==='pairs-scramble')return whsRound((values[0]||0)*.35+(values[1]||0)*.15);
 return whsRound(values.reduce((a,n)=>a+n,0));
}

export function matchPlayResult(c,state,{stopWhenDecided=true}={}){
 const cards=cardsFor(c,state).slice(0,2);if(cards.length!==2)return null;const{holes}=competitionCourse(c,state);const indexes=selectedIndexes(c,holes);
 const rows=cards.map(card=>scoreCard(card,{...c,format:'stroke',handicapAllowance:100},state));
 const playing=rows.map(r=>r.playingHandicap),low=Math.min(...playing),relativeHandicaps=playing.map(h=>Math.max(0,whsRound((h-low)*((c.handicapAllowance??100)/100))));
 let diff=0;const detail=[];
 for(const i of indexes){const values=cards.map(card=>card.gross?.[i]);if(!values.every(isEnteredHoleScore))break;const nets=values.map((value,j)=>isNoReturnScore(value)?Infinity:Number(value)-holeStrokes(relativeHandicaps[j],holes[i].si));if(nets[0]<nets[1])diff++;if(nets[1]<nets[0])diff--;detail.push({hole:i+1,nets,diff});if(stopWhenDecided&&Math.abs(diff)>indexes.length-detail.length)break}
 const played=detail.length,remaining=indexes.length-played,complete=played>0&&(remaining===0||Math.abs(diff)>remaining);
 return{rows,relativeHandicaps,diff,played,remaining,complete,winner:diff>0?0:diff<0?1:null,label:resultLabel(diff,played,indexes.length),holes:detail};
}

export function skinsResult(c,state){
 const cards=cardsFor(c,state),{holes}=competitionCourse(c,state),indexes=selectedIndexes(c,holes);if(cards.length<2)return{rows:[],played:0,carry:0};
 const results=cards.map(card=>scoreCard(card,{...c,format:'stroke',handicapAllowance:c.handicapAllowance??100},state));const wins=new Map(cards.map(card=>[card.playerId,0]));let carry=0,played=0;
 for(const i of indexes){if(!cards.every(card=>isEnteredHoleScore(card.gross?.[i])))break;played++;carry++;const nets=results.map((r,j)=>isNoReturnScore(cards[j].gross?.[i])?Infinity:r.holes[i].net),best=Math.min(...nets),winners=nets.map((net,j)=>net===best?j:-1).filter(j=>j>=0);if(winners.length===1&&Number.isFinite(best)){const id=cards[winners[0]].playerId;wins.set(id,wins.get(id)+carry);carry=0}}
 const rows=cards.map((card,i)=>({player:state.players.find(p=>p.id===card.playerId),skins:wins.get(card.playerId),complete:results[i].complete,rankValue:wins.get(card.playerId)})).sort((a,b)=>b.skins-a.skins);
 return{rows,played,carry};
}

export function nassauResult(c,state){
 const match=matchPlayResult(c,state,{stopWhenDecided:false});if(!match)return null;const split=holes=>{let up=0;for(const h of holes){if(h.nets[0]<h.nets[1])up++;if(h.nets[1]<h.nets[0])up--}return{up,label:up===0?'Halved':`${Math.abs(up)} UP`,winner:up>0?0:up<0?1:null}};
 const front=split(match.holes.filter(h=>h.hole<=9)),back=split(match.holes.filter(h=>h.hole>=10)),overall=split(match.holes);return{...match,front,back,overall};
}

export function quotaResult(card,c,state){
 const base=c.holesMode==='18'||!c.holesMode?36:18,{holes}=competitionCourse(c,state,card),indexes=selectedIndexes(c,holes);const scored=scoreCard(card,{...c,format:'stableford',handicapAllowance:100},state);let points=0;
 for(const i of indexes){const gross=Number(card.gross?.[i]);if(!gross)continue;const d=gross-holes[i].par;points+=d<=-3?16:d===-2?8:d===-1?4:d===0?2:d===1?1:0}
 const adjustedHandicap=c.holesMode==='18'||!c.holesMode?scored.courseHandicap:scored.courseHandicap/2,quota=Math.max(0,base-adjustedHandicap),rankValue=points-quota;return{...scored,quotaPoints:points,quota,rankValue};
}

export function splitSixesResult(c,state){
 const cards=cardsFor(c,state).slice(0,3);if(cards.length!==3)return{rows:[],played:0};const{holes}=competitionCourse(c,state),indexes=selectedIndexes(c,holes),results=cards.map(card=>scoreCard(card,{...c,format:'stroke',handicapAllowance:100},state)),points=[0,0,0];let played=0;
 for(const i of indexes){if(!cards.every(card=>isEnteredHoleScore(card.gross?.[i])))break;const nets=results.map((r,j)=>isNoReturnScore(cards[j].gross?.[i])?Infinity:r.holes[i].net);played++;const sorted=[...nets].sort((a,b)=>a-b);if(sorted[0]===sorted[2])points.forEach((_,j)=>points[j]+=2);else if(sorted[0]===sorted[1])nets.forEach((n,j)=>points[j]+=n===sorted[0]?3:0);else if(sorted[1]===sorted[2])nets.forEach((n,j)=>points[j]+=n===sorted[0]?4:1);else nets.forEach((n,j)=>points[j]+=n===sorted[0]?4:n===sorted[1]?2:0)}
 return{played,rows:cards.map((card,i)=>({player:state.players.find(p=>p.id===card.playerId),points:points[i],rankValue:points[i],complete:results[i].complete})).sort((a,b)=>b.points-a.points)};
}

export function sharedBallMatchResult(c,state){
 const teams=(c.roundGroups||[]).filter(g=>(g.playerIds||[]).length===2).slice(0,2);if(teams.length!==2)return null;const{holes}=competitionCourse(c,state),indexes=selectedIndexes(c,holes),handicaps=teams.map(team=>Number.isFinite(+team.teamPlayingHandicap)?+team.teamPlayingHandicap:teamPlayingHandicap(team.playerIds,c,state)),low=Math.min(...handicaps),relativeHandicaps=handicaps.map(h=>Math.max(0,h-low));let diff=0;const detail=[];
 for(const i of indexes){const values=teams.map(team=>team.teamGross?.[i]);if(!values.every(isEnteredHoleScore))break;const nets=values.map((value,j)=>isNoReturnScore(value)?Infinity:Number(value)-holeStrokes(relativeHandicaps[j],holes[i].si));if(nets[0]<nets[1])diff++;if(nets[1]<nets[0])diff--;detail.push({hole:i+1,nets,diff});if(Math.abs(diff)>indexes.length-detail.length)break}
 const played=detail.length,remaining=indexes.length-played;return{teams,relativeHandicaps,diff,played,remaining,complete:played>0&&(remaining===0||Math.abs(diff)>remaining),winner:diff>0?0:diff<0?1:null,label:resultLabel(diff,played,indexes.length),holes:detail};
}
