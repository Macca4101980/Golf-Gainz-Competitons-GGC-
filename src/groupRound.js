import {GROUP_FORMAT_RULES} from './groupScoring.js';
import {isEnteredHoleScore} from './scoreInput.js';

export const ENABLED_TEAM_STABLEFORD=['best1','best2','best3','cha-cha-cha'];
export const SELECTED_DRIVE_FORMATS=new Set(['scramble','scramble-standard','pairs-scramble','florida','shamble','greensomes','gruesomes','pinehurst']);
export const TEE_ORDER_FORMATS=new Set(['foursomes','foursomes-match']);
export function groupMinimumPlayers(format){return format==='irish-fourball'?4:['best3','cha-cha-cha','florida'].includes(format)?3:2;}
export function groupStartError({c,ids,me,admin=false,memberIds=[],saved=null}){
 const players=ids.filter(Boolean);
 if(new Set(players).size!==players.length)return 'Choose each golfer only once.';
 const min=groupMinimumPlayers(c.format);
 if(['pairs-scramble','foursomes','greensomes','gruesomes','pinehurst','foursomes-match'].includes(c.format)&&players.length!==2)return 'This pairs format needs exactly two golfers.';
 if(players.length<min||players.length>4)return `This format needs ${min}–4 golfers.`;
 if(!admin&&!players.includes(me.id))return 'Your playing group must include you.';
 if(!admin&&players.some(id=>id!==me.id&&!memberIds.includes(id)))return 'Choose golfers who belong to this group.';
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
 if(c.trackSelectedDrives===true&&SELECTED_DRIVE_FORMATS.has(c.format)){
  const missing=holes.filter(i=>!(group?.selectedDrivePlayerIds||[])[i]).length;
  if(missing)return `Choose whose drive was selected on ${missing} competition hole${missing===1?'':'s'} before submitting.`;
  const minimum=Math.max(0,+c.minimumDrivesPerPlayer||0);
  if(minimum){
   const counts=Object.fromEntries((group?.playerIds||[]).map(id=>[id,0]));
   holes.forEach(i=>{const id=group?.selectedDrivePlayerIds?.[i];if(id in counts)counts[id]++});
   const short=(group?.playerIds||[]).find(id=>(counts[id]||0)<minimum);
   if(short)return `${state.players.find(p=>p.id===short)?.name||'A golfer'} needs ${minimum-(counts[short]||0)} more selected drive${minimum-(counts[short]||0)===1?'':'s'} to meet the competition minimum.`;
  }
 }
 if(c.trackTeeOrder===true&&TEE_ORDER_FORMATS.has(c.format)&&!group?.firstTeePlayerId)return 'Choose who drives the first hole before submitting.';
 if(GROUP_FORMAT_RULES[c.format]?.mode==='team-gross'){
  const missing=holes.filter(i=>!isEnteredHoleScore(group?.teamGross?.[i])).length;
  return missing ? 'Enter a team score or N/R for every competition hole before submitting.' : null;
 }
 for(const id of group?.playerIds||[]){
  const card=(state.cards||[]).find(x=>x.compId===c.id&&x.playerId===id);
  const missing=holes.filter(i=>!isEnteredHoleScore(card?.gross?.[i])).length;
  if(missing)return `${state.players.find(p=>p.id===id)?.name||'A golfer'} has ${missing} unplayed hole${missing===1?'':'s'}. Enter a score or N/R for every competition hole before submitting.`;
 }
 return null;
}
