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
 let failedDesired=null;
 // A verified baseline must not be silently replaced by a later cloud refresh.
 function initialize(snapshot){baseline=structuredClone(snapshot);latestDesired=null;failedDesired=null;lastFailure=null;generation++;}
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

 async function initializeFromRecords(snapshot){
  if(baseline!==null)throw Error('GGC_BASELINE_ALREADY_INITIALIZED');
  if(!store.loadAll)throw Error('GGC_RECORD_LIST_UNAVAILABLE');
  const kinds=['players','societies','comps','cards','leagues','courses'];
  const records=await store.loadAll(kinds);
  if(baseline!==null)throw Error('GGC_BASELINE_ALREADY_INITIALIZED');
  const next=structuredClone(snapshot);
  for(const kind of kinds)next[kind]=records[kind];
  initialize(next);
  return structuredClone(next);
 }
 async function acceptRemoteRecord(kind,id){
  if(!baseline) return null;
  if(lastFailure||failedDesired) return null;
  if(latestDesired&&JSON.stringify(latestDesired)!==JSON.stringify(baseline)) return null;
  const current=baseline[kind];
  if(!Array.isArray(current))return null;
  const remote=await store.load(kind,String(id));
  // Recheck after the network round trip: never replace an edit made meanwhile.
  if(lastFailure||failedDesired||(latestDesired&&JSON.stringify(latestDesired)!==JSON.stringify(baseline)))return null;
  const next=structuredClone(baseline);
  const index=next[kind].findIndex(r=>String(r?.id)===String(id));
  if(index>=0)next[kind].splice(index,1);
  if(remote!==null)next[kind].push(remote);
  baseline=structuredClone(next);
  latestDesired=structuredClone(next);
  return next;
 }
 async function catchUpFromCloud(){
  if(!baseline||lastFailure||failedDesired||!store.loadAll)return null;
  await pending;
  const original=JSON.stringify(baseline);
  if(lastFailure||failedDesired||(latestDesired&&JSON.stringify(latestDesired)!==original))return null;
  const kinds=['players','societies','comps','cards','leagues','courses'];
  const staged=await store.loadAll(kinds,{commitVersions:false});
  const records=staged.records;
  if(lastFailure||failedDesired||JSON.stringify(baseline)!==original||(latestDesired&&JSON.stringify(latestDesired)!==original))return null;
  const next=structuredClone(baseline);
  for(const kind of kinds)next[kind]=records[kind];
  store.commitLoadedVersions(staged.versions);
  baseline=structuredClone(next);
  latestDesired=structuredClone(next);
  return next;
 }
 async function reconcileRecordsFromCloud(currentSnapshot,{canCommit=()=>true}={}){
  if(!baseline||lastFailure||failedDesired||!store.loadAll)return null;
  await pending;
  if(lastFailure||failedDesired)return null;
  const start=structuredClone(baseline);
  const staged=await store.loadAll(['players','societies','comps','cards','leagues','courses'],{commitVersions:false});
  if(JSON.stringify(baseline)!==JSON.stringify(start)||lastFailure||failedDesired||!canCommit())return null;
  const next=structuredClone(currentSnapshot);
  const acceptedVersions=new Map();
  let accepted=0,protectedRecords=0;
  for(const kind of ['players','societies','comps','cards','leagues','courses']){
   const base=new Map((start[kind]||[]).map(record=>[String(record.id),record]));
   const local=new Map((currentSnapshot[kind]||[]).map(record=>[String(record.id),record]));
   const remote=new Map((staged.records[kind]||[]).map(record=>[String(record.id),record]));
   const ids=new Set([...base.keys(),...local.keys(),...remote.keys()]);
   const output=[];
   for(const id of ids){
    const before=base.get(id),mine=local.get(id),theirs=remote.get(id);
    if(JSON.stringify(mine)!==JSON.stringify(before)){
     if(mine!==undefined)output.push(mine);
     protectedRecords++;
     continue;
    }
    if(theirs!==undefined)output.push(theirs);
    if(JSON.stringify(theirs)!==JSON.stringify(before))accepted++;
    const versionKey=kind+':'+id;
    if(staged.versions.has(versionKey))acceptedVersions.set(versionKey,staged.versions.get(versionKey));
   }
   next[kind]=output;
   baseline[kind]=structuredClone(output.filter(record=>JSON.stringify(local.get(String(record.id)))===JSON.stringify(base.get(String(record.id)))));
   // Retain the original acknowledged version of every locally edited record.
   for(const [id,record] of base){if(JSON.stringify(local.get(id))!==JSON.stringify(record)){
    const i=baseline[kind].findIndex(x=>String(x.id)===id);
    if(i>=0)baseline[kind][i]=structuredClone(record);else baseline[kind].push(structuredClone(record));
   }}
  }
  if(!canCommit())return null;
  store.commitLoadedVersions(acceptedVersions);
  if(!protectedRecords)latestDesired=structuredClone(baseline);
  return {snapshot:next,accepted,protectedRecords};
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
  pending=result.then(value=>{lastFailure=null;failedDesired=null;return value},error=>{lastFailure=error;failedDesired=desired;});
  return result;
 }
 return {initialize,initializeFromCloud,initializeFromRecords,acceptRemoteRecord,catchUpFromCloud,reconcileRecordsFromCloud,enqueue,isInitialized:()=>baseline!==null,getBaseline:()=>baseline&&structuredClone(baseline),getLastFailure:()=>lastFailure,getFailedDesired:()=>failedDesired&&structuredClone(failedDesired)};
}
