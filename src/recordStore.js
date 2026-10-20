/** Version-checked record persistence. Never fall back to whole-state writes. */
export function createRecordStore(supabase){
 if(!supabase)throw new Error('Supabase client required');
 const versions=new Map();
 const queues=new Map();
 const revisions=new Map();
 const key=(kind,id)=>kind+':'+id;
 async function loadStaged(kind,id){
  const k=key(kind,id);
  // Wait for this record's pending writes before refreshing its baseline.
  await (queues.get(k)||Promise.resolve());
  // A save can start while this network read is in flight. Never accept its stale baseline.
  const revision=revisions.get(k)||0;
  const cachedVersion=versions.get(k)??null;
  let response;
  try{response=await supabase.from('ggc_records').select('data,version,deleted').eq('kind',kind).eq('record_id',id).maybeSingle();}
  catch(error){versions.delete(k);throw error;}
  const {data,error}=response;
  if((revisions.get(k)||0)!==revision)throw new Error('GGC_STALE_RECORD_LOAD: save started during refresh');
  if(error){versions.delete(k);throw error;}
  if(data&&(!Number.isSafeInteger(Number(data.version))||Number(data.version)<1)){versions.delete(k);throw Error('GGC_INVALID_RECORD_VERSION');}
  return {kind,id,revision,cachedVersion,version:data?Number(data.version):null,record:data?.deleted?null:data?.data??null};
 }
 function commitStagedReads(reads){
  // Validate the entire batch before accepting any version. A rejected form
  // refresh must never grant a stale snapshot permission to overwrite newer data.
  for(const read of reads){const k=key(read.kind,read.id);
   if((revisions.get(k)||0)!==read.revision||(versions.get(k)??null)!==read.cachedVersion)throw Error('GGC_STALE_RECORD_LOAD: baseline changed during refresh');
  }
  for(const read of reads){const k=key(read.kind,read.id);if(read.version===null)versions.delete(k);else versions.set(k,read.version);}
 }
 async function load(kind,id){
  const read=await loadStaged(kind,id);
  commitStagedReads([read]);
  return read.record;
 }
 function save(kind,id,data,{deleted=false}={}){
  const k=key(kind,id),payload=structuredClone(data);
  revisions.set(k,(revisions.get(k)||0)+1);
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
 function saveFields(kind,id,data,fields,{deleted=false}={}){
  const k=key(kind,id),payload=Object.fromEntries(fields.filter(field=>field!=='id').map(field=>[field,structuredClone(data[field])]));
  const names=Object.keys(payload);
  revisions.set(k,(revisions.get(k)||0)+1);
  const work=async()=>{
   const expected=versions.has(k)?versions.get(k):null;
   if(!Number.isSafeInteger(expected)||expected<1)throw Error('GGC_RECORD_BASELINE_REQUIRED');
   let result;
   try{result=await supabase.rpc('ggc_patch_record',{p_kind:kind,p_id:id,p_patch:payload,p_fields:names,p_expected_version:expected,p_deleted:deleted});}
   catch(error){versions.delete(k);throw error;}
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
 async function loadAll(kinds,{commitVersions=true}={}){
  if(queues.size)throw Error('GGC_RECORD_READ_DURING_SAVE');
  const output=Object.fromEntries(kinds.map(kind=>[kind,[]]));
  const staged=new Map();
  for(const kind of kinds){
   for(let offset=0;;offset+=500){
    const {data,error}=await supabase.from('ggc_records').select('record_id,data,version,deleted').eq('kind',kind).order('record_id',{ascending:true}).range(offset,offset+499);
    if(error)throw error;
    if(!Array.isArray(data))throw Error('GGC_RECORD_READ_INCOMPLETE');
    for(const row of data){
     const id=String(row.record_id),v=Number(row.version),k=key(kind,id);
     if(!Number.isSafeInteger(v)||v<1||staged.has(k))throw Error('GGC_INVALID_OR_DUPLICATE_RECORD');
     staged.set(k,v);
     if(!row.deleted){if(!row.data||String(row.data.id)!==id)throw Error('GGC_INVALID_RECORD_DATA');output[kind].push(row.data)}
    }
    if(data.length<500)break;
   }
  }
  if(queues.size)throw Error('GGC_RECORD_READ_DURING_SAVE');
  if(commitVersions)commitLoadedVersions(staged);
  return commitVersions?output:{records:output,versions:staged};
 }
 function commitLoadedVersions(staged){if(queues.size)throw Error('GGC_SEED_DURING_SAVE');for(const [k,v] of staged)versions.set(k,v)}
 function invalidate(kind,id){versions.delete(key(kind,id))}
 function seedVersions(rows){
  const incoming=new Map();
  for(const row of rows){
   if(!row||!row.kind||row.id==null||!Number.isSafeInteger(row.version)||row.version<1)throw Error('GGC_INVALID_RECORD_VERSION');
   const k=key(row.kind,row.id);
   if(incoming.has(k))throw Error('GGC_DUPLICATE_RECORD_VERSION');
   incoming.set(k,row.version);
  }
  if(queues.size)throw Error('GGC_SEED_DURING_SAVE');
  versions.clear();
  for(const [k,v] of incoming)versions.set(k,v);
 }
 return {load,loadStaged,commitStagedReads,loadAll,commitLoadedVersions,invalidate,save,saveFields,seedVersions,getVersion:(kind,id)=>versions.get(key(kind,id))??null,hasBaseline:(kind,id)=>versions.has(key(kind,id))};
}
