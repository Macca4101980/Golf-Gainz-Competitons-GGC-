/** Record-level persistence primitives for GGC's next storage model.
 * The database enforces versions atomically. Never fall back to whole-state writes.
 * Writes require an authenticated user and an RLS policy authorising the record.
 */
export function createRecordStore(supabase){
 if(!supabase)throw new Error('Supabase client required');
 const versions=new Map();
 const key=(kind,id)=>kind+':'+id;
 async function load(kind,id){
  const {data,error}=await supabase.from('ggc_records').select('data,version,deleted').eq('kind',kind).eq('record_id',id).maybeSingle();
  if(error)throw error;
  if(data)versions.set(key(kind,id),Number(data.version));
  return data?.deleted?null:data?.data??null;
 }
 async function save(kind,id,data,{deleted=false}={}){
  const k=key(kind,id),expected=versions.has(k)?versions.get(k):null;
  const {data:version,error}=await supabase.rpc('ggc_save_record',{p_kind:kind,p_id:id,p_data:data,p_expected_version:expected,p_deleted:deleted});
  if(error){
   if(/GGC_VERSION_CONFLICT|version conflict/i.test(error.message||''))throw new Error('GGC_VERSION_CONFLICT: record changed elsewhere; reload and reconcile');
   throw error;
  }
  versions.set(k,Number(version));
  return Number(version);
 }
 return {load,save,getVersion:(kind,id)=>versions.get(key(kind,id))??null};
}
