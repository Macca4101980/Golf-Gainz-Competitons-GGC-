import {APP_RECORD_KINDS,toRecordSnapshot,mergeRecordSnapshotIntoAppState} from './recordModel.js';

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
