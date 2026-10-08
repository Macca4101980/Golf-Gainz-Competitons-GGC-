// V4 membership read adapter. Disabled by default; legacy scoring remains authoritative.
// No writes are performed. Authenticated Supabase client required.
export async function loadV4Memberships(supabase,{enabled=false,authUserId=null}={}){
 if(!enabled)return {enabled:false,memberships:[],identityLinks:[]};
 if(!supabase||!authUserId)throw Error('Authenticated session required');
 const {data,error}=await supabase.rpc('ggc_my_memberships_v4');
 if(error)throw error;
 if(!Array.isArray(data))throw Error('Unexpected membership response');
 return {enabled:true,memberships:data,identityLinks:[]};
}
export function resolveV4Memberships(legacyGroups,readResult){
 if(!readResult?.enabled)return legacyGroups;
 // Read-only shadow comparison: never mutate old state or assign new owner rights.
 const byGroup=new Map();
 for(const m of readResult.memberships){
  if(!m||typeof m.group_id!=='string'||!['member','admin','owner'].includes(m.role))continue;
  const group=byGroup.get(m.group_id)??[];
  group.push({golferId:m.golfer_id,role:m.role,status:m.status});
  byGroup.set(m.group_id,group);
 }
 return (legacyGroups??[]).map(g=>({...g,v4ShadowMemberships:byGroup.get(String(g.id))??[]}));
}
