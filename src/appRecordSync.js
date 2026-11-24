import {APP_RECORD_KINDS,toRecordSnapshot,mergeRecordSnapshotIntoAppState} from './recordModel.js';
import {createRecordStore} from './recordStore.js';
import {createRecordSaveCoordinator} from './recordSaveCoordinator.js';

const localScoreChangedAt=record=>Date.parse(record?.updatedAt||record?.submittedAt||record?.startedAt||0)||0;
const retainNewerLocalRows=(remote=[],local=[])=>{
 const localById=new Map((local||[]).map(item=>[String(item.id),item]));
 const output=(remote||[]).map(item=>{
  const pending=localById.get(String(item.id));
  localById.delete(String(item.id));
  return pending&&localScoreChangedAt(pending)>localScoreChangedAt(item)?structuredClone(pending):item;
 });
 // A locally-created row with an explicit edit timestamp has not reached the
 // server yet. Retain it so the normal coordinator can insert it after load.
 for(const pending of localById.values())if(localScoreChangedAt(pending)>0)output.push(structuredClone(pending));
 return output;
};

function retainNewerLocalScoreEdits(snapshot,local){
 const next=structuredClone(snapshot);
 next.cards=retainNewerLocalRows(snapshot.cards,local?.cards);
 const localComps=new Map((local?.comps||[]).map(comp=>[String(comp.id),comp]));
 next.comps=(snapshot.comps||[]).map(comp=>{
  const pending=localComps.get(String(comp.id));
  if(!pending)return comp;
  const roundGroups=retainNewerLocalRows(comp.roundGroups,pending.roundGroups);
  return {...comp,roundGroups};
 });
 return next;
}

/** One session per signed-in account. Refreshing a token must not reinitialize
 * versions or replace pending edits. Server migrations own the initial import;
 * browser seed data and old local snapshots must never bootstrap shared rows.
 */
export function createAppRecordSession(client){
 const store=createRecordStore(client);
 const coordinator=createRecordSaveCoordinator(store);
 let loading;
 return {store,coordinator,hydrated:false,
  async load(snapshot,context={}){
   if(!loading)loading=(async()=>{
    // Audit history grows continuously and is not required to render the app.
    // Load the operational records first so a large audit cannot hold the
    // signed-in user on the profile loading screen.
    const startupKinds=APP_RECORD_KINDS.filter(kind=>kind!=='audit');
    const records=await store.loadAll(startupKinds);
    records.audit=[];
    const base={...snapshot,settings:{},contacts:{},hiddenContacts:{},identityLinks:{},oom:{},
     deletedCompIds:[],deletedCardIds:[],deletedSocietyIds:[],deletedCourseIds:[],deletedLeagueIds:[]};
    const cloud=mergeRecordSnapshotIntoAppState(base,records,context);
    // A failed/offline score is deliberately retained in localStorage. Keep
    // only newer local score rows during the next startup so an app update or
    // reopen cannot replace them with the older cloud copy. The coordinator
    // still starts from the cloud baseline and will save these as normal
    // field-level changes once readiness is established.
    const next=retainNewerLocalScoreEdits(cloud,snapshot);
    // Historical audit rows are append-only and are not needed to render or
    // safely save operational records. Initialising immediately keeps a large
    // audit history from disabling score entry and pull-to-refresh on startup.
    // New audit events are still added as independent versioned records.
    coordinator.initialize(records);
    const finishHydration=Promise.resolve({records,audit:[]});
    return {snapshot:next,records,finishHydration};
   })().catch(error=>{loading=null;throw error});
   const result=await loading;
   return {...structuredClone({snapshot:result.snapshot,records:result.records}),finishHydration:result.finishHydration};
  }
 };
}

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const changedAt=record=>Date.parse(record?.updatedAt||record?.submittedAt||0)||0;

/**
 * Check the legacy snapshot against the versioned rows, add only genuinely
 * absent rows with insert-if-absent versions, and initialize the coordinator
 * from the confirmed canonical records. Existing mismatches stop sync for
 * review; they never get silently overwritten by the snapshot.
 */
export async function prepareAppRecordBaseline({store,coordinator,snapshot,context={}}){
 if(!store||!coordinator)throw Error('GGC_RECORD_STORE_REQUIRED');
 if(coordinator.isInitialized())throw Error('GGC_RECORD_BASELINE_ALREADY_INITIALIZED');
 const desired=toRecordSnapshot(snapshot,context);
 const loaded=await store.loadAll(APP_RECORD_KINDS);
 const canonical=structuredClone(desired);
 let inserted=0;
 for(const kind of APP_RECORD_KINDS){
  const remote=new Map((loaded[kind]||[]).map(record=>[String(record.id),record]));
  const legacy=new Map((desired[kind]||[]).map(record=>[String(record.id),record]));
  const output=[];
  for(const [id,record] of remote)output.push(structuredClone(record));
  for(const [id,record] of legacy){
   const stored=remote.get(id);
   if(stored){
    if(same(stored,record))continue;
    if(kind==='cards'&&changedAt(stored)>changedAt(record)){
     const index=output.findIndex(item=>String(item.id)===id);
     if(index>=0)output[index]=structuredClone(stored);
     continue;
    }
    throw Error('GGC_RECORD_BASELINE_MISMATCH: '+kind+'/'+id);
   }
   // A version without a visible row is a server tombstone. Never resurrect it
   // from an old browser snapshot.
   if(store.hasBaseline(kind,id))continue;
   await store.save(kind,id,record);
   output.push(structuredClone(record));
   inserted++;
  }
  canonical[kind]=output;
 }
 const next=mergeRecordSnapshotIntoAppState(snapshot,canonical,context);
 coordinator.initialize(canonical);
 return {inserted,snapshot:next,records:canonical};
}
