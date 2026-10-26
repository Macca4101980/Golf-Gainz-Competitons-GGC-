/** Keep a committed baseline and retain every unacknowledged change.
 * A failed write must never advance the baseline or discard pending work.
 * The queue serialises saves from a single device.
 */
import {planRecordChanges,RECORD_COLLECTIONS} from './recordChanges.js';
import {changedFields,reconcileRecord} from './editProtection.js';
import {mergeScorecardConflict} from './scorecardConflict.js';

function mergeAppendOnlyIds(baseline=[],local=[],remote=[],field='entries'){
 const base=new Set((baseline||[]).map(String)),mine=new Set((local||[]).map(String)),theirs=new Set((remote||[]).map(String));
 if([...base].some(id=>!mine.has(id)||!theirs.has(id)))return {merged:[...(remote||[])],conflicts:[field+' removal requires review']};
 return {merged:[...new Set([...(remote||[]),...(local||[])])],conflicts:[]};
}
function mergeHoleArray(baseline=[],local=[],remote=[],field='gross'){
 const merged=structuredClone(remote||[]),conflicts=[];
 for(let hole=0;hole<Math.max(baseline?.length||0,local?.length||0,remote?.length||0);hole++){
  if(JSON.stringify(local?.[hole])===JSON.stringify(baseline?.[hole]))continue;
  if(JSON.stringify(remote?.[hole])!==JSON.stringify(baseline?.[hole])&&JSON.stringify(remote?.[hole])!==JSON.stringify(local?.[hole])){conflicts.push(field+'['+hole+']');continue}
  merged[hole]=structuredClone(local?.[hole]);
 }
 return {merged,conflicts};
}
function mergeRoundGroups(baseline=[],local=[],remote=[]){
 const conflicts=[],base=new Map((baseline||[]).map(x=>[String(x.id),x])),mine=new Map((local||[]).map(x=>[String(x.id),x])),theirs=new Map((remote||[]).map(x=>[String(x.id),x]));
 for(const [id,group] of base){if(!mine.has(id)||!theirs.has(id))return {merged:structuredClone(remote||[]),conflicts:['roundGroups deletion requires review']};}
 const addedLocal=[...mine.entries()].filter(([id])=>!base.has(id)),addedRemote=[...theirs.entries()].filter(([id])=>!base.has(id));
 for(const [,a] of addedLocal)for(const [,b] of addedRemote){
  const ap=[...(a.playerIds||[])].map(String).sort().join('|'),bp=[...(b.playerIds||[])].map(String).sort().join('|');
  if(ap&&ap===bp&&String(a.id)!==String(b.id))return {merged:structuredClone(remote||[]),conflicts:['roundGroups for the same golfers require review']};
 }
 const out=[];
 for(const id of new Set([...theirs.keys(),...mine.keys()])){
  const b=base.get(id),m=mine.get(id),r=theirs.get(id);
  if(b&&m&&r){
   const gross=mergeHoleArray(b.teamGross||[],m.teamGross||[],r.teamGross||[],'teamGross');
   if(gross.conflicts.length)conflicts.push(...gross.conflicts.map(x=>'roundGroups/'+id+'/'+x));
   const localMeta={...m,teamGross:structuredClone(r.teamGross||[])};
   const dirty=changedFields(b,localMeta).filter(f=>!['startedAt','startedBy'].includes(f));
   const result=reconcileRecord({baseline:b,local:localMeta,remote:r,dirtyFields:dirty});
   if(result.conflicts.length)conflicts.push(...result.conflicts.map(x=>'roundGroups/'+id+'/'+x));
   result.merged.teamGross=gross.merged;
   if(JSON.stringify(m.startedAt)!==JSON.stringify(b.startedAt))result.merged.startedAt=m.startedAt;
   if(JSON.stringify(m.startedBy)!==JSON.stringify(b.startedBy))result.merged.startedBy=m.startedBy;
   out.push(result.merged);
  }else if(m&&r){
   const result=reconcileRecord({baseline:{},local:m,remote:r,dirtyFields:changedFields({},m).filter(f=>!['startedAt','startedBy'].includes(f))});
   if(result.conflicts.length)conflicts.push(...result.conflicts.map(x=>'roundGroups/'+id+'/'+x));
   if(m.startedAt!==undefined)result.merged.startedAt=m.startedAt;
   if(m.startedBy!==undefined)result.merged.startedBy=m.startedBy;
   out.push(result.merged);
  }else out.push(structuredClone(m||r));
 }
 return {merged:out,conflicts};
}

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
  for(const kind of RECORD_COLLECTIONS){
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
  const kinds=RECORD_COLLECTIONS;
  const records=await store.loadAll(kinds);
  if(baseline!==null)throw Error('GGC_BASELINE_ALREADY_INITIALIZED');
  const next=structuredClone(snapshot);
  for(const kind of kinds)next[kind]=records[kind];
  initialize(next);
  return structuredClone(next);
 }
 async function acceptRemoteRecord(kind,id,{canCommit=()=>true,currentSnapshot=null}={}){
  if(!baseline||lastFailure||failedDesired)return null;
  await pending;
  if(!baseline||lastFailure||failedDesired)return null;
  // Reconcile a realtime record against the live form snapshot. This preserves
  // locally edited fields while allowing unrelated remote fields (including
  // different scorecard holes) to appear immediately.
  if(!currentSnapshot&&latestDesired&&planRecordChanges(baseline,latestDesired).length)return null;
  const desiredAtRead=latestDesired;
  const original=structuredClone(baseline),desired=structuredClone(currentSnapshot||latestDesired||baseline);
  if(!Array.isArray(original[kind])||!Array.isArray(desired[kind]))return null;
  const before=original[kind].find(r=>String(r?.id)===String(id));
  const local=desired[kind].find(r=>String(r?.id)===String(id));
  if(before!==undefined&&local===undefined)return {conflicts:[kind+'/'+id+'/local deletion requires review']};
  const staged=store.loadStaged?await store.loadStaged(kind,String(id)):null;
  const remote=staged?staged.record:await store.load(kind,String(id));
  // An edit can be enqueued while load is awaiting the network, before its save
  // advances baseline. Never return the older desired snapshot over that edit.
  if(latestDesired!==desiredAtRead||lastFailure||failedDesired||JSON.stringify(baseline)!==JSON.stringify(original)||!canCommit())return null;
  const dirty=before!==undefined&&local!==undefined?changedFields(before,local):[];
  let merged=remote;
  if(dirty.length){
   if(!remote)return {conflicts:[kind+'/'+id+'/record deleted remotely']};
   const result=kind==='cards'
    ?mergeScorecardConflict({baseline:before,local,remote})
    :reconcileRecord({baseline:before,local,remote,dirtyFields:dirty.filter(field=>field!=='updatedAt')});
   if(result.conflicts.length)return {conflicts:result.conflicts.map(field=>kind+'/'+id+'/'+field)};
   merged=result.merged;
   if(local.updatedAt!==undefined&&local.updatedAt!==before.updatedAt)merged.updatedAt=local.updatedAt;
  }
  const nextBaseline=structuredClone(original),nextDesired=structuredClone(desired);
  const replace=(collection,value)=>{
   const i=collection.findIndex(r=>String(r?.id)===String(id));
   if(i>=0)collection.splice(i,1);
   if(value!==null)collection.push(structuredClone(value));
  };
  replace(nextBaseline[kind],remote);
  replace(nextDesired[kind],merged);
  if(staged)store.commitStagedReads([staged]);
  baseline=nextBaseline;
  latestDesired=nextDesired;
  return structuredClone(nextDesired);
 }
 async function catchUpFromCloud(){
  if(!baseline||lastFailure||failedDesired||!store.loadAll)return null;
  await pending;
  const original=JSON.stringify(baseline);
  if(lastFailure||failedDesired||(latestDesired&&JSON.stringify(latestDesired)!==original))return null;
  const kinds=RECORD_COLLECTIONS;
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
  const staged=await store.loadAll(RECORD_COLLECTIONS,{commitVersions:false});
  if(JSON.stringify(baseline)!==JSON.stringify(start)||lastFailure||failedDesired||!canCommit())return null;
  const next=structuredClone(currentSnapshot);
  const nextBaseline=structuredClone(start);
  const acceptedVersions=new Map();
  let accepted=0,protectedRecords=0;
  const protectedDetails=[];
  for(const kind of RECORD_COLLECTIONS){
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
 async function recoverVersionConflict(currentSnapshot,{canCommit=()=>true}={}){
  if(!baseline||!lastFailure||!/GGC_VERSION_CONFLICT/.test(lastFailure.message||''))return null;
  await pending;
  const original=structuredClone(baseline);
  const changes=planRecordChanges(original,currentSnapshot);
  if(!changes.length)return null;
  // Deletes need explicit review; additions and field edits can be safely rebased
  // when the remote row is absent or the edited fields do not conflict.
  if(changes.some(change=>change.deleted))
   return {conflicts:changes.filter(change=>change.deleted).map(change=>change.kind+'/'+change.id+'/deletion requires review')};
  const rebased=structuredClone(currentSnapshot),remoteBaseline=structuredClone(original);
  const conflicts=[],conflictDetails=[],stagedReads=[];
  for(const change of changes){
   const kind=change.kind;
   const before=(original[kind]||[]).find(record=>String(record.id)===change.id);
   const mine=(currentSnapshot[kind]||[]).find(record=>String(record.id)===change.id);
   if(!mine)return {conflicts:[kind+'/'+change.id+'/local record missing requires review']};
   const staged=store.loadStaged?await store.loadStaged(kind,change.id):null;
   const remote=staged?staged.record:await store.load(kind,change.id);
   if(staged)stagedReads.push(staged);
   if(!before){
    if(remote===null)continue; // Keep the local insert pending; enqueue will verify the ID is still absent.
    if(JSON.stringify(remote)===JSON.stringify(mine)){
     rebased[kind]=rebased[kind].map(record=>String(record.id)===change.id?remote:record);
     if(!remoteBaseline[kind].some(record=>String(record.id)===change.id))remoteBaseline[kind].push(remote);
     continue;
    }
    conflicts.push('new '+kind+' record already exists remotely: '+change.id);
    continue;
   }
   if(!remote)return {conflicts:[kind+' record deleted remotely: '+change.id]};
   let result;
   if(kind==='cards'){
    result=mergeScorecardConflict({baseline:before,local:mine,remote});
   }else{
    let localForMerge=structuredClone(mine);
    if(kind==='comps'){
     const entries=mergeAppendOnlyIds(before.entries||[],mine.entries||[],remote.entries||[],'entries');
     const groups=mergeRoundGroups(before.roundGroups||[],mine.roundGroups||[],remote.roundGroups||[]);
     if(entries.conflicts.length||groups.conflicts.length){
      conflicts.push(...entries.conflicts.map(x=>'comps/'+change.id+'/'+x),...groups.conflicts.map(x=>'comps/'+change.id+'/'+x));
      continue;
     }
     if(JSON.stringify(mine.entries||[])!==JSON.stringify(before.entries||[])||JSON.stringify(remote.entries||[])!==JSON.stringify(before.entries||[]))localForMerge.entries=entries.merged;
     if(JSON.stringify(mine.roundGroups||[])!==JSON.stringify(before.roundGroups||[])||JSON.stringify(remote.roundGroups||[])!==JSON.stringify(before.roundGroups||[]))localForMerge.roundGroups=groups.merged;
    }
    const dirty=changedFields(before,localForMerge).filter(field=>field!=='updatedAt'&&!(kind==='comps'&&['entries','roundGroups'].includes(field)));
    result=reconcileRecord({baseline:before,local:localForMerge,remote,dirtyFields:dirty});
    if(kind==='comps'){
     if(Object.prototype.hasOwnProperty.call(localForMerge,'entries'))result.merged.entries=structuredClone(localForMerge.entries);
     if(Object.prototype.hasOwnProperty.call(localForMerge,'roundGroups'))result.merged.roundGroups=structuredClone(localForMerge.roundGroups);
    }
    if(kind==='societies'){
     if(dirty.includes('members')&&!result.conflicts.includes('members'))result.conflicts.push('members require authoritative membership action');
     if(dirty.some(field=>['ownerId','admins'].includes(field)))result.conflicts.push('membership permissions require review');
    }
    if(Object.prototype.hasOwnProperty.call(mine,'updatedAt')&&JSON.stringify(mine.updatedAt)!==JSON.stringify(before.updatedAt))result.merged.updatedAt=structuredClone(mine.updatedAt);
   }
   if(result.conflicts.length){
    conflicts.push(...result.conflicts.map(field=>(kind==='cards'?'':kind+'/')+change.id+'/'+field));
    if(kind==='cards')for(const field of result.conflicts){const match=/^gross\[(\d+)\]$/.exec(field);if(match){const hole=Number(match[1]);conflictDetails.push({cardId:change.id,playerId:mine.playerId,compId:mine.compId,hole,localScore:mine.gross?.[hole]??'',cloudScore:remote.gross?.[hole]??''});}}
    continue;
   }
   rebased[kind]=rebased[kind].map(record=>String(record.id)===change.id?result.merged:record);
   remoteBaseline[kind]=remoteBaseline[kind].map(record=>String(record.id)===change.id?remote:record);
  }
  // The form can change before its debounce enqueues the next desired snapshot.
  // Recheck that live form as well as the queue before advancing either baseline.
  if(!canCommit())return null;
  if(conflicts.length)return {conflicts,conflictDetails};
  if(JSON.stringify(baseline)!==JSON.stringify(original))return null;
  if(JSON.stringify(currentSnapshot)!==JSON.stringify(latestDesired))return null;
  if(stagedReads.length)store.commitStagedReads(stagedReads);
  baseline=remoteBaseline;
  latestDesired=structuredClone(rebased);
  failedDesired=null;
  lastFailure=null;
  return {snapshot:rebased,conflicts:[]};
 }
 /** Resolve only explicitly reviewed score conflicts. Recheck every remote score
  * before applying the decision; a newly changed cloud score needs new review.
  */
 async function resolveScorecardConflicts(currentSnapshot,decisions,expectedDetails){
  if(!baseline||!lastFailure||!/GGC_VERSION_CONFLICT/.test(lastFailure.message||''))throw Error('GGC_CONFLICT_NOT_ACTIVE');
  await pending;
  if(JSON.stringify(currentSnapshot)!==JSON.stringify(latestDesired))throw Error('GGC_LOCAL_CHANGES_SINCE_REVIEW');
  const original=structuredClone(baseline);
  const changes=planRecordChanges(original,currentSnapshot);
  if(!changes.length||changes.some(c=>c.kind!=='cards'||c.deleted))throw Error('GGC_UNSUPPORTED_CONFLICT');
  const rebased=structuredClone(currentSnapshot),remoteBaseline=structuredClone(original);
  for(const change of changes){
   const before=(original.cards||[]).find(x=>String(x.id)===change.id);
   const mine=(currentSnapshot.cards||[]).find(x=>String(x.id)===change.id);
   if(!before||!mine)throw Error('GGC_CARD_MISSING');
   const remote=await store.load('cards',change.id);
   if(!remote)throw Error('GGC_CARD_DELETED');
   const {merged,conflicts}=mergeScorecardConflict({baseline:before,local:mine,remote});
   for(const field of conflicts){
    const match=/^gross\[(\d+)\]$/.exec(field);
    if(!match)throw Error('GGC_OTHER_CONFLICT_REQUIRES_REVIEW: '+field);
    const hole=Number(match[1]),key=change.id+'/gross['+hole+']';
    const expected=expectedDetails.find(d=>d.cardId===change.id&&d.hole===hole);
    if(!expected||JSON.stringify(remote.gross?.[hole]??'')!==JSON.stringify(expected.cloudScore))throw Error('GGC_CLOUD_SCORE_CHANGED_AGAIN');
    if(!Object.prototype.hasOwnProperty.call(decisions,key))throw Error('GGC_SCORE_DECISION_REQUIRED');
    merged.gross[hole]=decisions[key];
   }
   // A conflict that disappeared since review is also a new cloud state: request review again.
   for(const detail of expectedDetails.filter(d=>d.cardId===change.id)){
    if(JSON.stringify(remote.gross?.[detail.hole]??'')!==JSON.stringify(detail.cloudScore))throw Error('GGC_CLOUD_SCORE_CHANGED_AGAIN');
   }
   rebased.cards=rebased.cards.map(x=>String(x.id)===change.id?merged:x);
   remoteBaseline.cards=remoteBaseline.cards.map(x=>String(x.id)===change.id?remote:x);
  }
  if(JSON.stringify(baseline)!==JSON.stringify(original)||JSON.stringify(latestDesired)!==JSON.stringify(currentSnapshot))throw Error('GGC_CONFLICT_STATE_CHANGED');
  baseline=remoteBaseline;latestDesired=structuredClone(rebased);lastFailure=null;failedDesired=null;
  return rebased;
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
   // Persist new golfers before any group reference to them. Membership itself is managed by the authoritative membership API.
   const ordered=[...changes.filter(c=>c.kind==='players'&&!c.deleted),...changes.filter(c=>!(c.kind==='players'&&!c.deleted))];
   for(const change of ordered){
    if(requestGeneration!==generation)throw Error('GGC_BASELINE_CHANGED');
    // Skip stale queued writes when a more recent snapshot has superseded this one.
    if(desired!==latestDesired)return 0;
    // New records must first establish that the ID is absent remotely.
    if(!store.hasBaseline(change.kind,change.id)){
     if((baseline[change.kind]||[]).some(record=>String(record.id)===change.id))throw Error('GGC_VERSION_CONFLICT: acknowledged record needs reconciliation');
     const existing=await store.load(change.kind,change.id);
     if(existing!==null)throw Error('GGC_RECORD_ALREADY_EXISTS: '+change.kind+'/'+change.id);
    }
    try{
     if(store.hasBaseline(change.kind,change.id)&&store.saveFields){
      const before=(baseline[change.kind]||[]).find(record=>String(record?.id)===change.id)||{};
      await store.saveFields(change.kind,change.id,change.data,change.deleted?[]:changedFields(before,change.data),{deleted:change.deleted});
     }else await store.save(change.kind,change.id,change.data,{deleted:change.deleted});
    }catch(error){throw new Error('GGC_RECORD_SAVE_FAILED ['+change.kind+'/'+change.id+']: '+(error?.message||String(error)),{cause:error});}
    // Acknowledge only this confirmed record; preserve other pending edits.
    const collection=baseline[change.kind];
    const index=collection.findIndex(record=>String(record?.id)===change.id);
    if(change.deleted){if(index>=0)collection.splice(index,1);}
    else if(index>=0)collection[index]=structuredClone(change.data);
    else collection.push(structuredClone(change.data));
   }
   return changes.length;
  };
  const result=pending.then(work);
  pending=result.then(value=>{if(desired===latestDesired){lastFailure=null;failedDesired=null;}return value},error=>{lastFailure=error;failedDesired=desired;});
  return result;
 }
  return {initialize,initializeFromCloud,initializeFromRecords,acceptRemoteRecord,catchUpFromCloud,reconcileRecordsFromCloud,recoverVersionConflict,resolveScorecardConflicts,enqueue,isInitialized:()=>baseline!==null,getBaseline:()=>baseline&&structuredClone(baseline),getDesired:()=>latestDesired&&structuredClone(latestDesired),getLastFailure:()=>lastFailure,getFailedDesired:()=>failedDesired&&structuredClone(failedDesired)};
}
