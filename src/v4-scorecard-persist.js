import {readV4Scorecard,saveV4Scorecard,ScorecardConflictError} from './v4-scorecard-api.js';
// Staged adapter for score screens. Must only be enabled after the V4 import and
// competition scope mapping have been reconciled. Never falls back to whole-state saves.
export async function persistV4Scorecard({baseUrl,apiKey,accessToken,card,actorGolferId,baselineCard,baselineRevision,fetcher=fetch}){
 if(!actorGolferId||!card?.id)throw Error('Claimed golfer and scorecard required');
 const connection={baseUrl,apiKey,accessToken,fetcher};
 const existing=await readV4Scorecard({...connection,cardId:card.id});
 if(existing){
  if(existing.card?.id!==card.id||existing.card?.compId!==card.compId||existing.card?.societyId!==card.societyId||existing.card?.playerId!==card.playerId)throw Error('Existing scorecard identity mismatch');
  // Never silently overwrite a scorecard whose contents changed on another device.
  // A UI must present the conflict and ask the scorer to reload or reconcile.
  if(!Number.isSafeInteger(baselineRevision)||baselineRevision!==existing.revision||JSON.stringify(existing.card)!==JSON.stringify(baselineCard))throw new ScorecardConflictError();
  if(JSON.stringify(existing.card)===JSON.stringify(card))return {revision:existing.revision,unchanged:true};
 }
 const mode=card.playerId===actorGolferId?'own':'group';
 const revision=await saveV4Scorecard({...connection,card,expectedRevision:existing?.revision??0,mode,...(mode==='group'?{targetGolferId:card.playerId}:{})});
 return {revision,unchanged:false};
}
