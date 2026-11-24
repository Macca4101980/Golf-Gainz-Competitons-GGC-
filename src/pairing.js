export const PAIR_FORMATS=new Set([
 '4bbb','4bbb-stableford','4bbb-stroke','aggregate-pairs','aggregate-stableford',
 'aggregate-stroke','multiplier-stableford','4bbb-match','fourball-match',
 'foursomes','greensomes','gruesomes','pinehurst','foursomes-match','pairs-scramble'
]);

export const SHARED_BALL_PAIR_FORMATS=new Set([
 'foursomes','greensomes','gruesomes','pinehurst','foursomes-match','pairs-scramble'
]);

export function isPairCompetition(format){return PAIR_FORMATS.has(format)}
export function isSharedBallPairFormat(format){return SHARED_BALL_PAIR_FORMATS.has(format)}

export function pairPlayerNames(pair,state){
 return (pair?.ids||pair?.playerIds||[]).map(id=>state.players.find(p=>p.id===id)?.name||'Unknown golfer');
}

export function pairDisplayName(pair,state,separator=' + '){
 return String(pair?.name||'').trim()||pairPlayerNames(pair,state).join(separator)||'Pair';
}

export function samePair(a,b){
 const left=[...(a||[])].filter(Boolean).sort(),right=[...(b||[])].filter(Boolean).sort();
 return left.length===2&&left.length===right.length&&left.every((id,i)=>id===right[i]);
}

export function competitionPairs(c){
 if((c?.pairs||[]).length)return c.pairs;
 return(c?.roundGroups||[]).flatMap(group=>{
  const ids=(group.playerIds||[]).filter(Boolean),pairs=[];
  for(let i=0;i+1<ids.length;i+=2)pairs.push({id:`${group.id||'round'}-pair-${i/2}`,ids:ids.slice(i,i+2)});
  return pairs;
 });
}

export function pairForPlayers(c,ids){return competitionPairs(c).find(pair=>samePair(pair.ids,ids))||null}
