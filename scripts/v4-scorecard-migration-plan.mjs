// Pure, read-only scorecard migration planner. Never infers missing identities.
export function planV4ScorecardMigration(state,{excludedGroupIds=[]}={}){
 const excluded=new Set(excludedGroupIds.map(String));
 const groups=new Set((state.societies??[]).filter(g=>!excluded.has(String(g.id))).map(g=>String(g.id)));
 const golfers=new Set((state.players??[]).map(p=>String(p.id)));
 const issues=[],scope=[],cards=[],excludedCards=[];
 const competitions=new Map(),allCompetitions=new Map(),seenCompetitionIds=new Set();
 for(const comp of state.comps??[]){
  const id=String(comp.id??''),groupId=String(comp.societyId??'');
  if(!id||seenCompetitionIds.has(id)){issues.push({type:'missing_or_duplicate_competition_id',compId:id});continue}
  seenCompetitionIds.add(id);
  allCompetitions.set(id,groupId);
  if(excluded.has(groupId))continue;
  if(!groups.has(groupId)){issues.push({type:'competition_missing_group',compId:id});continue}
  competitions.set(id,groupId);
  scope.push({comp_id:id,group_id:groupId});
 }
 const seen=new Set();
 for(const card of state.cards??[]){
  const id=String(card.id??''),compId=String(card.compId??''),groupId=String(card.societyId??''),golferId=String(card.playerId??'');
  if(!id||seen.has(id)){issues.push({type:'missing_or_duplicate_card_id',cardId:id});continue}
  seen.add(id);
  if(excluded.has(groupId)){
   if(allCompetitions.get(compId)!==groupId)issues.push({type:'excluded_card_scope_mismatch',cardId:id});
   else excludedCards.push(id);
   continue;
  }
  if(!competitions.has(compId)||competitions.get(compId)!==groupId){issues.push({type:'card_competition_scope_mismatch',cardId:id});continue}
  if(!golfers.has(golferId)){issues.push({type:'card_missing_golfer',cardId:id});continue}
  cards.push({id,comp_id:compId,group_id:groupId,golfer_id:golferId,card,revision:1});
 }
 return {ready:issues.length===0,issues,scope,cards,excludedCards,
  counts:{competitions:scope.length,cards:cards.length,excludedCards:excludedCards.length}};
}
