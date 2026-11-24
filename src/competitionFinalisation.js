import {isEnteredHoleScore} from './scoreInput.js';

const FORMAT_AWARE_ONLY=new Set([
  'eclectic','matchplay','4bbb-match','fourball-match','foursomes-match',
  'skins','nassau','sixes','quota','flag',
  'foursomes','greensomes','gruesomes','pinehurst',
  'scramble','scramble-standard','pairs-scramble','florida','shamble',
]);

export function activeHoleIndexes(c,length=18){
 const size=Math.max(0,Number(length)||18);
 if(c?.holesMode==='front9')return Array.from({length:Math.min(9,size)},(_,i)=>i);
 if(c?.holesMode==='back9')return Array.from({length:Math.max(0,Math.min(18,size)-9)},(_,i)=>i+9);
 return Array.from({length:size},(_,i)=>i);
}

function generatedSet(card){
 return new Set([...(card?.generatedNoReturnHoles||[]),...(card?.autoNoReturnHoles||[])]
  .map(Number).filter(Number.isInteger));
}

/** True only when a golfer entered a score/N/R, never because GGC filled a blank at closure. */
export function cardHasPlayerActivity(card,c){
 const generated=generatedSet(card),gross=card?.gross||[];
 return activeHoleIndexes(c,gross.length||18).some(i=>!generated.has(i)&&isEnteredHoleScore(gross[i]));
}

export function pairHasPlayerActivity(pair,c,state){
 const ids=pair?.ids||pair||[];
 return ids.some(id=>(state?.cards||[]).some(card=>card.compId===c?.id&&card.playerId===id&&cardHasPlayerActivity(card,c)));
}

export function activePairField(pairs,c,state){
 const activePairs=(pairs||[]).filter(pair=>pairHasPlayerActivity(pair,c,state));
 return {
  activePairs,
  playerIds:[...new Set(activePairs.flatMap(pair=>pair.ids||[]))]
 };
}

export function missingActiveHoleIndexes(card,c){
 const gross=card?.gross||[];
 return activeHoleIndexes(c,gross.length||18).filter(i=>!isEnteredHoleScore(gross[i]));
}

export function canAutomaticallyFinalise(c){return !FORMAT_AWARE_ONLY.has(c?.format);}

/**
 * Completes an already-started ordinary card without turning an untouched card
 * into an OOM entrant. Generated N/R holes are retained as provenance.
 */
export function finaliseScorecard(card,c,{at=new Date().toISOString(),by=null,reason='competition-close'}={}){
 if(!card||card.compId!==c?.id||!canAutomaticallyFinalise(c)||!cardHasPlayerActivity(card,c))return card;
 const missing=missingActiveHoleIndexes(card,c);
 if(!missing.length&&card.submitted)return card;
 const gross=[...(card.gross||Array(18).fill(''))];
 missing.forEach(i=>{gross[i]=0});
 const generatedNoReturnHoles=[...new Set([...(card.generatedNoReturnHoles||[]),...missing])].sort((a,b)=>a-b);
 return {...card,gross,generatedNoReturnHoles,submitted:true,submittedAt:card.submittedAt||at,updatedAt:at,
  ...(reason==='competition-close'?{autoClosedAt:at,autoClosedBy:by||'GGC'}:{}),finalisationReason:reason};
}

export function finaliseCompetitionState(c,state,options={}){
 if(!c||!state||!canAutomaticallyFinalise(c))return state;
 let changed=0;
 const cards=(state.cards||[]).map(card=>{
  if(card.compId!==c.id)return card;
  const next=finaliseScorecard(card,c,options);
  if(next!==card)changed++;
  return next;
 });
 return changed?{...state,cards}:state;
}

export function visibleHoleTarget(c,{embargoActive=false,visibleThrough=15}={}){
 if(c?.holesMode==='front9'||c?.holesMode==='back9')return 9;
 return embargoActive?Math.max(1,Math.min(17,Number(visibleThrough)||15)):18;
}
