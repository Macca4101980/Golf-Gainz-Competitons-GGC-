const stableValue=value=>Array.isArray(value)?value.map(stableValue):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])])):value;
const sameRecord=(a,b)=>JSON.stringify(stableValue(a))===JSON.stringify(stableValue(b));
const changedAt=record=>Date.parse(record?.updatedAt||record?.submittedAt||0)||0;

/** Verify card rows against the loaded live snapshot before enabling card-only writes.
 * A newer record row can recover a score missed by the legacy state write.
 * Older ambiguous mismatches fail closed; absent rows are inserted with version checks.
 */
export async function prepareScorecardRecordBaseline({store,coordinator,cards}){
 if(!store||!coordinator)throw Error('GGC_CARD_STORE_REQUIRED');
 if(coordinator.isInitialized())throw Error('GGC_CARD_BASELINE_ALREADY_INITIALIZED');
 if(!Array.isArray(cards))throw Error('GGC_CARD_SNAPSHOT_REQUIRED');
 const ids=new Set();
 for(const card of cards){
  if(!card||card.id==null||String(card.id).trim()==='')throw Error('GGC_CARD_ID_REQUIRED');
  const id=String(card.id);
  if(ids.has(id))throw Error('GGC_DUPLICATE_CARD_ID: '+id);
  ids.add(id);
 }
 const loaded=await store.loadAll(['cards']);
 if(!Array.isArray(loaded.cards))throw Error('GGC_CARD_READ_INCOMPLETE');
 const remote=new Map(loaded.cards.map(card=>[String(card.id),card]));
 const canonical=structuredClone(cards);
 for(let i=0;i<canonical.length;i++){
  const existing=remote.get(String(canonical[i].id));
  if(existing&&!sameRecord(existing,canonical[i])){
   if(changedAt(existing)>changedAt(canonical[i]))canonical[i]=structuredClone(existing);
   else throw Error('GGC_CARD_BASELINE_MISMATCH: '+canonical[i].id);
  }
 }
 let inserted=0;
 for(const card of canonical){
  if(remote.has(String(card.id)))continue;
  await store.save('cards',String(card.id),card);
  inserted++;
 }
 coordinator.initialize({cards:structuredClone(canonical)});
 return {inserted,cards:canonical};
}
