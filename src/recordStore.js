/** Version-controlled record persistence. No whole-state fallback.
 * A baseline must be loaded from Supabase before any record may be updated.
 * A record missing from a successful load can be inserted with expected_version=null.
 */
export function createRecordStore(supabase){
 if(!supabase)throw new Error('Supabase client required');
 const versions=new Map();
 const key=(kind,id)=>kind+':'+String(id);
 async function load(kind,id){
  const {data,error}=await supabase.from('ggc_records').select('data,version,deleted').eq('kind',kind).eq('record_id',id).maybeSingle();
  if(error)throw error;
  versions.set(key(kind,id),data?Number(data.version):null);
  return data?.deleted?null:data?.data??null;
 }
 async function loadAll(kinds){
  const output=Object.fromEntries(kinds.map(kind=>[kind,[]]));
  const pageSize=500;
  for(const kind of kinds){
   for(let offset=0;;offset+=pageSize){
    const {data,error}=await supabase.from('ggc_records').select('record_id,data,version,deleted').eq('kind',kind).order('record_id',{ascending:true}).range(offset,offset+pageSize-1);
    if(error)throw error;
    for(const row of data||[]){versions.set(key(kind,row.record_id),Number(row.version));if(!row.deleted)output[kind].push(row.data);}
    if((data||[]).length<pageSize)break;
   }
  }
  return output;
 }
 async function save(kind,id,data,{deleted=false}={}){
  const k=key(kind,id);
  if(!versions.has(k))throw Error('GGC_RECORD_BASELINE_REQUIRED: load record before saving');
  const expected=versions.get(k);
  const {data:version,error}=await supabase.rpc('ggc_save_record',{p_kind:kind,p_id:id,p_data:data,p_expected_version:expected,p_deleted:deleted});
  if(error){
   if(/GGC_VERSION_CONFLICT|version conflict/i.test(error.message||''))throw Error('GGC_VERSION_CONFLICT: record changed elsewhere; reload and reconcile');
   throw error;
  }
  versions.set(k,Number(version));
  return Number(version);
 }
 function invalidate(kind,id){versions.delete(key(kind,id));}
 return {load,loadAll,save,invalidate,getVersion:(kind,id)=>versions.get(key(kind,id))??null,hasBaseline:(kind,id)=>versions.has(key(kind,id))};
}
