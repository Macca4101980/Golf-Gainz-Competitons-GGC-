/** Retrieve versioned records by collection; never replace an unrelated collection. */
import {RECORD_COLLECTIONS} from './recordChanges.js';
export async function loadRecordSnapshot(supabase,base,{kinds=RECORD_COLLECTIONS}={}){
 if(!supabase)throw Error('GGC_RECORD_CLIENT_REQUIRED');
 const next=structuredClone(base);
 for(const kind of kinds){
  if(!RECORD_COLLECTIONS.includes(kind))throw Error('GGC_UNKNOWN_RECORD_COLLECTION');
  const {data,error}=await supabase.from('ggc_records').select('record_id,data,version,deleted').eq('kind',kind);
  if(error)throw error;
  if(!Array.isArray(data))throw Error('GGC_RECORD_READ_INCOMPLETE');
  const ids=new Set();
  const records=[];
  for(const row of data){
   if(!row||row.record_id==null||!Number.isSafeInteger(Number(row.version))||Number(row.version)<1)throw Error('GGC_INVALID_RECORD_ROW');
   const id=String(row.record_id);
   if(ids.has(id))throw Error('GGC_DUPLICATE_RECORD');
   ids.add(id);
   if(row.deleted)continue;
   if(!row.data||typeof row.data!=='object'||Array.isArray(row.data)||String(row.data.id)!==id)throw Error('GGC_INVALID_RECORD_DATA');
   records.push(structuredClone(row.data));
  }
  next[kind]=records;
 }
 return next;
}
