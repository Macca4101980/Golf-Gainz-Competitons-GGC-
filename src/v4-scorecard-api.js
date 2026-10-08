// V4 scoped scorecard client. Not activated until migration and access checks pass.
export class ScorecardConflictError extends Error { constructor(){super('Scorecard changed on another device; reload before saving');this.name='ScorecardConflictError'} }
export async function saveV4Scorecard({baseUrl,apiKey,accessToken,card,expectedRevision,mode='own',targetGolferId,fetcher=fetch}){
 if(!baseUrl||!apiKey||!accessToken)throw Error('Authenticated cloud connection required');
 if(!card||!card.id||!card.compId||!card.societyId||!card.playerId)throw Error('Scorecard identity incomplete');
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('Scorecard revision required');
 if(mode!=='own'&&mode!=='group')throw Error('Invalid scorecard mode');
 if(mode==='group'&&(!targetGolferId||targetGolferId!==card.playerId))throw Error('Delegated golfer mismatch');
 const rpc=mode==='own'?'ggc_save_my_scorecard_v4':'ggc_save_group_scorecard_v4';
 const payload={p_card_id:card.id,p_comp_id:card.compId,p_group_id:card.societyId,p_expected_revision:expectedRevision,p_card:card};
 if(mode==='group')payload.p_target_golfer_id=targetGolferId;
 const res=await fetcher(baseUrl.replace(/\/$/,'')+'/rest/v1/rpc/'+rpc,{method:'POST',headers:{apikey:apiKey,Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(!res.ok){let message='';try{message=await res.text()}catch{}
  if(res.status===409||/40001|Scorecard conflict/i.test(message))throw new ScorecardConflictError();
  throw Error('Scorecard save rejected ('+res.status+')');
 }
 const revision=await res.json();
 if(!Number.isSafeInteger(Number(revision))||Number(revision)<=expectedRevision)throw Error('Invalid scorecard revision returned');
 return Number(revision);
}
