/**
 * Safe legacy blob store. This is a bridge, not a replacement for record-level storage.
 * Never upsert a whole application blob: only update the exact version read.
 * Concurrent edits fail closed instead of silently overwriting another device.
 */
export function createLegacyCloudStore({url,key,fetcher=fetch}){
 let version=null;
 let ready=false;
 let queue=Promise.resolve();
 let loadSequence=0;
 let sessionToken=null;
 const headers=token=>({apikey:key,Authorization:`Bearer ${token}`});
 async function load(token){
  if(sessionToken!==token){ready=false;version=null;sessionToken=token;loadSequence++;}
  // Only the latest completed load may establish a writable baseline.
  const sequence=++loadSequence;
  // Never replace the acknowledged version while a write is in flight.
  await queue;
  const r=await fetcher(`${url}/rest/v1/ggc_state?id=eq.main&select=payload,updated_at`,{headers:headers(token),cache:'no-store'});
  if(!r.ok){ready=false;version=null;throw Error(`Cloud read failed: ${r.status}`);}
  const rows=await r.json();
  if(rows.length!==1||!rows[0].updated_at){ready=false;version=null;throw Error('GGC_CLOUD_BASELINE_MISSING');}
  if(sequence!==loadSequence||sessionToken!==token)throw Error('GGC_CLOUD_LOAD_SUPERSEDED');
  version=rows[0].updated_at;ready=true;
  return rows[0].payload;
 }
 function save(snapshot,token){
  const payload=structuredClone(snapshot);
  // A refresh that started before this write must never re-authorise stale data.
  loadSequence++;
  const task=async()=>{
   if(!ready||!version||sessionToken!==token)throw Error('GGC_CLOUD_BASELINE_REQUIRED');
   const nextVersion=new Date(Math.max(Date.now(),Date.parse(version)+1)).toISOString();
   const query=`${url}/rest/v1/ggc_state?id=eq.main&updated_at=eq.${encodeURIComponent(version)}&select=updated_at`;
   const r=await fetcher(query,{method:'PATCH',headers:{...headers(token),'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({payload,updated_at:nextVersion})});
   if(!r.ok){ready=false;version=null;throw Error(`Cloud write failed: ${r.status}; reload required before retry`);}
   const rows=await r.json();
   if(rows.length!==1){ready=false;version=null;throw Error('GGC_CLOUD_CONFLICT: another device saved; reload and reconcile');}
   version=rows[0].updated_at;
   return version;
  };
  const result=queue.then(task);
  // A failed write can have reached the server despite a lost response.
  // Require a fresh cloud baseline before any further write.
  queue=result.catch(()=>{ready=false;version=null;});
  return result;
 }
 return {load,save,isReady:()=>ready,getVersion:()=>version,invalidate:()=>{ready=false;version=null;loadSequence++;}};
}
