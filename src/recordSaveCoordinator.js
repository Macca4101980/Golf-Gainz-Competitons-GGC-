/** Keep a committed baseline and retain every unacknowledged change.
 * A failed write must never advance the baseline or discard pending work.
 * The queue serialises saves from a single device.
 */
import {planRecordChanges} from './recordChanges.js';
export function createRecordSaveCoordinator(store){
 let baseline=null;
 let pending=Promise.resolve();
 let generation=0;
 function initialize(snapshot){baseline=structuredClone(snapshot);generation++;}
 function enqueue(snapshot){
  const desired=structuredClone(snapshot),requestGeneration=generation;
  const work=async()=>{
   if(requestGeneration!==generation)throw Error('GGC_BASELINE_CHANGED');
   if(!baseline)throw Error('GGC_BASELINE_REQUIRED');
   const changes=planRecordChanges(baseline,desired);
   for(const change of changes){
    if(requestGeneration!==generation)throw Error('GGC_BASELINE_CHANGED');
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
  pending=result.catch(()=>{});
  return result;
 }
 return {initialize,enqueue,isInitialized:()=>baseline!==null,getBaseline:()=>baseline&&structuredClone(baseline)};
}
