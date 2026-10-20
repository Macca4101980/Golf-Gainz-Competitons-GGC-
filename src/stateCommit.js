// Keep the sync guard current immediately, including while React batches renders.
// A cloud callback must see a local edit before it can replace the rendered state.
export function commitStateUpdate(stateRef,dispatch,update){
 const next=typeof update==='function'?update(stateRef.current):update;
 if(typeof window!=='undefined'&&location.hostname.endsWith('.vercel.app')){
  const before=new Map((stateRef.current.cards||[]).map(card=>[card.id,card]));
  const edits=(next.cards||[]).flatMap(card=>{
   const previous=before.get(card.id);if(!previous)return [];
   return (card.gross||[]).flatMap((score,hole)=>score!==previous.gross?.[hole]?[{cardId:card.id,hole:hole+1,before:previous.gross?.[hole],after:score}]:[]);
  });
  if(edits.length)console.debug('GGC_SCORE_STATE',JSON.stringify(edits),new Error().stack);
 }
 stateRef.current=next;
 dispatch(next);
}
