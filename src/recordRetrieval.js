/** Retrieve versioned records by collection; never replace an unrelated collection. */
import {RECORD_COLLECTIONS} from './recordChanges.js';
export async function loadRecordSnapshot(supabase,base,{kinds=RECORD_COLLECTIONS,onVersionsLoaded}={}){
 if(!supabase)throw Error('GGC_RECORD_CLIENT_REQUIRED');
 const next=structuredClone(base);
 const loadedVersions=[];
 for(const kind of kinds){
  if(!RECORD_COLLECTIONS.includes(kind))throw Error('GGC_UNKNOWN_RECORD_COLLECTION');
  // PostgREST defaults to a maximum page size. Fetch all pages or fail closed.
  const data=[];
  const pageSize=500;
  for(let offset=0;;offset+=pageSize){
   const result=await supabase.from('ggc_records').select('record_id,data,version,deleted').eq('kind',kind).order('record_id',{ascending:true}).range(offset,offset+pageSize-1);
   if(result.error)throw result.error instanceof Error?result.error:new Error(result.error.message||'GGC_RECORD_READ_FAILED');
   if(!Array.isArray(result.data))throw Error('GGC_RECORD_READ_INCOMPLETE');
   data.push(...result.data);
   if(result.data.length<pageSize)break;
   if(offset>100000)throw Error('GGC_RECORD_READ_LIMIT');
  }
  // Fail closed if a partial RLS-visible result would silently replace the legacy collection.
  if(Array.isArray(base?.[kind])&&new Set(base[kind].map(item=>String(item?.id))).size>data.filter(row=>!row.deleted).length)
   throw Error('GGC_RECORD_MIGRATION_INCOMPLETE: '+kind);
  const ids=new Set();
  const records=[];
  for(const row of data){
   if(!row||row.record_id==null||!Number.isSafeInteger(Number(row.version))||Number(row.version)<1)throw Error('GGC_INVALID_RECORD_ROW');
   const id=String(row.record_id);
   if(ids.has(id))throw Error('GGC_DUPLICATE_RECORD');
   ids.add(id);
   loadedVersions.push({kind,id,version:Number(row.version)});
   if(row.deleted)continue;
   if(!row.data||typeof row.data!=='object'||Array.isArray(row.data)||String(row.data.id)!==id)throw Error('GGC_INVALID_RECORD_DATA');
   records.push(structuredClone(row.data));
  }
  next[kind]=records;
 }
 // Publish versions only after every requested collection was validated.
 if(onVersionsLoaded)onVersionsLoaded(loadedVersions);
 return next;
}
