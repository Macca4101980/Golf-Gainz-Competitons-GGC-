/** Keep a committed baseline and retain every unacknowledged change.
 * A failed write must never advance the baseline or discard pending work.
 * The queue serialises saves from a single device.
 */
import {planRecordChanges} from './recordChanges.js';
import {changedFields,reconcileRecord} from './editProtection.js';
import {mergeScorecardConflict} from './scorecardConflict.js';
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
 function initialize(snapshot){if(baseline!==null)throw Error('GGC_BASELINE_ALREADY_INITIALIZED');baseline=structuredClone(snapshot);latestDesired=null;failedDesired=null;lastFailure=null;generation++;}
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
 async function acceptRemoteRecord(kind,id,{canCommit=()=>true}={}){
  if(!baseline) return null;
  if(lastFailure||failedDesired) return null;
  if(latestDesired&&JSON.stringify(latestDesired)!==JSON.stringify(baseline)) return null;
  const current=baseline[kind];
  if(!Array.isArray(current))return null;
  const remote=await store.load(kind,String(id));
  // Recheck after the network round trip: never replace an edit made meanwhile.
  if(lastFailure||failedDesired||!canCommit()||(latestDesired&&JSON.stringify(latestDesired)!==JSON.stringify(baseline)))return null;
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
  const nextBaseline=structuredClone(start);
  const acceptedVersions=new Map();
  let accepted=0,protectedRecords=0;
  const protectedDetails=[];
  for(const kind of ['players','societies','comps','cards','leagues','courses']){
   const base=new Map((start[kind]||[]).map(record=>[String(record.id),record]));
   const local=new Map((currentSnapshot[kind]||[]).map(record=>[String(record.id),record]));
   const remote=new Map((staged.records[kind]||[]).map(record=>[String(record.id),record]));
   const ids=new Set([...base.keys(),...local.keys(),...remote.keys()]);
   const output=[];
   for(const id of ids){
    const before=base.get(id),mine=local.get(id),theirs=remote.get(id);
    if(JSON.stringify(mine)!==JSON.stringify(before)){
     const dirtyFields=changedFields(before,mine);
     // Merge unrelated remote fields without replacing locally edited fields.
     // Preserve the original acknowledged baseline/version so conflicting writes
     // must pass optimistic concurrency checks before reaching Supabase.
     const merged=(before!==undefined&&mine!==undefined&&theirs!==undefined)
      ?reconcileRecord({baseline:before,local:mine,remote:theirs,dirtyFields})
      :{merged:mine,conflicts:[]};
     if(mine!==undefined)output.push(merged.merged);
     protectedDetails.push({kind,id,reason:before===undefined?'local-only':mine===undefined?'locally-removed':'locally-modified',changedFields:dirtyFields,conflicts:merged.conflicts});
     protectedRecords++;
     continue;
    }
    if(theirs!==undefined)output.push(theirs);
    if(JSON.stringify(theirs)!==JSON.stringify(before))accepted++;
    const versionKey=kind+':'+id;
    if(staged.versions.has(versionKey))acceptedVersions.set(versionKey,staged.versions.get(versionKey));
   }
   next[kind]=output;
   nextBaseline[kind]=structuredClone(output.filter(record=>JSON.stringify(local.get(String(record.id)))===JSON.stringify(base.get(String(record.id)))));
   // Retain the original acknowledged version of every locally edited record.
   for(const [id,record] of base){if(JSON.stringify(local.get(id))!==JSON.stringify(record)){
    const i=nextBaseline[kind].findIndex(x=>String(x.id)===id);
    if(i>=0)nextBaseline[kind][i]=structuredClone(record);else nextBaseline[kind].push(structuredClone(record));
   }}
  }
  if(!canCommit())return null;
  baseline=nextBaseline;
  store.commitLoadedVersions(acceptedVersions);
  if(!protectedRecords)latestDesired=structuredClone(baseline);
  return {snapshot:next,accepted,protectedRecords,protectedDetails};
 }
 /** Rebase a rejected card save against the server without ever dropping a hole edit.
  * Return conflicts for human review instead of automatically choosing a winner.
  */
 async function recoverVersionConflict(currentSnapshot){
  if(!baseline||!lastFailure||!/GGC_VERSION_CONFLICT/.test(lastFailure.message||''))return null;
  await pending;
  const original=structuredClone(baseline);
  const changes=planRecordChanges(original,currentSnapshot);
  if(!changes.length)return null;
  // Only safe field-level changes are automatically rebased. Membership removals,
  // concurrent membership edits and deletions must be reviewed explicitly.
  if(changes.some(change=>!['cards','societies'].includes(change.kind)||change.deleted))
   return {conflicts:['unsupported record change requires review']};
  const rebased=structuredClone(currentSnapshot);
  const remoteBaseline=structuredClone(original);
  const conflicts=[];
  for(const change of changes){
   const kind=change.kind;
   const before=(original[kind]||[]).find(record=>String(record.id)===change.id);
   const mine=(currentSnapshot[kind]||[]).find(record=>String(record.id)===change.id);
   if(!before||!mine)return {conflicts:['new or missing '+kind+' record requires review']};
   const remote=await store.load(kind,change.id);
   if(!remote)return {conflicts:[kind+' record deleted remotely: '+change.id]};
   let result;
   if(kind==='cards'){
    result=mergeScorecardConflict({baseline:before,local:mine,remote});
   }else{
    const dirty=changedFields(before,mine);
    result=reconcileRecord({baseline:before,local:mine,remote,dirtyFields:dirty});
    // Membership changes must use authoritative membership actions, never a generic retry.
    if(dirty.includes('members') && !result.conflicts.includes('members'))
     result.conflicts.push('members require authoritative membership action');
    // Owner/admin permission changes are always reviewed rather than auto-retried.
    if(dirty.some(field=>['ownerId','admins'].includes(field)))
     result.conflicts.push('membership permissions require review');
   }
   if(result.conflicts.length){
    conflicts.push(...result.conflicts.map(field=>(kind==='cards'?'':kind+'/')+change.id+'/'+field));
    continue;
   }
   rebased[kind]=rebased[kind].map(record=>String(record.id)===change.id?result.merged:record);
   remoteBaseline[kind]=remoteBaseline[kind].map(record=>String(record.id)===change.id?remote:record);
  }
  if(conflicts.length)return {conflicts};
  if(JSON.stringify(baseline)!==JSON.stringify(original))return null;
  if(JSON.stringify(currentSnapshot)!==JSON.stringify(latestDesired))return null;
  baseline=remoteBaseline;
  latestDesired=structuredClone(rebased);
  failedDesired=null;
  lastFailure=null;
  return {snapshot:rebased,conflicts:[]};
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
   const newIds=new Set(changes.filter(c=>c.kind==='players'&&!c.deleted&&!baseline.players.some(p=>String(p.id)===c.id)).map(c=>c.id));
   const priority=changes.filter(c=>c.kind==='societies'&&!c.deleted&&(c.data.members||[]).some(id=>newIds.has(String(id))));
   const ordered=[...priority,...changes.filter(c=>!priority.includes(c))];
   for(const change of ordered){
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
  pending=result.then(value=>{if(desired===latestDesired){lastFailure=null;failedDesired=null;}return value},error=>{lastFailure=error;failedDesired=desired;});
  return result;
 }
 return {initialize,initializeFromCloud,initializeFromRecords,acceptRemoteRecord,catchUpFromCloud,reconcileRecordsFromCloud,recoverVersionConflict,enqueue,isInitialized:()=>baseline!==null,getBaseline:()=>baseline&&structuredClone(baseline),getLastFailure:()=>lastFailure,getFailedDesired:()=>failedDesired&&structuredClone(failedDesired)};
}
