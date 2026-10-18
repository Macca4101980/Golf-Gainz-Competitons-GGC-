export function adminEntryGroups(comp,state){
 const people=new Map((state?.players||[]).map(player=>[String(player.id),player]));
 return (comp?.roundGroups||[])
  .map(group=>({...group,players:(group.playerIds||[]).map(id=>people.get(String(id))).filter(Boolean)}))
  .filter(group=>group.players.length>0);
}
