/**
 * Safe legacy blob store. This is a bridge, not a replacement for record-level storage.
 * Never upsert a whole application blob: only update the exact version read.
 * Concurrent edits fail closed instead of silently overwriting another device.
 */
export function createLegacyCloudStore({url,key,fetcher=fetch}){
 let version=null;
 let ready=false;
 let queue=Promise.resolve();
 const headers=token=>({apikey:key,Authorization:`Bearer ${token}`});
 async function load(token){
  const r=await fetcher(`${url}/rest/v1/ggc_state?id=eq.main&select=payload,updated_at`,{headers:headers(token),cache:'no-store'});
  if(!r.ok)throw Error(`Cloud read failed: ${r.status}`);
  const rows=await r.json();
  if(rows.length!==1||!rows[0].updated_at)throw Error('GGC_CLOUD_BASELINE_MISSING');
  version=rows[0].updated_at;ready=true;
  return rows[0].payload;
 }
 function save(snapshot,token){
  const payload=structuredClone(snapshot);
  const task=async()=>{
   if(!ready||!version)throw Error('GGC_CLOUD_BASELINE_REQUIRED');
   const nextVersion=new Date(Math.max(Date.now(),Date.parse(version)+1)).toISOString();
   const query=`${url}/rest/v1/ggc_state?id=eq.main&updated_at=eq.${encodeURIComponent(version)}&select=updated_at`;
   const r=await fetcher(query,{method:'PATCH',headers:{...headers(token),'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({payload,updated_at:nextVersion})});
   if(!r.ok)throw Error(`Cloud write failed: ${r.status}`);
   const rows=await r.json();
   if(rows.length!==1){ready=false;throw Error('GGC_CLOUD_CONFLICT: another device saved; reload and reconcile');}
   version=rows[0].updated_at;
   return version;
  };
  const result=queue.then(task);
  queue=result.catch(()=>{});
  return result;
 }
 return {load,save,isReady:()=>ready,getVersion:()=>version,invalidate:()=>{ready=false}};
}
