import {isEnteredHoleScore} from './scoreInput.js';

export const ENABLED_TEAM_STABLEFORD=['best1','best2','best3','cha-cha-cha'];
export function groupMinimumPlayers(format){return ['best3','cha-cha-cha'].includes(format)?3:2;}
export function groupStartError({c,ids,me,admin=false,saved=null}){
 const players=ids.filter(Boolean);
 if(new Set(players).size!==players.length)return 'Choose each golfer only once.';
 const min=groupMinimumPlayers(c.format);
 if(players.length<min||players.length>4)return `This format needs ${min}–4 golfers.`;
 if(!admin&&!players.includes(me.id))return 'Your playing group must include you.';
 if(!admin&&players.some(id=>id!==me.id&&!(c.entries||[]).includes(id)))return 'Ask the other golfers to enter this competition before adding them to your playing group.';
 const other=(c.roundGroups||[]).find(g=>g.id!==saved?.id&&(g.playerIds||[]).some(id=>players.includes(id)));
 if(other)return 'A selected golfer already belongs to another playing group. Open that existing round instead.';
 return null;
}

export function groupHasScores(group,c,state){
 return (group?.teamGross||[]).some(isEnteredHoleScore)||(state.cards||[]).some(card=>card.compId===c.id&&(group?.playerIds||[]).includes(card.playerId)&&(card.gross||[]).some(isEnteredHoleScore));
}

/** Members may update participation only; preserve every competition setting. */
export function groupCompetitionUpdate(c,patch,{admin=false,now}={}){
 return {...c,...patch,...(admin?{updatedAt:now}: {})};
}

export function groupSubmissionError(group,c,state){
 const holes=c.holesMode==='front9'?Array.from({length:9},(_,i)=>i):c.holesMode==='back9'?Array.from({length:9},(_,i)=>i+9):Array.from({length:18},(_,i)=>i);
 for(const id of group?.playerIds||[]){
  const card=(state.cards||[]).find(x=>x.compId===c.id&&x.playerId===id);
  const missing=holes.filter(i=>!isEnteredHoleScore(card?.gross?.[i])).length;
  if(missing)return `${state.players.find(p=>p.id===id)?.name||'A golfer'} has ${missing} unplayed hole${missing===1?'':'s'}. Enter a score or N/R for every competition hole before submitting.`;
 }
 return null;
}
