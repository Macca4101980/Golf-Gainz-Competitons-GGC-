/** Per-field, version-aware reconciliation for live GGC editing.
 * Local dirty fields win over incoming cloud refreshes until acknowledged.
 * Unrelated remote fields are merged; concurrent edits to the same field conflict.
 */
export function changedFields(before={},after={}){
 const keys=new Set([...Object.keys(before||{}),...Object.keys(after||{})]);
 return [...keys].filter(k=>JSON.stringify(before?.[k])!==JSON.stringify(after?.[k]));
}
export function reconcileRecord({baseline={},local={},remote={},dirtyFields=[]}){
 const dirty=new Set(dirtyFields);
 const merged=structuredClone(remote);
 const conflicts=[];
 for(const field of dirty){
  const remoteChanged=JSON.stringify(remote?.[field])!==JSON.stringify(baseline?.[field]);
  const localChanged=JSON.stringify(local?.[field])!==JSON.stringify(baseline?.[field]);
  if(remoteChanged&&localChanged&&JSON.stringify(remote?.[field])!==JSON.stringify(local?.[field]))conflicts.push(field);
  if(localChanged){
   if(Object.prototype.hasOwnProperty.call(local,field))merged[field]=structuredClone(local[field]);
   else delete merged[field];
  }
 }
 return {merged,conflicts};
}
export function createEditProtection(){
 const edits=new Map();
 const key=(kind,id)=>kind+':'+String(id);
 function begin(kind,id,baseline){const k=key(kind,id);if(!edits.has(k))edits.set(k,{baseline:structuredClone(baseline),local:structuredClone(baseline),dirty:new Set(),saving:false});}
 function update(kind,id,local){const edit=edits.get(key(kind,id));if(!edit)throw Error('GGC_EDIT_NOT_STARTED');edit.local=structuredClone(local);edit.dirty=new Set(changedFields(edit.baseline,local));}
 function receive(kind,id,remote){
  const edit=edits.get(key(kind,id));
  if(!edit)return {merged:structuredClone(remote),conflicts:[]};
  const result=reconcileRecord({baseline:edit.baseline,local:edit.local,remote,dirtyFields:[...edit.dirty]});
  edit.local=structuredClone(result.merged);
  edit.baseline=structuredClone(remote);
  return result;
 }
 function pending(kind,id){const e=edits.get(key(kind,id));return e?{local:structuredClone(e.local),fields:[...e.dirty],saving:e.saving}:null;}
 function markSaving(kind,id,value){const e=edits.get(key(kind,id));if(e)e.saving=Boolean(value);}
 function confirm(kind,id,saved){const e=edits.get(key(kind,id));if(!e)return;e.baseline=structuredClone(saved);e.local=structuredClone(saved);e.dirty.clear();e.saving=false;edits.delete(key(kind,id));}
 function discard(kind,id){edits.delete(key(kind,id));}
 return {begin,update,receive,pending,markSaving,confirm,discard};
}
