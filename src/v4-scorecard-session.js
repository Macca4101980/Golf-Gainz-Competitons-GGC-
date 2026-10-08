import {readV4Scorecard,saveV4Scorecard,ScorecardConflictError} from './v4-scorecard-api.js';
// Keeps the trusted server baseline separate from editable React/localStorage state.
// Never assumes that a local card is already current on the server.
export function createV4ScorecardSession({baseUrl,apiKey,accessToken,actorGolferId,fetcher=fetch}){
 const connection={baseUrl,apiKey,accessToken,fetcher};
 const baselines=new Map();
 const inFlight=new Set();
 const opening=new Set();
 const copy=value=>JSON.parse(JSON.stringify(value));
 const sortJson=value=>Array.isArray(value)?value.map(sortJson):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sortJson(value[key])])):value;
 const same=(a,b)=>JSON.stringify(sortJson(a))===JSON.stringify(sortJson(b));
 async function open(cardId){
  if(!cardId)throw Error('Card ID required');
  if(inFlight.has(cardId)||opening.has(cardId))throw Error('Scorecard operation already in progress');
  opening.add(cardId);
  try{
   const result=await readV4Scorecard({...connection,cardId});
   if(!result){baselines.delete(cardId);return null}
   baselines.set(cardId,{card:copy(result.card),revision:result.revision});
   return {card:copy(result.card),revision:result.revision};
  }finally{opening.delete(cardId)}
 }
 async function save(card){
  if(!card?.id||!actorGolferId)throw Error('Claimed golfer and card required');
  if(inFlight.has(card.id)||opening.has(card.id))throw Error('Scorecard operation already in progress');
  inFlight.add(card.id);
  try{
  // Capture the user's submitted values before the first asynchronous server read.
  const submitted=copy(card);
  const baseline=baselines.get(card.id);
  if(!baseline)throw Error('Open the server scorecard before saving');
  if(card.id!==baseline.card.id||card.compId!==baseline.card.compId||card.societyId!==baseline.card.societyId||card.playerId!==baseline.card.playerId)throw Error('Scorecard identity changed');
  const current=await readV4Scorecard({...connection,cardId:card.id});
  if(!current||current.revision!==baseline.revision||!same(current.card,baseline.card))throw new ScorecardConflictError();
  if(same(submitted,baseline.card))return {revision:baseline.revision,unchanged:true};
  const mode=submitted.playerId===actorGolferId?'own':'group';
  const revision=await saveV4Scorecard({...connection,card:submitted,expectedRevision:baseline.revision,mode,...(mode==='group'?{targetGolferId:submitted.playerId}:{})});
  // Confirm the server actually retained this exact card before reporting success.
  const confirmed=await readV4Scorecard({...connection,cardId:card.id});
  if(!confirmed||confirmed.revision!==revision||!same(confirmed.card,submitted)){
   baselines.delete(card.id);
   throw new ScorecardConflictError();
  }
  baselines.set(card.id,{card:copy(confirmed.card),revision});
  return {revision,unchanged:false};
  }finally{inFlight.delete(card.id)}
 }
 function close(cardId){
  if(inFlight.has(cardId)||opening.has(cardId))throw Error('Cannot close scorecard during an operation');
  baselines.delete(cardId);
 }
 return {open,save,close};
}
