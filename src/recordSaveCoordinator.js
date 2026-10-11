/** Keep a committed baseline and retain every unacknowledged change.
 * A failed write must never advance the baseline or discard pending work.
 * The queue serialises saves from a single device.
 */
import {planRecordChanges} from './recordChanges.js';
export function createRecordSaveCoordinator(store){
 let baseline=null;
 let pending=Promise.resolve();
 let generation=0;
 let latestDesired=null;
 let initialization=null;
 let initializationSignature=null;
 let lastFailure=null;
 // A verified baseline must not be silently replaced by a later cloud refresh.
 function initialize(snapshot){baseline=structuredClone(snapshot);latestDesired=null;generation++;}
 async function initializeFromCloud(snapshot){
  if(baseline!==null)throw Error('GGC_BASELINE_ALREADY_INITIALIZED');
  const signature=JSON.stringify(snapshot);
  if(initialization){if(signature!==initializationSignature)throw Error('GGC_BASELINE_INITIALIZATION_IN_PROGRESS');return initialization;}
  initializationSignature=signature;
  initialization=(async()=>{
  // Validate every cloud record/version before enabling writes. Never assume a local snapshot is authoritative.
  const cloud=structuredClone(snapshot);
  for(const kind of ['players','societies','comps','cards','leagues','courses']){
   if(!Array.isArray(cloud[kind]))continue;
   for(const record of cloud[kind]){
    if(record?.id==null)throw Error('GGC_RECORD_ID_REQUIRED: '+kind);
    const remote=await store.load(kind,String(record.id));
    if(remote===null)throw Error('GGC_RECORD_MIGRATION_REQUIRED: '+kind+'/'+record.id);
    if(JSON.stringify(remote)!==JSON.stringify(record))throw Error('GGC_RECORD_BASELINE_MISMATCH: '+kind+'/'+record.id);
   }
  }
  initialize(cloud);
  })();
  try{return await initialization}finally{initialization=null;initializationSignature=null}
 }

 function enqueue(snapshot){
  const desired=structuredClone(snapshot),requestGeneration=generation;
  latestDesired=desired;
  const work=async()=>{
   if(requestGeneration!==generation)throw Error('GGC_BASELINE_CHANGED');
   if(!baseline)throw Error('GGC_BASELINE_REQUIRED');
   // Only the newest snapshot may be persisted; an older queued snapshot must never roll back a newer edit.
   if(desired!==latestDesired)return 0;
   const changes=planRecordChanges(baseline,desired);
   for(const change of changes){
    if(requestGeneration!==generation)throw Error('GGC_BASELINE_CHANGED');
    // Skip stale queued writes when a more recent snapshot has superseded this one.
    if(desired!==latestDesired)return 0;
    // New records must first establish that the ID is absent remotely.
    if(!store.hasBaseline(change.kind,change.id)){
     const existing=await store.load(change.kind,change.id);
     if(existing!==null)throw Error('GGC_RECORD_ALREADY_EXISTS: '+change.kind+'/'+change.id);
    }
    await store.save(change.kind,change.id,change.data,{deleted:change.deleted});
    // Acknowledge only this confirmed record; preserve other pending edits.
    const collection=baseline[change.kind];
    const index=collection.findIndex(record=>String(record?.id)===change.id);
    if(index>=0)collection[index]=structuredClone(change.data);
    else collection.push(structuredClone(change.data));
   }
   return changes.length;
  };
  const result=pending.then(work);
  pending=result.then(value=>{lastFailure=null;return value},error=>{lastFailure=error;});
  return result;
 }
 return {initialize,initializeFromCloud,enqueue,isInitialized:()=>baseline!==null,getBaseline:()=>baseline&&structuredClone(baseline),getLastFailure:()=>lastFailure};
}
