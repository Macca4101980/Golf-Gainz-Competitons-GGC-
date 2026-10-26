export function buildRecordConflictMessage(result={}){
 const details=Array.isArray(result.conflictDetails)?result.conflictDetails:[];
 const holes=[...new Set(details.map(detail=>Number(detail.hole)+1).filter(Number.isFinite))];
 const location=holes.length?` on hole${holes.length>1?'s':''} ${holes.join(', ')}`:'';
 return `Score conflict${location}. Another device changed the same score. Your score is still shown on this screen and has not silently overwritten the saved score. Refresh to use the cloud score, or note your score and ask an administrator to review it.`;
}
