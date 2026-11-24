import{leaderboardPayoutLines}from'./leaderboardPayouts.js';
import{winterLeagueTable}from'./winterLeague.js';

const DAY=86400000,HOUR=3600000;
const at=value=>{const n=Date.parse(value);return Number.isFinite(n)?n:NaN};
const recent=(time,now)=>Number.isFinite(time)&&now>=time&&now-time<=2*DAY;

export function automaticUpdateEvents(state,adminGroupIds,now=Date.now()){
 const events=[];
 for(const c of state.comps||[]){
  if(!adminGroupIds.has(c.societyId)||['draft','cancelled','deleted'].includes(c.status))continue;
  const start=at(c.starts),end=at(c.ends),release=c.resultsEmbargo?.enabled?at(c.resultsEmbargo.releaseAt):end;
  if(recent(start,now)&&now<end)events.push({groupId:c.societyId,eventKey:`comp-live:${c.id}:${c.starts}`,title:`${c.name} is now live`,body:'Scoring is open.',audience:'group'});
  if(now<end&&end-now<=HOUR)events.push({groupId:c.societyId,eventKey:`comp-closing:${c.id}:${c.ends}`,title:`${c.name} closes soon`,body:'Scoring closes within the next hour.',audience:'group'});
  if(recent(end,now))events.push({groupId:c.societyId,eventKey:`comp-closed:${c.id}:${c.ends}`,title:`${c.name} has closed`,body:Number.isFinite(release)&&release>now?'Official results will follow at the scheduled release time.':'Scoring has closed.',audience:'group'});
  if(recent(release,now)){
   const lines=leaderboardPayoutLines(c,state,now).filter(line=>!line.startsWith('Comp Winners shown'));
   let body=lines.join('\n');
   const league=(state.leagues||[]).find(l=>l.id===c.leagueId);
   if(league)try{
    const table=winterLeagueTable(league,state,new Date(now)),week=table.weekly.find(w=>w.comp.id===c.id),winner=week?.rows?.[0],leader=table.table?.[0];
    const detail=[];
    if(winner)detail.push(`Week winner: ${winner.teamName} · ${winner.points} pts`);
    if(leader)detail.push(`League leader: ${leader.name} · ${leader.total} pts`);
    const cuts=(week?.rows||[]).filter(r=>r.cut>0).map(r=>`${r.teamName} ${r.cut.toFixed(1)} shot${r.cut===1?'':'s'}`);
    if(cuts.length)detail.push(`League handicap adjustments: ${cuts.join(', ')}`);
    body=[...detail,...lines].join('\n');
   }catch{}
   events.push({groupId:c.societyId,eventKey:`results-released:${c.id}:${c.resultsEmbargo?.releaseAt||c.ends}`,title:`${c.name} · official results released`,body:body||'The official results are now available in Results.',audience:'group'});
  }
  for(const playerId of c.invites||[])events.push({groupId:c.societyId,eventKey:`comp-invite:${c.id}:${playerId}`,title:`You were invited to ${c.name}`,body:'Open Competitions to accept or decline the invitation.',audience:'member',targetPlayerId:playerId});
 }
 return events;
}

export async function publishAutomaticUpdates(client,events){
 for(const event of events){
  const{error}=await client.rpc('ggc_publish_automatic_update',{p_group_id:event.groupId,p_event_key:event.eventKey,p_title:event.title,p_body:event.body||'',p_audience:event.audience||'group',p_target_player_id:event.targetPlayerId||null});
  if(error&&!String(error.message||'').includes('ADMIN_REQUIRED'))throw error;
 }
}
