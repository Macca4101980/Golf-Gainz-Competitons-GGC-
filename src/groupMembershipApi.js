/** Server-authoritative group membership operations. No local-state persistence here. */
export function createGroupMembershipApi(supabase){
 const rpc=async(name,args={})=>{
  const {data,error}=await supabase.rpc(name,args);
  if(error)throw Error(error.message||String(error));
  if(data?.ok===false)throw Error('GGC_GROUP_'+(data.reason||'FAILED').toUpperCase());
  return data;
 };
 return {
  joinCode:code=>rpc('ggc_group_join_code',{p_code:code.trim()}),
  invite:(groupId,playerId)=>rpc('ggc_group_invite_player',{p_group_id:groupId,p_player_id:playerId}),
  pending:async()=>{const {data,error}=await supabase.rpc('ggc_group_pending_invitations');if(error)throw error;return data||[]},
  respond:(invitationId,accept)=>rpc('ggc_group_respond_invitation',{p_invitation_id:invitationId,p_accept:accept}),
  async myGroups(){const {data,error}=await supabase.rpc('ggc_group_my_groups');if(error)throw error;return data||[]},
  async group(groupId){
   const {data,error}=await supabase.rpc('ggc_group_get',{p_group_id:groupId});
   if(error)throw error;
   if(!data)throw Error('GGC_GROUP_NOT_FOUND');
   const {data:members,error:memberError}=await supabase.rpc('ggc_group_members',{p_group_id:groupId});
   if(memberError)throw memberError;
   const ownerId=data.ownerId;
   const authoritative=members||[];
   // Do not merge stale membership snapshots from ggc_records back into the RPC result.
   // The membership table is the source of truth after FIX 02 is enabled.
   const memberIds=[...new Set(authoritative.map(x=>x.player_id))];
   const admins=[...new Set(authoritative.filter(x=>x.role==='admin'||x.role==='owner').map(x=>x.player_id))];
   return {...data,members:memberIds,admins,ownerId};
  }
 };
}
