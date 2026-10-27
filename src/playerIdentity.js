/** Apply the authenticated profile without changing an existing GGC player ID.
 * Groups, teams, scorecards and League handicaps all refer to that stable ID.
 */
export function hydrateSignedInPlayer(players,profile,identityLinks={}){
 const source=Array.isArray(players)?players:[];
 const candidates=source
  .map((player,index)=>({player,index}))
  .filter(({player})=>player.authUserId===profile.id||player.id===profile.id);
 const linkedId=identityLinks?.[profile.id];
 const selected=candidates.find(({player})=>linkedId&&player.id===linkedId)
  ||candidates.find(({player})=>player.id!==profile.id)
  ||candidates[0];
 const index=selected?.index??-1;
 const id=index>=0?source[index].id:profile.id;
 const player={
  id,
  authUserId:profile.id,
  name:profile.display_name,
  hi:+profile.handicap_index||0,
  passkeyEnabled:!!profile.passkey_enabled,
 };
 return {
  player,
  players:index>=0
   ?source.map((existing,i)=>i===index?{...existing,...player}:existing)
   :[...source,player],
 };
}

/**
 * A golfer already in a competition cannot also have a pending invitation.
 * This removes stale cached invitations without changing entries or scorecards.
 */
export function sanitiseCompetitionParticipation(comp={}){
 const entries=[...new Set(Array.isArray(comp.entries)?comp.entries:[])];
 const entryIds=new Set(entries);
 const invites=[...new Set(Array.isArray(comp.invites)?comp.invites:[])].filter(id=>!entryIds.has(id));
 return {...comp,entries,invites};
}

export function hasPendingCompetitionInvite(comp,playerId){
 if(!playerId)return false;
 return sanitiseCompetitionParticipation(comp).invites.includes(playerId);
}
