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
