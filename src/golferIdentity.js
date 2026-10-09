/** Deterministic, evidence-based golfer identity reconciliation.
 * Only exact Auth UUIDs or unique verified email matches are linked.
 * Ambiguous email matches are intentionally left untouched for review.
 */
export const normalizedEmail=v=>String(v||'').trim().toLowerCase();
export function reconcileGolferIdentity(state,{authId,email,profile}){
 if(!authId||!Array.isArray(state?.players))return {state,playerId:null,linkedIds:[],ambiguous:false};
 const players=state.players;
 const verified=normalizedEmail(email);
 const authenticated=players.filter(p=>p.authUserId===authId||p.id===authId);
 const foreign=players.filter(p=>p.authUserId&&p.authUserId!==authId);
 const eligible=players.filter(p=>p.id!==authId&&p.authUserId!==authId&&!foreign.includes(p)&&verified&&normalizedEmail(p.email)===verified);
 const distinct=new Set(eligible.map(p=>p.id));
 const ambiguous=distinct.size>1;
 // A unique email is evidence; matching display names alone is not.
 const linkedIds=[...new Set([...authenticated.filter(p=>p.id!==authId).map(p=>p.id),...(!ambiguous?eligible.map(p=>p.id):[])])];
 const primary=authenticated.find(p=>p.id!==authId&&verified&&normalizedEmail(p.email)===verified)||(!ambiguous?eligible[0]:null)||authenticated.find(p=>p.id===authId)||authenticated[0];
 const playerId=primary?.id||authId;
 const canonical=players.find(p=>p.id===playerId);
 const identityLinks={...(state.identityLinks||{})};
 for(const id of linkedIds)if(id!==playerId)identityLinks[id]=playerId;
 const merged={...(primary||{}),...(canonical||{}),id:playerId,authUserId:authId,
  name:profile?.display_name||canonical?.name||primary?.name||'Golfer',
  email:verified||canonical?.email||null,
  placeholder:false,unclaimed:false,guest:false,membershipStatus:'member'};
 const kept=players.filter(p=>p.id===playerId||!linkedIds.includes(p.id)).map(p=>p.id===playerId?merged:p);
 if(!kept.some(p=>p.id===playerId))kept.push(merged);
 // Preserve original card IDs and historical source data; remap references to canonical golfer.
 const swap=id=>identityLinks[id]||id;
 const ids=a=>[...new Set((a||[]).map(swap))];
 const societies=(state.societies||[]).map(g=>({...g,members:ids(g.members),admins:ids(g.admins),ownerId:swap(g.ownerId)}));
 const comps=(state.comps||[]).map(c=>({...c,entries:ids(c.entries),invites:ids(c.invites),
  pairs:(c.pairs||[]).map(p=>({...p,ids:ids(p.ids)})),
  roundGroups:(c.roundGroups||[]).map(g=>({...g,ids:ids(g.ids),playerIds:ids(g.playerIds)}))}));
 const leagues=(state.leagues||[]).map(l=>{
  const startingHandicaps={...(l.startingHandicaps||{})};
  for(const id of linkedIds)if(id!==playerId&&Object.hasOwn(startingHandicaps,id)){
   if(!Object.hasOwn(startingHandicaps,playerId))startingHandicaps[playerId]=startingHandicaps[id];
   delete startingHandicaps[id];
  }
  return {...l,memberIds:ids(l.memberIds),teams:(l.teams||[]).map(t=>({...t,memberIds:ids(t.memberIds)})),startingHandicaps};
 });
 const cards=(state.cards||[]).map(c=>linkedIds.includes(c.playerId)?{...c,playerId}:c);
 const remapContacts=map=>Object.fromEntries(Object.entries(map||{}).reduce((out,[k,v])=>{
  const key=swap(k);const entry=out.find(([existing])=>existing===key);
  if(entry)entry[1]=ids([...entry[1],...(v||[])]);
  else out.push([key,ids(v)]);
  return out;
 },[]));
 return {state:{...state,players:kept,societies,comps,leagues,cards,identityLinks,
  contacts:remapContacts(state.contacts),hiddenContacts:remapContacts(state.hiddenContacts)},
  playerId,linkedIds,ambiguous};
}
