/** Version-checked record persistence. Never fall back to whole-state writes. */
export function createRecordStore(supabase){
 if(!supabase)throw new Error('Supabase client required');
 const versions=new Map();
 const queues=new Map();
 const key=(kind,id)=>kind+':'+id;
 async function load(kind,id){
  const k=key(kind,id);
  // Wait for this record's pending writes before refreshing its baseline.
  await (queues.get(k)||Promise.resolve());
  const {data,error}=await supabase.from('ggc_records').select('data,version,deleted').eq('kind',kind).eq('record_id',id).maybeSingle();
  if(error){versions.delete(k);throw error;}
  if(data)versions.set(k,Number(data.version));
  else versions.delete(k);
  return data?.deleted?null:data?.data??null;
 }
 function save(kind,id,data,{deleted=false}={}){
  const k=key(kind,id),payload=structuredClone(data);
  const work=async()=>{
   const expected=versions.has(k)?versions.get(k):null;
   let result;
   try{
    result=await supabase.rpc('ggc_save_record',{p_kind:kind,p_id:id,p_data:payload,p_expected_version:expected,p_deleted:deleted});
   }catch(error){versions.delete(k);throw error;}
   const {data:version,error}=result;
   if(error){
    versions.delete(k);
    if(/GGC_VERSION_CONFLICT|version conflict/i.test(error.message||''))throw new Error('GGC_VERSION_CONFLICT: record changed elsewhere; reload and reconcile');
    throw error;
   }
   const nextVersion=Number(version);
   if(!Number.isSafeInteger(nextVersion)||nextVersion<1){versions.delete(k);throw Error('GGC_INVALID_RECORD_VERSION');}
   versions.set(k,nextVersion);
   return nextVersion;
  };
  const result=(queues.get(k)||Promise.resolve()).then(work);
  const settled=result.catch(()=>{});
  queues.set(k,settled);
  void settled.then(()=>{if(queues.get(k)===settled)queues.delete(k);});
  return result;
 }
 return {load,save,getVersion:(kind,id)=>versions.get(key(kind,id))??null};
}
