/** Merge independent scorecard hole edits after a rejected versioned save.
 * Never choose a winner when two devices changed the same hole differently.
 */
export function mergeScorecardConflict({baseline,local,remote}){
 if(!baseline||!local||!remote)throw Error('GGC_SCORECARD_MISSING');
 const merged=structuredClone(remote),conflicts=[];
 const fields=new Set([...Object.keys(baseline),...Object.keys(local),...Object.keys(remote)]);
 for(const field of fields){
  if(field==='id')continue;
  const before=baseline[field],mine=local[field],theirs=remote[field];
  if(JSON.stringify(before)===JSON.stringify(mine))continue;
  if(field==='gross'&&Array.isArray(before)&&Array.isArray(mine)&&Array.isArray(theirs)){
   const gross=structuredClone(theirs);
   for(let hole=0;hole<Math.max(before.length,mine.length,theirs.length);hole++){
    if(JSON.stringify(mine[hole])===JSON.stringify(before[hole]))continue;
    if(JSON.stringify(theirs[hole])!==JSON.stringify(before[hole])&&JSON.stringify(theirs[hole])!==JSON.stringify(mine[hole])){
     conflicts.push('gross['+hole+']');continue;
    }
    gross[hole]=mine[hole];
   }
   merged.gross=gross;continue;
  }
  if(JSON.stringify(theirs)!==JSON.stringify(before)&&JSON.stringify(theirs)!==JSON.stringify(mine)){
   conflicts.push(field);continue;
  }
  if(Object.prototype.hasOwnProperty.call(local,field))merged[field]=structuredClone(mine);
  else delete merged[field];
 }
 return {merged,conflicts};
}
