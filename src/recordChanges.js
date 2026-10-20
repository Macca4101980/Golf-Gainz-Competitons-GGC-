/** Compute minimal per-entity writes without overwriting unrelated records.
 * Every independently persisted app entity has a stable ID. Root app fields
 * are represented as appFields records by recordModel.js.
 */
import {recordsEqual} from './editProtection.js';
export const RECORD_COLLECTIONS=Object.freeze(['players','societies','comps','cards','leagues','courses','audit','societyInvites','appFields']);
export function planRecordChanges(previous,next){
 const changes=[];
 for(const kind of RECORD_COLLECTIONS){
  const before=previous?.[kind],after=next?.[kind];
  if(!Array.isArray(before)||!Array.isArray(after))continue;
  // Duplicate or missing IDs would make a partial snapshot silently overwrite records.
  const indexed=(items)=>{
   const map=new Map();
   for(const item of items){
    if(!item||item.id==null||String(item.id).trim()==='')throw Error('GGC_RECORD_ID_REQUIRED');
    const id=String(item.id);
    if(map.has(id))throw Error('GGC_DUPLICATE_RECORD_ID: '+kind+':'+id);
    map.set(id,item);
   }
   return map;
  };
  const old=indexed(before);
  const current=indexed(after);
  // Only explicit deletion markers authorise tombstones; never infer deletion from missing cloud rows.
  const deletionFields={societies:'deletedSocietyIds',comps:'deletedCompIds',leagues:'deletedLeagueIds',courses:'deletedCourseIds'};
  const deletedIds=new Set(Array.isArray(next?.[deletionFields[kind]])?next[deletionFields[kind]].map(String):[]);
  for(const [id,data] of old){
   if(!current.has(id)&&deletedIds.has(id))changes.push({kind,id,data,deleted:true});
  }
  for(const [id,data] of current){
   const prior=old.get(id);
   if(!prior){changes.push({kind,id,data,deleted:false});continue;}
   let writeData=data;
   if(kind==='societies'){
    // Membership, owner and admin roles are maintained by the authoritative
    // membership RPCs. Keep those server values out of a normal profile edit.
    writeData={...data};
    for(const field of ['members','admins','ownerId']){
     if(Object.prototype.hasOwnProperty.call(prior,field))writeData[field]=prior[field];
     else delete writeData[field];
    }
   }
   if(!recordsEqual(prior,writeData))changes.push({kind,id,data:writeData,deleted:false});
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
