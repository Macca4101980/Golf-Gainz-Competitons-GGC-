/** Compute minimal per-entity writes without overwriting unrelated records.
 * Only top-level arrays whose members have stable IDs are eligible.
 * All other fields remain on legacy storage until explicitly migrated.
 */
export const RECORD_COLLECTIONS=Object.freeze(['players','societies','comps','cards','leagues','courses']);
export function planRecordChanges(previous,next){
 const changes=[];
 for(const kind of RECORD_COLLECTIONS){
  const before=previous?.[kind],after=next?.[kind];
  if(!Array.isArray(before)||!Array.isArray(after))continue;
  const old=new Map(before.filter(x=>x&&x.id!=null).map(x=>[String(x.id),x]));
  const current=new Map(after.filter(x=>x&&x.id!=null).map(x=>[String(x.id),x]));
  // Never infer deletions from an incomplete cloud refresh.
  for(const [id,data] of current){
   if(!old.has(id)||JSON.stringify(old.get(id))!==JSON.stringify(data))
    changes.push({kind,id,data,deleted:false});
  }
 }
 return changes;
}
export async function saveRecordChanges(store,changes){
 const results=[];
 for(const change of changes){
  const version=await store.save(change.kind,change.id,change.data,{deleted:change.deleted});
  results.push({...change,version});
 }
 return results;
}
