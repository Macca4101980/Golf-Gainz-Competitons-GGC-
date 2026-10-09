/** Serialize record writes, retain a committed baseline, and never advance it on failure. */
import {planRecordChanges,saveRecordChanges} from './recordChanges.js';
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
   if(changes.length)await saveRecordChanges(store,changes);
   baseline=desired;
   return changes.length;
  };
  const result=pending.then(work);
  pending=result.catch(()=>{});
  return result;
 }
 return {initialize,enqueue,isInitialized:()=>baseline!==null};
}
