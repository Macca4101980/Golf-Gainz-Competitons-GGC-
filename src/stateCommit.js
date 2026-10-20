// Keep the sync guard current immediately, including while React batches renders.
// A cloud callback must see a local edit before it can replace the rendered state.
export function commitStateUpdate(stateRef,dispatch,update){
 const next=typeof update==='function'?update(stateRef.current):update;
 stateRef.current=next;
 dispatch(next);
}
