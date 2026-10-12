/** Serialize record writes, retain a committed baseline, and never advance it on failure. */
import {planRecordChanges,saveRecordChanges} from './recordChanges.js';
export function createRecordSaveCoordinator(store){
 let baseline=null;
 let pending=Promise.resolve();
 let generation=0;
 let blocked=false;
 let queued=0;
 function initialize(snapshot){
  if(queued)throw Error('GGC_REINITIALIZE_DURING_SAVE: wait for pending writes');
  baseline=structuredClone(snapshot);generation++;blocked=false;
 }
 function enqueue(snapshot){
  const desired=structuredClone(snapshot),requestGeneration=generation;
  const work=async()=>{
   if(requestGeneration!==generation)throw Error('GGC_BASELINE_CHANGED');
   if(blocked)throw Error('GGC_PARTIAL_RECORD_SAVE: reload and reconcile');
   if(!baseline)throw Error('GGC_BASELINE_REQUIRED');
   const changes=planRecordChanges(baseline,desired);
   if(changes.length){try{await saveRecordChanges(store,changes)}catch(error){blocked=true;throw error}}
   baseline=desired;
   return changes.length;
  };
  queued++;
  const result=pending.then(work);
  pending=result.catch(()=>{});
  return result.finally(()=>{queued--;});
 }
 return {initialize,enqueue,isInitialized:()=>baseline!==null,isBlocked:()=>blocked};
}
