// Pure migration planner: no database writes, no automatic identity merges.
export function planV4Migration(state, options={}) {
 const excludedGroupIds=new Set(options.excludedGroupIds??[]);
 const players=state.players??[],allGroups=state.societies??[];
 const groups=allGroups.filter(g=>!excludedGroupIds.has(String(g.id)));
 const ids=new Set(players.map(p=>String(p.id)));
 const groupIds=new Set(groups.map(g=>String(g.id)));
 const issues=[],memberships=[],golfers=[];
 const excludedGroups=allGroups.filter(g=>excludedGroupIds.has(String(g.id))).map(g=>({id:String(g.id),name:g.name}));
 if(ids.size!==players.length)issues.push({type:'duplicate_golfer_ids'});
 if(groupIds.size!==groups.length)issues.push({type:'duplicate_group_ids'});
 for(const p of players){
  if(!p.id||!String(p.name??p.displayName??'').trim()){issues.push({type:'invalid_golfer',id:p.id??null});continue;}
  golfers.push({id:String(p.id),display_name:String(p.name??p.displayName),placeholder:Boolean(p.placeholder??p.unclaimed??!p.authUserId),auth_user_id:p.authUserId||null});
 }
 for(const g of groups){
  if(!g.id||!String(g.name??'').trim()){issues.push({type:'invalid_group',id:g.id??null});continue;}
  const roles=new Map();
  for(const id of g.members??[])roles.set(String(id),'member');
  for(const id of g.admins??[])roles.set(String(id),'admin');
  if(g.ownerId)roles.set(String(g.ownerId),'owner');
  for(const [id,role] of roles){
   if(!ids.has(id)){issues.push({type:'unresolved_reference',groupId:g.id,golferId:id,role});continue;}
   memberships.push({group_id:String(g.id),golfer_id:id,role,status:'member'});
  }
 }
 return {golfers,excludedGroups,groups:groups.filter(g=>g.id&&String(g.name??'').trim()).map(g=>({id:String(g.id),name:String(g.name)})),memberships,issues,ready:issues.length===0,
  preserved:{competitions:(state.comps??[]).length,cards:(state.cards??[]).length,leagues:(state.leagues??[]).length}};
}
