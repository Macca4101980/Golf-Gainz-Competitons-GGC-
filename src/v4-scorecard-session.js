import {readV4Scorecard,saveV4Scorecard,ScorecardConflictError} from './v4-scorecard-api.js';
// Keeps the trusted server baseline separate from editable React/localStorage state.
// Never assumes that a local card is already current on the server.
export function createV4ScorecardSession({baseUrl,apiKey,accessToken,actorGolferId,fetcher=fetch}){
 const connection={baseUrl,apiKey,accessToken,fetcher};
 const baselines=new Map();
 const inFlight=new Set();
 const copy=value=>JSON.parse(JSON.stringify(value));
 async function open(cardId){
  if(!cardId)throw Error('Card ID required');
  const result=await readV4Scorecard({...connection,cardId});
  if(!result){baselines.delete(cardId);return null}
  baselines.set(cardId,{card:copy(result.card),revision:result.revision});
  return {card:copy(result.card),revision:result.revision};
 }
 async function save(card){
  if(!card?.id||!actorGolferId)throw Error('Claimed golfer and card required');
  if(inFlight.has(card.id))throw Error('Scorecard save already in progress');
  inFlight.add(card.id);
  try{
  const baseline=baselines.get(card.id);
  if(!baseline)throw Error('Open the server scorecard before saving');
  if(card.id!==baseline.card.id||card.compId!==baseline.card.compId||card.societyId!==baseline.card.societyId||card.playerId!==baseline.card.playerId)throw Error('Scorecard identity changed');
  const current=await readV4Scorecard({...connection,cardId:card.id});
  if(!current||current.revision!==baseline.revision||JSON.stringify(current.card)!==JSON.stringify(baseline.card))throw new ScorecardConflictError();
  if(JSON.stringify(card)===JSON.stringify(baseline.card))return {revision:baseline.revision,unchanged:true};
  const mode=card.playerId===actorGolferId?'own':'group';
  const revision=await saveV4Scorecard({...connection,card,expectedRevision:baseline.revision,mode,...(mode==='group'?{targetGolferId:card.playerId}:{})});
  baselines.set(card.id,{card:copy(card),revision});
  return {revision,unchanged:false};
  }finally{inFlight.delete(card.id)}
 }
 function close(cardId){baselines.delete(cardId)}
 return {open,save,close};
}
