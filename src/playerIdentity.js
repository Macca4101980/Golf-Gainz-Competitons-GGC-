/** Apply the authenticated profile without changing an existing GGC player ID.
 * Groups, teams, scorecards and League handicaps all refer to that stable ID.
 */
export function hydrateSignedInPlayer(players,profile){
 const source=Array.isArray(players)?players:[];
 const index=source.findIndex(player=>player.authUserId===profile.id||player.id===profile.id);
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
