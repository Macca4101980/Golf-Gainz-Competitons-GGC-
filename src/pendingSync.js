/** Persist this device's unsaved record edits before applying queued realtime updates.
 * The coordinator writes only changed records and keeps its version checks, so a concurrent
 * edit to the same score still follows the existing conflict review flow.
 */
export async function persistLocalChangesBeforeSync({coordinator,snapshot,kinds,canCommit=()=>true,onStatus=()=>{}}){
 const baseline=coordinator.getBaseline();
 if(!baseline)return false;
 const hasLocalChanges=()=>kinds.some(kind=>JSON.stringify(snapshot[kind]||[])!==JSON.stringify(coordinator.getBaseline()?.[kind]||[]));
 if(!hasLocalChanges())return true;
 if(!canCommit()){onStatus('Incoming sync paused: local edits protected');return false;}
 if(coordinator.getLastFailure?.()){
  onStatus('Local save pending — resolving before live sync');
  return false;
 }
 onStatus('Saving local changes before resuming sync…');
 try{await coordinator.enqueue(snapshot);}
 catch(error){
  onStatus('Local save failed — changes retained');
  return false;
 }
 if(!canCommit()) {onStatus('Incoming sync paused: local edits protected');return false;}
 if(hasLocalChanges()){
  onStatus('Local changes remain pending — sync will retry');
  return false;
 }
 return true;
}