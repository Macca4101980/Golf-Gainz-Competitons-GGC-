import LeaderboardPayoutSummary from './LeaderboardPayoutSummary.jsx';
import CrossCourseFixtures from './CrossCourseFixtures.jsx';
import {usePullToRefresh} from './pullToRefresh.js';
import{competitionManagementSections}from'./managementNavigation.js';
import{declineCompetitionInvite,groupCodeError,scoreGroupStartError}from'./beta11.js';
import LeaderboardBadge from './LeaderboardBadge.jsx';
import {leagueDisplayTable} from './leagueDisplay.js';
import {buildRoundTotals} from './roundTotals.js';
import {IndividualTotalRows,TeamRoundTotals} from './RoundTotals.jsx';
import{PublicLeaderboard,PublicShareControls,PublicIdentityPreference}from'./PublicLeaderboard.jsx';
import{shareTokenFromHash}from'./publicLeaderboard.js';
import React,{useCallback,useEffect,useMemo,useState,useRef}from'react';
import{createRoot}from'react-dom/client';
import{createClient}from'@supabase/supabase-js';
import{Plus,Users,Flag,Wallet,Settings,Home,ChevronRight,UserRound,Save,X,Share2,Copy,LogIn,Building2,Trophy,ArrowLeft,CheckCircle2,Trash2,Mail,LogOut,UserPlus,Bell}from'lucide-react';
import'./style.css';
import{hasPendingCompetitionInvite,hydrateSignedInPlayer,sanitiseCompetitionParticipation}from'./playerIdentity.js';
import{validatePasswordChange}from'./passwordChange.js';
import{commitStateUpdate}from'./stateCommit.js';
import{prepareScorecardRecordBaseline}from'./scorecardRecordSync.js';
import{createAppRecordSession}from'./appRecordSync.js';
import{toRecordSnapshot,mergeRecordSnapshotIntoAppState}from'./recordModel.js';
import{teamBandLayout}from'./scorecardLayout.js';
import{decrementHoleScore,displayHoleScore,incrementHoleScore,isNoReturnScore,normaliseHoleScoreInput}from'./scoreInput.js';
import Leagues from './CompetitionGroups.jsx';
import GroupScoreScreen from './GroupScoreScreen.jsx';
import GroupUpdates,{useGroupUpdates}from'./GroupUpdates.jsx';
import{automaticUpdateEvents,publishAutomaticUpdates}from'./automaticUpdates.js';
import PushNotificationSettings from'./PushNotificationSettings.jsx';
import{flushPushNotifications}from'./pushNotifications.js';
import{isGroupFormat,groupLeaderboard}from'./groupScoring.js';
import{winterLeagueTable,leagueHandicapSettings}from'./winterLeague.js';
import{FORMAT_RULES,scoreCard,formatResult,validateFormatStart,oomPointsForField,normaliseBlindPairIds,courseHandicap,playingHandicap,pairScore,fourballMatchResult,fourballMatchHandicaps}from'./scoring.js';
import{buildCourseSnapshot,competitionCourse}from'./competitionCourse.js';
import{buildRecordConflictMessage}from'./recordConflictNotice.js';
const SUPA_URL=import.meta.env.VITE_SUPABASE_URL||'';const SUPA_KEY=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY||'';const CLOUD=!!(SUPA_URL&&SUPA_KEY);const K='ggc-build2';
const supabase=CLOUD?createClient(SUPA_URL,SUPA_KEY,{auth:{experimental:{passkey:true},persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const RECORD_STORE_ENABLED=CLOUD&&import.meta.env.VITE_GGC_RECORD_READ==='true'&&import.meta.env.VITE_GGC_RECORD_STORE==='true';
const APP_FIELD_STORE_ENABLED=RECORD_STORE_ENABLED&&import.meta.env.VITE_GGC_FIELD_STORE==='true';
let appFieldWritesReadyFor=null,appFieldPersist=null;
async function runGroupAction(name,args,setCloud){if(!supabase)throw Error('GGC cloud is not configured');setCloud?.('Saving group changeâ€¦');const{data,error}=await supabase.rpc(name,args);if(error){setCloud?.('Group change failed â€” nothing was changed');throw error}if(data?.ok===false){setCloud?.('Group change was not saved');throw Error('GGC_GROUP_ACTION_FAILED: '+(data.reason||name))}setCloud?.('Group change saved');return data||{ok:true}}
function groupActionMessage(error){const message=String(error?.message||error||'');if(message.includes('owner_must_transfer'))return'Transfer ownership before removing this golfer.';if(message.includes('not_authorized')||message.includes('OWNER_REQUIRED')||message.includes('ADMIN_REQUIRED'))return'Only the Group Owner can make that change.';if(message.includes('not_member'))return'That golfer is no longer a member. Refresh GGC to see the latest Group.';return'The Group change could not be saved. Nothing has been changed.'}
const formats=[
['stableford','Stableford','Play your own ball. Highest Stableford points wins.','points','Individual'],
['stroke','Nett Stroke Play / Medal','Lowest nett stroke total wins.','stroke','Individual'],
['gross-stroke','Gross Stroke Play','Scratch medal. Lowest gross total wins.','stroke','Individual'],
['par-bogey','Par / Bogey','Play match play against the course. Highest final +/- wins.','points','Individual'],
['max-score','Maximum Score','Stroke play with a configurable maximum score on each hole.','stroke','Individual'],
['modified-stableford','Modified Stableford','Configurable points based on nett score relative to par.','points','Individual'],
['flag','Flag Competition','Use your stroke allowance and record where your flag finishes.','stroke','Individual'],
['eclectic','Eclectic','Best score on every hole across multiple rounds.','stroke','Individual'],
['waltz','Waltz','Individual Stableford with Ã—1, Ã—2, Ã—3 multipliers repeating.','points','Individual'],
['4bbb-stableford','4BBB Stableford','Both partners play their own ball. Best Stableford score on each hole counts.','points','Pairs'],
['4bbb-stroke','4BBB Stroke Play','Both partners play their own ball. Best nett score on each hole counts.','stroke','Pairs'],
['aggregate-stableford','Aggregate Stableford','Both partners play their own ball. Both Stableford scores count.','points','Pairs'],
['aggregate-stroke','Aggregate Stroke Play','Both partners play their own ball. Both nett scores count.','stroke','Pairs'],
['4bbb-match','Pairs Matchplay','Two pairs play head-to-head; each pair uses its best nett result on each hole.','match','Pairs'],
['blind-pairs','Blind Pairs','Golfers play individual Stableford; paired results are combined after the draw.','points','Pairs'],
['scramble','Texas Scramble','Team scramble format. All golfers play, choose the best ball and continue from there.','team','Group'],
['scramble-standard','Scramble','Team scramble competition.','team','Group'],
['pairs-scramble','Pairs Scramble','Two golfers share one Scramble card.','team','Group'],
['florida','Florida Scramble','Scramble variation where the golfer whose shot is selected sits out the next shot.','team','Group'],
['shamble','Shamble','Choose the best tee shot, then golfers play their own ball to the hole.','team','Group'],
['best1','Best 1 from Group','Best one Stableford score on each hole counts for the group.','points','Group'],
['best2','Best 2 from Group','Best two Stableford scores on each hole count for the group.','points','Group'],
['best3','Best 3 from Group','Best three Stableford scores on each hole count for the group.','points','Group'],
['cha-cha-cha','Cha Cha Cha','Rotating best-score team format: one, then two, then three scores count.','points','Group'],
['irish-fourball','Irish Fourball','Team Stableford with a changing number of scores counting through the round.','points','Group'],
['bowmaker','Bowmaker','Group Stableford format with multiple scores counting on each hole.','points','Group'],
['alliance','Alliance','Group Stableford format with selected scores counting on each hole.','points','Group'],
['yellow-ball','Yellow Ball','Team Stableford including a rotating nominated yellow-ball score.','points','Group']
]
const harlWhite=[[347,4,6],[166,3,8],[517,5,12],[397,4,2],[135,3,18],[535,5,10],[429,4,4],[367,4,16],[332,4,14],[381,4,7],[521,5,11],[596,5,1],[152,3,17],[410,4,5],[452,4,3],[166,3,9],[327,4,13],[285,4,15]];
const harlYellow=[[336,4,6],[160,3,8],[504,5,12],[388,4,2],[127,3,18],[527,5,10],[410,4,4],[357,4,16],[311,4,14],[374,4,7],[515,5,11],[577,5,1],[143,3,17],[401,4,5],[443,4,3],[127,3,9],[317,4,13],[276,4,15]];
const harlRed=[[324,4,4],[145,3,11],[452,5,5],[357,4,3],[119,3,18],[454,5,8],[365,4,7],[294,4,15],[296,4,10],[367,4,2],[458,5,6],[513,5,1],[131,3,17],[395,5,13],[436,5,12],[102,3,9],[280,4,14],[122,3,16]];
const holes=a=>a.map((x,i)=>({n:i+1,yards:x[0],par:x[1],si:x[2]}));
const defaultSoc={id:'default-society',name:'My Golf Group',code:'GGC-2026',members:[],publicLeaderboardsEnabled:true,createdAt:new Date().toISOString()};
const seed={version:3,players:[],societies:[defaultSoc],currentSocietyId:'default-society',courses:[{id:'harlestone',name:'Northampton Golf Club (Harlestone)',tees:[{id:'h-white',name:'White',rating:71.4,slope:133,holes:holes(harlWhite)},{id:'h-yellow',name:'Yellow',rating:70.4,slope:127,holes:holes(harlYellow)},{id:'h-red',name:'Red',rating:72.7,slope:132,holes:holes(harlRed)}]},{id:'staverton',name:'Staverton Park Golf Club',tees:[]},{id:'cold-ashby',name:'Cold Ashby Golf Centre',tees:[]},{id:'brampton',name:'Brampton Heath Golf Centre',tees:[]},{id:'sharpley',name:'Sharpley Golf',tees:[]},{id:'ramside',name:'Ramside Hall Golf Club',tees:[]}],comps:[],cards:[],deletedCompIds:[],deletedCardIds:[],deletedSocietyIds:[],deletedCourseIds:[],identityLinks:{},leagues:[],oom:{},settings:{adminPin:'2026'}};
const clone=x=>JSON.parse(JSON.stringify(x));const formatHI=v=>{const n=+v||0;return n<0?`+${Math.abs(n).toFixed(1)}`:n.toFixed(1)};const uid=()=>crypto.randomUUID?.()||Date.now()+''+Math.random();const code=()=>`GGC-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const effectiveCompStatus=(c,now=new Date())=>{const raw=c?.status||'live';if(raw==='cancelled'||raw==='deleted'||raw==='draft')return raw;if(raw==='completed')return 'completed';const start=c?.starts?new Date(c.starts):null,end=c?.ends?new Date(c.ends):null;if(end&&!Number.isNaN(end.getTime())&&now>=end)return 'completed';if(start&&!Number.isNaN(start.getTime())&&now<start)return 'scheduled';return 'live'};const validGroupMemberIds=(s,state)=>{const playerIds=new Set((state?.players||[]).map(p=>p?.id).filter(Boolean));return [...new Set(s?.members||[])].filter(id=>playerIds.has(id))};const validGroupOwner=(s,state)=>!!(s?.ownerId&&validGroupMemberIds(s,state).includes(s.ownerId));const toLocalDateTime=v=>{const d=v?new Date(v):new Date();if(Number.isNaN(d.getTime()))return'';const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`};
function migrate(x){
 if(!x)return clone(seed);
 let y=x.version>=2?{...x}:{...seed,...x,version:2,societies:[defaultSoc],currentSocietyId:'default-society',comps:(x.comps||[]).map(c=>({...c,societyId:'default-society'})),cards:(x.cards||[]).map(c=>({...c,societyId:'default-society'}))};
 // Built-in courses are merged on every load so existing users receive newly added courses too.
 const builtins=clone(seed.courses); const deletedCourseIds=y.deletedCourseIds||[],deletedCourseSet=new Set(deletedCourseIds),existing=(y.courses||[]).filter(c=>!deletedCourseSet.has(c.id));
 for(const b of builtins){if(deletedCourseSet.has(b.id))continue;const i=existing.findIndex(c=>c.id===b.id||c.name===b.name);if(i<0)existing.push(b);else if(b.id==='harlestone'&&(!existing[i].tees||existing[i].tees.length===0))existing[i]=b;}
 return {...y,version:11,courses:existing,cards:y.cards||[],deletedCompIds:y.deletedCompIds||[],deletedCardIds:y.deletedCardIds||[],deletedSocietyIds:y.deletedSocietyIds||[],deletedCourseIds,identityLinks:y.identityLinks||{},deletedLeagueIds:y.deletedLeagueIds||[],leagues:y.leagues||y.competitionGroups||[],audit:y.audit||[],contacts:y.contacts||{},hiddenContacts:y.hiddenContacts||{},societyInvites:y.societyInvites||[],societies:(y.societies||[]).map(q=>({...q,admins:q.admins||[],ownerId:q.ownerId||null,publicLeaderboardsEnabled:q.publicLeaderboardsEnabled!==false,pinHash:null})),comps:(y.comps||[]).map(c=>({...c,createdBy:c.createdBy||null,status:c.status||'live',invites:c.invites||[]}))};
}
function oomCoursePar(state,c){
 const course=(state.courses||[]).find(x=>x.id===c.course),tee=course?.tees?.find(t=>t.name===c.tee),holes=tee?.holes||[];
 const selected=c.holesMode==='front9'?holes.slice(0,9):c.holesMode==='back9'?holes.slice(9,18):holes;
 return selected.reduce((n,h)=>n+(+h.par||0),0)||(c.holesMode==='front9'||c.holesMode==='back9'?36:72);
}
function getOomEvent(state,c,mode='position',settings={}){
 const cards=Array.isArray(state?.cards)?state.cards:[],award=(id,value,label,extra={})=>({id,value:Number(value)||0,label,...extra});
 try{
  if(isGroupFormat(c?.format)){
   const groups=groupLeaderboard(c,state).filter(r=>r.complete>0),memberIds=g=>((c.roundGroups||[]).find(x=>x.id===g.groupId)?.playerIds||[]).filter(id=>!state.players.find(p=>p.id===id)?.guest),awards=[];
   if(mode==='stableford-total'){groups.forEach(g=>{const ids=memberIds(g),v=settings.teamAward==='each'?g.points:(g.points/(ids.length||1));ids.forEach(id=>awards.push(award(id,v,g.name)))});return{comp:c,field:[...new Set(groups.flatMap(memberIds))].length,awards,lowerWins:false}}
   if(mode==='nett-par'){const par=oomCoursePar(state,c);groups.forEach(g=>{const ids=memberIds(g),v=(g.rankValue??0)-par;ids.forEach(id=>awards.push(award(id,v,g.name)))});return{comp:c,field:[...new Set(groups.flatMap(memberIds))].length,awards,lowerWins:true}}
   const field=[...new Set(groups.flatMap(memberIds))].length,pts=oomPointsForField(field);
   groups.forEach((g,i)=>{const ids=memberIds(g),teamPts=pts[i]||0,v=settings.teamAward==='each'?teamPts:(teamPts/(ids.length||1));ids.forEach(id=>awards.push(award(id,v,g.name)))});
   return{comp:c,field,awards,lowerWins:false};
  }
  let rows=cards.filter(x=>x&&x.compId===c.id).map(x=>{try{return scoreCard(x,c,state)}catch{return null}}).filter(x=>x?.player&&!x.player.guest&&x.complete>0);
  const rule=FORMAT_RULES[c.format]||FORMAT_RULES.stableford;rows.sort(rule.lowerWins?(a,b)=>Number(a.rankValue)-Number(b.rankValue):(a,b)=>Number(b.rankValue)-Number(a.rankValue));
  if(mode==='stableford-total')return{comp:c,field:rows.length,awards:rows.map(r=>award(r.player.id,r.points,r.player.name)),lowerWins:false};
  if(mode==='nett-par'){const par=oomCoursePar(state,c);return{comp:c,field:rows.length,awards:rows.map(r=>award(r.player.id,r.net-par,r.player.name)),lowerWins:true}}
  if(mode==='matchplay'){
   const outcome=c.matchResult||c.matchplayResult||null,awards=[];
   if(outcome?.winnerId){const ids=[outcome.winnerId,outcome.loserId].filter(Boolean);ids.forEach(id=>awards.push(award(id,id===outcome.winnerId?settings.matchWin:settings.matchLoss,'Matchplay',{win:id===outcome.winnerId?1:0,half:0,loss:id===outcome.winnerId?0:1})))}
   else if(outcome?.halved&&Array.isArray(outcome.playerIds)){outcome.playerIds.forEach(id=>awards.push(award(id,settings.matchHalf,'Matchplay',{win:0,half:1,loss:0})))}
   return{comp:c,field:awards.length,awards,lowerWins:false};
  }
  const isPair=formats.find(f=>f[0]===c.format)?.[4]==='Pairs';
  if(isPair&&c.format!=='blind-pairs'&&Array.isArray(c.pairs)&&c.pairs.length){
   const pairRows=c.pairs.map(pair=>({...pairScore(pair,c,state),ids:pair.ids||[],name:pair.name||'Pair'})),lower=!!FORMAT_RULES[c.format]?.lowerWins;pairRows.sort(lower?(x,y)=>x.rankValue-y.rankValue:(x,y)=>y.rankValue-x.rankValue);
   const field=[...new Set(c.pairs.flatMap(p=>p.ids||[]))].length,pts=oomPointsForField(field),awards=[];
   pairRows.forEach((pair,i)=>{const teamPts=pts[i]||0;if(pair.ids.length)pair.ids.forEach(id=>awards.push(award(id,settings.teamAward==='each'?teamPts:teamPts/pair.ids.length,pair.name)))});
   return{comp:c,field,awards,lowerWins:false};
  }
  if(c.format==='blind-pairs'&&Array.isArray(c.blindDraw?.pairs)&&c.blindDraw.pairs.length){
   const byId=Object.fromEntries(rows.map(r=>[r.player.id,r])),pairs=c.blindDraw.pairs.map(pair=>{const ids=normaliseBlindPairIds(pair).filter(id=>byId[id]);return ids.length?{ids,score:ids.reduce((n,id)=>n+(Number(byId[id]?.points)||0),0)}:null}).filter(Boolean).sort((x,y)=>y.score-x.score),pts=oomPointsForField(rows.length),awards=[];
   pairs.forEach((pair,i)=>{const teamPts=pts[i]||0;pair.ids.forEach(id=>awards.push(award(id,settings.teamAward==='each'?teamPts:teamPts/pair.ids.length,'Blind pair')));});return{comp:c,field:rows.length,awards,lowerWins:false};
  }
  const pts=oomPointsForField(rows.length);return{comp:c,field:rows.length,awards:rows.map((r,i)=>award(r.player.id,pts[i]||0,r.player.name)),lowerWins:false};
 }catch(e){console.warn('Skipping malformed competition in OOM',c?.id,e);return{comp:c,field:0,awards:[],lowerWins:false}}
}
function getOomRows(state,societyId,settings={}){
 const players=Array.isArray(state?.players)?state.players:[],excluded=new Set(settings.excludedCompIds||[]),all=(state.comps||[]).filter(c=>c&&c.societyId===societyId&&c.status!=='deleted'),mode=settings.mode==='automatic'||!settings.mode?oomDefaultMode(all):settings.mode;
 const comps=all.filter(c=>effectiveCompStatus(c)==='completed'&&!excluded.has(c.id)).sort((x,y)=>new Date(x.starts||0)-new Date(y.starts||0)),events=comps.map(c=>getOomEvent(state,c,mode,settings)),byPlayer={};
 events.forEach(ev=>ev.awards.forEach(a=>{if(!a.id||!Number.isFinite(a.value))return;(byPlayer[a.id]??=[]).push({compId:ev.comp.id,name:ev.comp.name,date:ev.comp.starts,value:a.value,win:a.win||0,half:a.half||0,loss:a.loss||0})}));
 const bestCount=Math.max(0,Number(settings.bestCount)||0),lowerWins=mode==='nett-par';
 const rows=Object.entries(byPlayer).map(([id,results])=>{const sorted=[...results].sort((x,y)=>lowerWins?x.value-y.value:y.value-x.value),counting=sorted.slice(0,bestCount||sorted.length),value=counting.reduce((n,r)=>n+r.value,0);return{player:players.find(p=>p?.id===id),value,points:value,played:results.length,counting:counting.length,results,countingIds:new Set(counting.map(r=>r.compId)),wins:counting.reduce((n,r)=>n+r.win,0),halves:counting.reduce((n,r)=>n+r.half,0),losses:counting.reduce((n,r)=>n+r.loss,0)}}).filter(x=>x.player&&!x.player.guest).sort((x,y)=>lowerWins?x.value-y.value||String(x.player.name||'').localeCompare(String(y.player.name||'')):y.value-x.value||y.wins-x.wins||String(x.player.name||'').localeCompare(String(y.player.name||'')));
 return{rows,events,eligible:comps,bestCount,mode,lowerWins};
}
function oomDefaultMode(comps=[]){
 const formats=[...new Set(comps.map(c=>c.format).filter(Boolean))];
 if(formats.length===1&&formats[0]==='stableford')return 'stableford-total';
 if(formats.length===1&&formats[0]==='stroke')return 'nett-par';
 if(formats.length===1&&formats[0]==='matchplay')return 'matchplay';
 return 'position';
}
function OomScreen({state,setState,society,me,onPersist,management=false,publicSharingEnabled=true,setPublicSharingEnabled}){
 const[expanded,setExpanded]=useState(null);const key=society?.id||'default';const allGroupComps=(state.comps||[]).filter(c=>c.societyId===key&&c.status!=='deleted');
 const stored=state.oom?.[key]||{},settings={enabled:stored.enabled!==false,mode:stored.mode||'automatic',bestCount:stored.bestCount||0,teamAward:stored.teamAward||'split',matchWin:stored.matchWin??3,matchHalf:stored.matchHalf??1,matchLoss:stored.matchLoss??0,excludedCompIds:stored.excludedCompIds||[],positionPreset:stored.positionPreset||'field',...stored};
 const resolvedMode=settings.mode==='automatic'?oomDefaultMode(allGroupComps):settings.mode;const result=getOomRows(state,key,settings),isAdmin=!!me&&(society?.ownerId===me.id||(society?.admins||[]).includes(me.id));
 const save=patch=>{const next={...state,oom:{...(state.oom||{}),[key]:{...settings,...patch}}};setState(next);onPersist?.(next)};const fmtPts=n=>Number.isInteger(n)?n:Number(n||0).toFixed(1);
 if(management)return <div className="oomManage">
  <div className="card"><h3>GROUP ORDER OF MERIT</h3><p className="muted">These standings belong to the Group. Each League has its own OOM rules under Settings â†’ Leagues.</p><p className="muted">Choose how this Group's season standings are calculated. Quick competitions use sensible defaults; these settings let you build a more detailed structure.</p>
   <label>Order of Merit<select value={settings.enabled?'on':'off'} disabled={!isAdmin} onChange={e=>save({enabled:e.target.value==='on'})}><option value="on">On</option><option value="off">Off</option></select></label>
   {settings.enabled&&<><label>Scoring method<select value={settings.mode} disabled={!isAdmin} onChange={e=>save({mode:e.target.value})}><option value="automatic">Automatic â€” based on competition type</option><option value="position">Finishing-position points</option><option value="stableford-total">Cumulative Stableford points</option><option value="nett-par">Cumulative nett score vs par</option><option value="matchplay">Matchplay record</option></select></label>{settings.mode==='automatic'&&<p className="oomResolved">Current automatic method: <b>{resolvedMode==='stableford-total'?'Cumulative Stableford':resolvedMode==='nett-par'?'Nett score vs par':resolvedMode==='matchplay'?'Matchplay record':'Finishing-position points'}</b></p>}
   <label>Counting rounds<select value={settings.bestCount||0} disabled={!isAdmin} onChange={e=>save({bestCount:Number(e.target.value)})}><option value="0">All eligible rounds</option>{Array.from({length:Math.max(1,allGroupComps.length)},(_,i)=><option key={i+1} value={i+1}>Best {i+1}</option>)}</select></label>
   {resolvedMode==='position'&&<><label>Position points<select value={settings.positionPreset} disabled={!isAdmin} onChange={e=>save({positionPreset:e.target.value})}><option value="field">Scale with field size</option><option value="fixed">Fixed finishing-position table</option></select></label><label>Pairs / teams<select value={settings.teamAward} disabled={!isAdmin} onChange={e=>save({teamAward:e.target.value})}><option value="split">Split team award equally</option><option value="each">Full award to each golfer</option></select></label><div className="oomRuleNote"><b>Field-size default</b><span>5â€“8: 10, 8, 6, 4, 2â€¦</span><span>9â€“12: 12, 10, 8, 6â€¦</span><span>13â€“16: 14, 12, 10, 8â€¦</span><span>17+: 16, 14, 12, 10â€¦</span></div></>}
   {resolvedMode==='stableford-total'&&<div className="oomRuleNote"><b>Cumulative Stableford</b><span>Each golfer's Stableford points are added across the counting rounds. Highest total leads.</span></div>}
   {resolvedMode==='nett-par'&&<div className="oomRuleNote"><b>Nett score vs par</b><span>Each round is converted to nett under/over par and accumulated like a multi-round tournament. Lowest total leads.</span></div>}
   {resolvedMode==='matchplay'&&<div className="oomMatchGrid"><label>Win<input type="number" step="0.5" value={settings.matchWin} disabled={!isAdmin} onChange={e=>save({matchWin:+e.target.value||0})}/></label><label>Half<input type="number" step="0.5" value={settings.matchHalf} disabled={!isAdmin} onChange={e=>save({matchHalf:+e.target.value||0})}/></label><label>Loss<input type="number" step="0.5" value={settings.matchLoss} disabled={!isAdmin} onChange={e=>save({matchLoss:+e.target.value||0})}/></label></div>}
   </>}</div>
  {settings.enabled&&<div className="card oomSetup"><h3>ELIGIBLE COMPETITIONS</h3><p className="muted">Completed competitions count automatically. Use this list to exclude individual competitions from the OOM.</p>{allGroupComps.sort((a,b)=>new Date(a.starts||0)-new Date(b.starts||0)).map(c=>{const completed=effectiveCompStatus(c)==='completed',on=completed&&!(settings.excludedCompIds||[]).includes(c.id);return <div className="oomCompToggle" key={c.id}><span><b>{c.name}</b><small>{c.starts?new Date(c.starts).toLocaleDateString():'No date'} Â· {completed?'Completed':'Not completed'}</small></span><button className={on?'mini':'mini secondary'} disabled={!completed||!isAdmin} onClick={()=>{const ex=new Set(settings.excludedCompIds||[]);on?ex.add(c.id):ex.delete(c.id);save({excludedCompIds:[...ex]})}}>{!completed?'UPCOMING':on?'COUNTING':'EXCLUDED'}</button></div>})}</div>}<div className="card publicSharingSetting"><h3>PUBLIC LEADERBOARDS</h3><p className="muted">Allow this Group's competition leaderboards to be shared by link without a GGC login.</p><label className="toggleRow"><input type="checkbox" checked={publicSharingEnabled} onChange={e=>setPublicSharingEnabled?.(e.target.checked)}/><span>{publicSharingEnabled?'PUBLIC SHARING ON':'PUBLIC SHARING OFF'}</span></label>{!publicSharingEnabled&&<small>Share buttons will explain that the Group admin has turned this feature off.</small>}</div></div>;
 if(!settings.enabled)return <div className="card"><h3>ORDER OF MERIT</h3><p className="muted">OOM is switched off for this Group.</p></div>;
 return <div className="oomScreen"><div className="card oomHero"><div><small>ORDER OF MERIT</small><h2>{society?.name||'Golf Group'}</h2><p className="muted">{result.bestCount?'Best '+result.bestCount+' results count':'All eligible results count'}.</p></div></div>{!result.rows.length?<div className="card"><h3>STANDINGS</h3><p className="muted">No OOM results yet.</p></div>:<div className="card oomStandings"><div className="oomHead"><span>POS</span><span>GOLFER</span><span>PLAYED</span><span>COUNTING</span><span>{result.mode==='nett-par'?'+/-':result.mode==='matchplay'?'PTS':'PTS'}</span></div>{result.rows.map((r,i)=><React.Fragment key={r.player.id}><button type="button" className="oomRow" onClick={()=>setExpanded(expanded===r.player.id?null:r.player.id)}><strong>{i+1}</strong><span><b>{r.player.name||'Golfer'}</b><small>HI {formatHI(r.player.hi)}</small></span><em>{r.played}</em><em>{r.counting}</em><b>{result.mode==='nett-par'?(r.value>0?'+':'')+fmtPts(r.value):fmtPts(r.value)}</b></button>{expanded===r.player.id&&<div className="oomBreakdown">{[...r.results].sort((a,b)=>new Date(a.date||0)-new Date(b.date||0)).map(x=><div key={x.compId}><span>{x.name}</span><b>{result.mode==='nett-par'?(x.value>0?'+':'')+fmtPts(x.value):fmtPts(x.value)+(result.mode==='stableford-total'?' pts':'')} {r.countingIds.has(x.compId)?'âœ“':'â€” dropped'}</b></div>)}</div>}</React.Fragment>)}</div>}</div>
}

function mergeLiveState(local,remote){
 const byId=(a=[],b=[],mergeFn)=>{const m=new Map((a||[]).map(x=>[x.id,x]));for(const x of (b||[])){const old=m.get(x.id);m.set(x.id,old&&mergeFn?mergeFn(old,x):x)}return [...m.values()]};
 const newer=(a,b)=>{const at=Date.parse(a?.updatedAt||a?.submittedAt||0)||0,bt=Date.parse(b?.updatedAt||b?.submittedAt||0)||0;return at>bt?a:b};
 const identityLinks={...(remote.identityLinks||{}),...(local.identityLinks||{})};
 const canonicalId=id=>{let cur=id,seen=new Set();while(identityLinks[cur]&&identityLinks[cur]!==cur&&!seen.has(cur)){seen.add(cur);cur=identityLinks[cur]}return cur};
 const playerMerge=(a,b)=>{const base=newer(a,b),claimed=[a,b].find(p=>p?.authUserId&&!p?.placeholder&&!p?.unclaimed);return claimed?{...base,authUserId:claimed.authUserId,placeholder:false,unclaimed:false,claimToken:null,membershipStatus:'member',emailVerified:claimed.emailVerified??base.emailVerified,claimedAt:claimed.claimedAt||base.claimedAt}:base};
 const players=byId(local.players,remote.players,playerMerge);

 const deletedCourseIds=[...new Set([...(local.deletedCourseIds||[]),...(remote.deletedCourseIds||[])])];
 const deletedCourseSet=new Set(deletedCourseIds);
 const courses=byId(local.courses,remote.courses,newer).filter(c=>!deletedCourseSet.has(c.id));
 const deletedSocietyIds=[...new Set([...(local.deletedSocietyIds||[]),...(remote.deletedSocietyIds||[])])];
 const deletedSocietySet=new Set(deletedSocietyIds);
 const societies=byId(local.societies,remote.societies,newer).filter(s=>!deletedSocietySet.has(s.id)).map(s=>({...s,members:[...new Set((s.members||[]).map(canonicalId))],admins:[...new Set((s.admins||[]).map(canonicalId))],ownerId:canonicalId(s.ownerId)}));
 const deletedCompIds=[...new Set([...(local.deletedCompIds||[]),...(remote.deletedCompIds||[])])];
 const deletedLeagueIds=[...new Set([...(local.deletedLeagueIds||[]),...(remote.deletedLeagueIds||[])])];
 const deletedCardIds=[...new Set([...(local.deletedCardIds||[]),...(remote.deletedCardIds||[])])];
 const deletedSet=new Set(deletedCompIds);const deletedCardSet=ne÷4îÚ$z{-®éÜj×\Ü^N˜›ØÚßB‹œÚ\™R[™›Ô›İÈÙ›Û\Ú^™NŒLœÛ]\‹\ÜXÚ[™Î‹ŒÍ\ØÛÛÜˆÌLMÌLŸB‹œÚ\™R[™›Ô›İÈÛX[ÛX\™Ú[‹]ÜŒœØÛÛÜˆÍÌMNÙ›Û\Ú^™NŒLÛ[™KZZYÚŒKŒNÙ›Û]ÙZYÚLB‹œÚ\™R[™›Ô›İÏœİ›Û™ŞÙ›^››Û™NØÛÛÜˆÌMÍ˜ŒÍNÙ›Û\Ú^™NŒL\Û]\‹\ÜXÚ[™Î‹B‹œÚ\™SÛ”[ÜY[™ÎØ›Ü™\‹\˜Y]\ÎNN\Ø˜XÚÙÜ›İ[™ˆÙÙ™™ØÛÛÜˆÌLÈZ[\Ü[B‹œÚ\™S[Ù[œX›XÔÚ\™PXİ[ÛœŞÙ\Ü^N™›^Ù›^]Ü˜\Ü˜\Ú\İYKXÛÛ[™›^\İ\ÙØ\B‹œÚ\™S[Ù[œX›XÔÚ\™PXİ[ÛœÈœš[X\KœÚ\™S[Ù[œX›XÔÚ\™PXİ[ÛœÈœÙXÛÛ™\^İÚY˜]]ÈZ[\Ü[ÛZ[‹ZZYÚÜY[™ÎŒLM\ÛX\™Ú[ŒZ[\Ü[Ù›^Œ]]ßB‹œÚ\™S[Ù[œš[X\^Ø˜XÚÙÜ›İ[™˜\ŠKYÜ™Y[ŠHZ[\Ü[ØÛÛÜˆÌÌLZ[\Ü[Ø›Ü™\Œ\ÛÛY˜\ŠKYÜ™Y[ŠHZ[\Ü[B‹œÚ\™S[Ù[œÙXÛÛ™\^Ø˜XÚÙÜ›İ[™ˆÌLNLLØÛÛÜˆÙYÙØ›Ü™\‹XÛÛÜˆÌÌÍÍŸB‹œÚ\™S[Ù[œÚ\™Q\ØX›PØÛÛÜˆÙ™˜XNØ›Ü™\‹XÛÛÜˆÍŒÍŒÍØ˜XÚÙÜ›İ[™ˆÌŒLLB‹œÚ\™PÜ™X]Y›ŞÙ\Ü^N™ÜšYÙØ\\ÜY[™ÎŒMœØ˜XÚÙÜ›İ[™ˆÙY™ŒÎØÛÛÜˆÌLMÌLØ›Ü™\‹\˜Y]\ÎŒŒB‹œÚ\™PÜ™X]Y›Ş[œ]ÛX\™Ú[ŒØ˜XÚÙÜ›İ[™ˆÙ™™ØÛÛÜˆÌLMÌLØ›Ü™\‹XÛÛÜˆØØÙ˜ÙÙ›Û\Ú^™NŒLœB‹œÚ\™PÜ™X]Y›ŞÛX[œÚ\™Tİ]\ŞÙ›Û\Ú^™NŒLœÛ[™KZZYÚŒKB‹œÚ\™PÜ™X]Y›ŞÛX[ØÛÛÜˆÍÌM_B‹œÚ\™Tİ]\ŞÛX\™Ú[ŒØÛÛÜˆÙYY_BYYXJX^]ÚYŒ
^ËœÚ\™S[Ù[ÜY[™Ë[YŒŒZ[\Ü[ÜY[™Ë\šYÚŒŒZ[\Ü[KœÚ\™R[™›Ô›İŞØ[YÛ‹Z][\Î™›^\İ\KœÚ\™R[™›Ô›İÈÛX[ÛX^]ÚYŒŒM\KœÚ\™S[Ù[œX›XÔÚ\™PXİ[ÛœÈœš[X\KœÚ\™S[Ù[œX›XÔÚ\™PXİ[ÛœÈœÙXÛÛ™\^ÛZ[‹ZZYÚŒÎÜY[™Î\LÜÙ›Û\Ú^™NŒLœ_B‚‚‹ÊˆX›XÈXY\˜›Ø\™\Ù\ÈHØ[YHÌŒÑĞÈØ[˜\È[™[˜ÛÛ\™\ÜÙY]H›İÈ\ÈH\ˆ
‹Â‹œX›XÓXY\˜›Ø\™XZ[ÛX^]ÚYÌŒÜY[™ÎŒNB‹œX›XÓXY\˜›Ø\™Û]T›İŞÛZ[‹]ÚYŒB‹œX›XÓXY\˜›Ø\™Û]T›İÈŞÛZ[‹]ÚYŒÛ[™KZZYÚŒKŒM_B‚‚‹ÊˆÙY\]™\H[‹X\XY\˜›Ø\™Ú\™HXİ[ÛˆY[XØ[[™™]™[ÙYZÛH›İÜÈœ›ÛHÜ™X][™ÈHÜ\™HÜšY›İËˆ
‹Â‹ÛÙYZÔ™\İ[œİ[[X\^ÂˆÜšY][\]KXÛÛ[[œÎœZ[›X^
YœŠHŒZ[\Ü[ÂŸB‹›XY\˜›Ø\™Ú\™P‹‹Û]T›İÈ›XY\˜›Ø\™Ú\™P‹‹ÛÙYZÔ™\İ[œİ[[X\H›XY\˜›Ø\™Ú\™PÂˆX\™Ú[ŒZ[\Ü[Âˆ›Ü™\‹\˜Y]\ÎL	HZ[\Ü[Âˆ˜XÚÙÜ›İ[™˜\ŠKYÜ™Y[ŠHZ[\Ü[ÂˆÛÛÜˆÌÌLZ[\Ü[Âˆ›Ü™\Œ\ÛÛY˜\ŠKYÜ™Y[ŠHZ[\Ü[ÂŸB‹ÛÙYZÔ™\İ[œİ[[X\H›XY\˜›Ø\™Ú\™PÂˆÜšYXÛÛ[[ŒÎÂˆÜšY\›İÎŒNÂŸB‹ÛÙYZÔ™\İ[œİ[[X\Oœİ›Û™ŞÂˆÜšYXÛÛ[[ÂˆÜšY\›İÎŒNÂŸB‹œÚ\™S[Ù[œX›XÔÚ\™PÛÛ›ÛŞÂˆØ\ÂŸB‹œÚ\™S[Ù[œÚ\™Q]Z[Ë˜Ø\™ÂˆX\™Ú[ŒÂŸB‹œÚ\™S[Ù[œX›XÔÚ\™PXİ[ÛœŞÂˆX\™Ú[ŒÂŸB‹œÚ\™S[Ù[œX›XÔÚ\™PXİ[ÛœÈœš[X\K‹œÚ\™S[Ù[œX›XÔÚ\™PXİ[ÛœÈœÙXÛÛ™\^ÂˆX\™Ú[ŒZ[\Ü[ÂŸBYYXJX^]ÚYLŒ
^ÂˆÛÙYZÔ™\İ[œİ[[X\^ÂˆÜšY][\]KXÛÛ[[œÎŒÎZ[›X^
YœŠHNZ[\Ü[ÂˆØ\Z[\Ü[ÂˆBŸB‚‚‹ÊˆÚ\™HXY\˜›Ø\™š[˜[š\İX[ÛÛ™›Ü›X[˜ÙH8 %Œ‹LLLÈ
‹Â‹ÊˆÙY\H›İÛHÚY]\šÎÈÛ›HH[™›Ü›X][ÛˆØ\™\ÈÚ]Kˆ
‹Â‹œÚ\™S[Ù[ÂˆY[™Ë[YŒŒZ[\Ü[ÂˆY[™Ë\šYÚŒŒZ[\Ü[ÂˆY[™ËX›İÛN˜Ø[Ê
È[ŠØY™KX\™XKZ[œÙ]X›İÛJJHZ[\Ü[ÂŸB‹œÚ\™S[Ù[œX›XÔÚ\™PÛÛ›ÛŞÂˆÚYŒL	NÂˆY[™ÎZ[\Ü[ÂˆØ\ŒMZ[\Ü[Âˆ˜XÚÙÜ›İ[™˜[œÜ\™[Z[\Ü[ÂˆÛÛÜˆÙ™™ˆZ[\Ü[Âˆ›Ü™\ŒZ[\Ü[ÂŸB‹œÚ\™S[Ù[œÚ\™U\™Ù]˜[Y^ÂˆX\™Ú[ŒZ[\Ü[ÂˆÛÛÜˆÙ™™ˆZ[\Ü[Âˆ[™KZZYÚŒKŒÈZ[\Ü[ÂŸB‹œÚ\™S[Ù[œÚ\™R[›ŞÂˆX\™Ú[ŒZ[\Ü[ÂˆÛÛÜˆØXXŒ˜XÈZ[\Ü[Âˆ›Û\Ú^™NŒLÜZ[\Ü[Âˆ[™KZZYÚŒKHZ[\Ü[ÂŸB‹œÚ\™S[Ù[œÚ\™Q]Z[Ë˜Ø\™ÂˆÚYŒL	NÂˆX\™Ú[ŒœZ[\Ü[ÂˆY[™ÎŒÜNZ[\Ü[Âˆ›Ü™\Œ\ÛÛYÙÙZ[\Ü[Âˆ›Ü™\‹\˜Y]\ÎŒNZ[\Ü[Âˆ˜XÚÙÜ›İ[™ˆÙY™ŒÈZ[\Ü[ÂˆÛÛÜˆÌLMÌLˆZ[\Ü[Âˆİ™\™›İÎšY[ˆZ[\Ü[Âˆ›Ş\ÚYİÎ››Û™HZ[\Ü[ÂŸB‹œÚ\™S[Ù[œÚ\™R[™›Ô›İŞÂˆZ[‹ZZYÚNÂˆY[™ÎŒLœZ[\Ü[ÂˆØ\ŒMZ[\Ü[ÂŸB‹œÚ\™S[Ù[œÚ\™R[™›Ô›İÈÛX[ÂˆX\™Ú[‹]ÜZ[\Ü[ÂˆX^]ÚYŒŒÂˆ[™KZZYÚŒKŒÍHZ[\Ü[ÂŸB‹œÚ\™S[Ù[œX›XÔÚ\™PXİ[ÛœŞÂˆØ\ŒLZ[\Ü[ÂŸB‹œÚ\™S[Ù[œX›XÔÚ\™PXİ[ÛœÈœš[X\K‹œÚ\™S[Ù[œX›XÔÚ\™PXİ[ÛœÈœÙXÛÛ™\^ÂˆZ[‹ZZYÚZ[\Ü[ÂˆY[™ÎŒL\MœZ[\Ü[Âˆ›Ü™\‹\˜Y]\ÎŒLœZ[\Ü[ÂŸB‹œÚ\™S[Ù[œX›XÔÚ\™PXİ[ÛœÈœš[X\^Âˆ˜XÚÙÜ›İ[™˜\ŠKYÜ™Y[ŠHZ[\Ü[ÂˆÛÛÜˆÌÌLZ[\Ü[Âˆ›Ü™\‹XÛÛÜ˜\ŠKYÜ™Y[ŠHZ[\Ü[ÂŸB‚‹ÊˆÛ™HY[XØ[ÑĞËYÜ™Y[ˆÚ\™HÛÛ›Û›Üˆİ™\˜[ÙYZÛH[™X›XÈX›\Ëˆ
‹Â˜]Û‹›XY\˜›Ø\™Ú\™P‹‹Û]T›İÈ]Û‹›XY\˜›Ø\™Ú\™P‹‹ÛÙYZÔ™\İ[œİ[[X\H]Û‹›XY\˜›Ø\™Ú\™P‹‹œX›XÓXY\˜›Ø\™]Û‹›XY\˜›Ø\™Ú\™PÂˆ\Ü^Nš[›[™KY›^Z[\Ü[Âˆ›^ŒœZ[\Ü[ÂˆÚYœZ[\Ü[ÂˆZ[‹]ÚYœZ[\Ü[ÂˆX^]ÚYœZ[\Ü[ÂˆZYÚœZ[\Ü[ÂˆZ[‹ZZYÚœZ[\Ü[ÂˆX^ZZYÚœZ[\Ü[ÂˆX\™Ú[ŒZ[\Ü[ÂˆY[™ÎŒZ[\Ü[Âˆ[YÛ‹Z][\Î˜Ù[\ˆZ[\Ü[Âˆ\İYKXÛÛ[˜Ù[\ˆZ[\Ü[Âˆ›Ü™\Œ\ÛÛY˜\ŠKYÜ™Y[ŠHZ[\Ü[Âˆ›Ü™\‹\˜Y]\ÎL	HZ[\Ü[Âˆ˜XÚÙÜ›İ[™˜\ŠKYÜ™Y[ŠHZ[\Ü[ÂˆÛÛÜˆÌÌLZ[\Ü[Âˆ›Ş\ÚYİÎ››Û™HZ[\Ü[Âˆ[™KZZYÚŒZ[\Ü[ÂŸB˜]Û‹›XY\˜›Ø\™Ú\™Pˆİ™Ë‹Û]T›İÈ]Û‹›XY\˜›Ø\™Ú\™Pˆİ™Ë‹ÛÙYZÔ™\İ[œİ[[X\H]Û‹›XY\˜›Ø\™Ú\™Pˆİ™Ë‹œX›XÓXY\˜›Ø\™]Û‹›XY\˜›Ø\™Ú\™Pˆİ™ŞÂˆÚYŒŒZ[\Ü[ÂˆZYÚŒŒZ[\Ü[ÂˆZ[‹]ÚYŒŒZ[\Ü[ÂˆÛÛÜˆÌÌLZ[\Ü[Âˆİ›ÚÙN˜İ\œ™[ÛÛÜˆZ[\Ü[ÂŸB‚YYXJX^]ÚYŒ
^ÂˆœÚ\™S[Ù[ÂˆY[™Ë[YŒNZ[\Ü[ÂˆY[™Ë\šYÚŒNZ[\Ü[ÂˆBˆœÚ\™S[Ù[œÚ\™Q]Z[Ë˜Ø\™ÂˆY[™Ë[YŒMœZ[\Ü[ÂˆY[™Ë\šYÚŒMœZ[\Ü[Âˆ›Ü™\‹\˜Y]\ÎŒMœZ[\Ü[ÂˆBˆœÚ\™S[Ù[œÚ\™R[™›Ô›İŞÂˆZ[‹ZZYÚMœÂˆBˆœÚ\™S[Ù[œÚ\™R[™›Ô›İÈÛX[ÂˆX^]ÚYŒŒM\ÂˆBŸB‚‚‹Êˆ[šYšYYÚ\™HÛÛ›ÛÈ[™[™[È8 %Œ‹LLLÈ
‹Â‹Êˆ]™\HXÛÛ‹[Û›HÚ\™H[H\Ù\ÈHØ[YHÑĞÈ™X]Y[ˆ
‹Â‹œÚ\™RXÛÛ‹˜]Û‹›XY\˜›Ø\™Ú\™P‹‹Û]T›İÈ]Û‹›XY\˜›Ø\™Ú\™P‹‹ÛÙYZÔ™\İ[œİ[[X\H]Û‹›XY\˜›Ø\™Ú\™P‹‹œX›XÓXY\˜›Ø\™]Û‹›XY\˜›Ø\™Ú\™P‹‹œÛØÚY]X˜\ˆ]Û‹œÚ\™RXÛÛ‹‹™Ü›İ\Xİ[ÛœÈ]Û‹œÚ\™RXÛÛÂˆ\Ü^Nš[›[™KY›^Z[\Ü[Âˆ›^ŒœZ[\Ü[ÂˆÚYœZ[\Ü[ÂˆZ[‹]ÚYœZ[\Ü[ÂˆX^]ÚYœZ[\Ü[ÂˆZYÚœZ[\Ü[ÂˆZ[‹ZZYÚœZ[\Ü[ÂˆX^ZZYÚœZ[\Ü[ÂˆX\™Ú[ŒZ[\Ü[ÂˆY[™ÎŒZ[\Ü[Âˆ[YÛ‹Z][\Î˜Ù[\ˆZ[\Ü[Âˆ\İYKXÛÛ[˜Ù[\ˆZ[\Ü[Âˆ›Ü™\Œ\ÛÛYÌŒÌZ[\Ü[Âˆ›Ü™\‹\˜Y]\ÎL	HZ[\Ü[Âˆ˜XÚÙÜ›İ[™ˆÌÌLZ[\Ü[ÂˆÛÛÜ˜\ŠKYÜ™Y[ŠHZ[\Ü[Âˆ›Ş\ÚYİÎ››Û™HZ[\Ü[Âˆ[™KZZYÚŒZ[\Ü[ÂŸB‹œÚ\™RXÛÛˆİ™Ë˜]Û‹›XY\˜›Ø\™Ú\™Pˆİ™Ë‹Û]T›İÈ]Û‹›XY\˜›Ø\™Ú\™Pˆİ™Ë‹ÛÙYZÔ™\İ[œİ[[X\H]Û‹›XY\˜›Ø\™Ú\™Pˆİ™Ë‹œX›XÓXY\˜›Ø\™]Û‹›XY\˜›Ø\™Ú\™Pˆİ™Ë‹œÛØÚY]X˜\ˆ]Û‹œÚ\™RXÛÛˆİ™Ë‹™Ü›İ\Xİ[ÛœÈ]Û‹œÚ\™RXÛÛˆİ™ŞÂˆ\Ü^N˜›ØÚÈZ[\Ü[ÂˆÚYŒŒZ[\Ü[ÂˆZ[‹]ÚYŒŒZ[\Ü[ÂˆX^]ÚYŒŒZ[\Ü[ÂˆZYÚŒŒZ[\Ü[ÂˆZ[‹ZZYÚŒŒZ[\Ü[ÂˆX^ZZYÚŒŒZ[\Ü[ÂˆÛÛÜ˜\ŠKYÜ™Y[ŠHZ[\Ü[Âˆİ›ÚÙN˜İ\œ™[ÛÛÜˆZ[\Ü[ÂŸB‹œÚ\™RXÛÛ˜Xİ]™K˜]Û‹›XY\˜›Ø\™Ú\™P˜Xİ]™^Âˆ˜XÚÙÜ›İ[™ˆÌLNLLˆZ[\Ü[Âˆ˜[œÙ›Ü›NœØØ[JMÊNÂŸB‹™Ü›İ\Xİ[ÛœÎš\ÊœÚ\™RXÛÛŠ^Âˆ\Ü^N™›^Z[\Ü[Âˆ\İYKXÛÛ[™›^Y[™Z[\Ü[ÂˆX\™Ú[‹]ÜŒMÂŸB‹œÛØÚY]T›İÈ›XY\˜›Ø\™Ú\™PÂˆ\İYK\Ù[™[™ÂŸB‚‹ÊˆÜ›İ\[š]][ÛˆÛÙH\Ù\ÈHØ[YH™XYX›H[™›Ü›X][Û‹XØ\™™X]Y[ˆ
‹Â‹œÚ\™S[Ù[œÚ\™PÛÙ^ÂˆX^]ÚY‰NÂˆİ™\™›İË]Ü˜\˜[]Ú\™NÂˆ^X[YÛœšYÚÂˆÛÛÜˆÌMÍ˜ŒÍHZ[\Ü[Âˆ›Û\Ú^™NŒM\Z[\Ü[Âˆ]\‹\ÜXÚ[™Î‹Œ[HZ[\Ü[ÂŸB‚‹Êˆ\Ù\ˆˆÚ\™HÑĞÈ›ÛİÜÈHØ[YHXY[™ËÛÜH[™Xİ[ÛˆY\˜\˜ÚKˆ
‹Â‹\Ù\”Ú\™T[™[Âˆ\Ü^N™ÜšYÂˆØ\ŒLœÂˆX\™Ú[ŒŒœÂˆY[™ÎŒNÂˆ›Ü™\Œ\ÛÛYÙÙÂˆ›Ü™\‹\˜Y]\ÎŒNÂˆ˜XÚÙÜ›İ[™ˆÙY™ŒÎÂˆÛÛÜˆÌLMÌLÂŸB‹\Ù\”Ú\™T[™[œÚ\™U\™Ù]˜[Y^ÂˆÛÛÜˆÌLMÌLˆZ[\Ü[ÂŸB‹\Ù\”Ú\™T[™[œÚ\™R[›ŞÂˆÛÛÜˆÍÌMHZ[\Ü[ÂŸB‹\Ù\”Ú\™T[™[œX›XÔÚ\™PXİ[ÛœŞÂˆ\Ü^N™ÜšYÂˆÜšY][\]KXÛÛ[[œÎŒYœÂˆØ\\ÂŸB‹\Ù\”Ú\™T[™[œX›XÔÚ\™PXİ[ÛœÈ]ÛÂˆÚYŒL	HZ[\Ü[ÂˆZ[‹ZZYÚÂˆX\™Ú[ŒZ[\Ü[Âˆ›Ü™\‹\˜Y]\ÎŒLœZ[\Ü[ÂŸB‹\Ù\”Ú\™T[™[œX›XÔÚ\™PXİ[ÛœÈœš[X\^Âˆ˜XÚÙÜ›İ[™˜\ŠKYÜ™Y[ŠHZ[\Ü[ÂˆÛÛÜˆÌÌLZ[\Ü[Âˆ›Ü™\‹XÛÛÜ˜\ŠKYÜ™Y[ŠHZ[\Ü[ÂŸB‹\Ù\”Ú\™T[™[œX›XÔÚ\™PXİ[ÛœÈœÙXÛÛ™\^Âˆ˜XÚÙÜ›İ[™ˆÌLNLLˆZ[\Ü[ÂˆÛÛÜˆÙYÙZ[\Ü[Âˆ›Ü™\‹XÛÛÜˆÌÌÍÍˆZ[\Ü[ÂŸB‹\Ù\”Ú\™T[™[œX›XÔÚ\™PXİ[ÛœÈİ™ŞÂˆÚYŒNÂˆZYÚŒNÂŸB‹\Ù\”Ú\™T[™[™ÛÛ‘ØZ[Ø\™ÂˆX\™Ú[‹]ÜÂŸB‚YYXJX^]ÚYŒ
^ÂˆœÚ\™RXÛÛ‹ˆ]Û‹›XY\˜›Ø\™Ú\™P‹ˆÛ]T›İÈ]Û‹›XY\˜›Ø\™Ú\™P‹ˆÛÙYZÔ™\İ[œİ[[X\H]Û‹›XY\˜›Ø\™Ú\™P‹ˆœX›XÓXY\˜›Ø\™]Û‹›XY\˜›Ø\™Ú\™P‹ˆœÛØÚY]X˜\ˆ]Û‹œÚ\™RXÛÛ‹ˆ™Ü›İ\Xİ[ÛœÈ]Û‹œÚ\™RXÛÛÂˆ›^X˜\Ú\ÎZ[\Ü[ÂˆÚYZ[\Ü[ÂˆZ[‹]ÚYZ[\Ü[ÂˆX^]ÚYZ[\Ü[ÂˆZYÚZ[\Ü[ÂˆZ[‹ZZYÚZ[\Ü[ÂˆX^ZZYÚZ[\Ü[ÂˆBŸB‚‚‹ÊˆÛÛ\Xİ\ØÜ™Y]X\İXY›Üˆ™XY[Û›HÚ\™YXY\˜›Ø\™È
‹Â‹œX›XÓXY\˜›Ø\™ˆXY\ÂˆÜÚ][Ûœ™[]]™NÂˆÜ˜]]ÎÂˆZ[‹ZZYÚŒÂˆY[™ÎŒLMÂˆØ\ŒLœÂˆ˜XÚÙÜ›İ[™ˆÌMLYNÂˆ›Ü™\‹X›İÛNŒ\ÛÛY™Ø˜JMKMKMKŒ
NÂˆ›Ş\ÚYİÎ››Û™NÂˆ˜XÚÙ›ÜYš[\››Û™NÂŸB‹œX›XÓXY\˜›Ø\™ˆXY\ˆÛÜ™X\šŞÂˆ›Û\Ú^™NŒM\Âˆ]\‹\ÜXÚ[™Î‹K\Âˆ[™KZZYÚŒNÂŸB‹œX›XÓXY\˜›Ø\™ˆXY\ˆÛÜ™X\šÈÛX[ÂˆX\™Ú[‹[Y\Âˆ›Û\Ú^™NÜÂˆ]\‹\ÜXÚ[™ÎŒKÂŸB‹œX›XÓXY\˜›Ø\™ˆXY\ˆÂˆX\™Ú[ŒÂˆÛÛÜˆØYX˜ØŒÎÂˆ›Û\Ú^™N\Âˆ›Û]ÙZYÚÌÂˆ]\‹\ÜXÚ[™Î‹Œ[NÂˆÚ]K\ÜXÙN››İÜ˜\ÂŸB‚‹œX›XÓXY\˜›Ø\™ˆXY\ˆœX›XÑÙ]ÙØŞÂˆ›^Œ]]ÎÂˆY[™Î\Âˆ›Ü™\Œ\ÛÛY™Ø˜JLL‹ŒÌÍKMJNÂˆ›Ü™\‹\˜Y]\ÎNN\ÂˆÛÛÜˆÎXYŒMÙÂˆ›Û\Ú^™NÂˆ›Û]ÙZYÚLÂˆ]\‹\ÜXÚ[™Î‹Œ[NÂˆ[™KZZYÚŒNÂˆ^YXÛÜ˜][Û››Û™NÂˆÚ]K\ÜXÙN››İÜ˜\ÂŸB‹œX›XÓXY\˜›Ø\™ˆXY\ˆœX›XÑÙ]ÙØÎ™›Øİ\Ë]š\ÚX›^Âˆİ][™NŒœÛÛYÍÌMÂˆİ][™K[Ù™œÙ]ŒœÂŸB‚‹œ[™Yœ™\Ú[™XØ]ÜˆÂˆÜÚ][Ûˆš^YÂˆÜˆØ[Ê[ŠØY™KX\™XKZ[œÙ]]Ü
H
È
NÂˆYˆL	NÂˆ˜[œÙ›Ü›Nˆ˜[œÛ]V
ML	JNÂˆ‹Z[™^ˆLÂˆ\Ü^NˆÜšYÂˆXÙKZ][\ÎˆÙ[\ÂˆÚYˆÍœÂˆZYÚˆÍœÂˆ›Ü™\‹\˜Y]\ÎˆL	NÂˆ˜XÚÙÜ›İ[™ˆÙ™™ÂˆÛÛÜˆÌMÍŒØNÂˆ›Ş\ÚYİÎˆœÌÎÂˆÚ[\‹Y]™[Îˆ›Û™NÂŸB‹œ[™Yœ™\Ú[™XØ]ÜˆÜ[ˆÂˆÚYˆNÂˆZYÚˆNÂˆ›Ü™\ˆœÛÛYİ\œ™[ÛÛÜÂˆ›Ü™\‹\šYÚXÛÛÜˆ˜[œÜ\™[Âˆ›Ü™\‹\˜Y]\ÎˆL	NÂˆ[š[X][Ûˆ[™Yœ™\ÚÜ[ˆÜÈ[™X\ˆ[™š[š]NÂŸBÙ^Yœ˜[Y\È[™Yœ™\ÚÜ[ˆÂˆÈÈ˜[œÙ›Ü›Nˆ›İ]JÍŒYÊNÈBŸBYYXH
™Y™\œË\™YXÙY[[İ[Ûˆ™YXÙJHÂˆœ[™Yœ™\Ú[™XØ]ÜˆÜ[ˆÈ[š[X][Ûˆ›Û™NÈBŸB‚‹›XY\˜›Ø\™^[İ]İ[[X\^Ø›Ü™\Œ\ÛÛYÌÍØNØ›Ü™\‹\˜Y]\ÎŒMÜY[™ÎŒLœMœÛX\™Ú[‹]ÜŒLœØ˜XÚÙÜ›İ[™ˆÌLXŒMØÛÛÜˆÙÙİ^X[YÛ›YÛİ™\™›İË]Ü˜\˜[]Ú\™_K›XY\˜›Ø\™^[İ]İ[[X\HÛX\™Ú[ŒÙ›Û\Ú^™NŒMÛ[™KZZYÚŒKMNÙ›Û]ÙZYÚŒK›XY\˜›Ø\™^[İ]İ[[X\H
ÜÛX\™Ú[‹]ÜœB‹œ^[İ][^Ù\Ü^N™ÜšYÙÜšY][\]KXÛÛ[[œÎ›Z[›X^
YœŠHLL]]ÎÙØ\ŒLØ[YÛ‹Z][\Î™[™ÜY[™ÎŒLœØ›Ü™\‹]ÜŒ\ÛÛYÙLMYL_Kœ^[İ][OœÜ[Ù\Ü^N™›^Ù›^Y\™Xİ[Û˜ÛÛ[[ÛZ[‹]ÚYŒKœ^[İ][HÛX[ÛX\™Ú[‹]ÜŒÜØÛÛÜˆÍÍM™ŸKœ^[İ][HX™[ÛX\™Ú[ŒÙ›Û\Ú^™N‹Í\™[_Kœ^[İ][H[œ]ÛX\™Ú[‹]ÜKœ^[İ][H]ÛÛX\™Ú[ŒİÚ]K\ÜXÙN››İÜ˜\PYYXJX^]ÚYŒ
^Ëœ^[İ][^ÙÜšY][\]KXÛÛ[[œÎ›Z[›X^
YœŠHLKœ^[İ][OœÜ[ÙÜšYXÛÛ[[ŒKËL_Kœ^[İ][H]ÛÛZ[‹ZZYÚœ_B‚‹Êˆ™]HL‹ŒˆÛÛ\XİXYİYH[Û™^H^[İ]›Üİ\‹ˆ
‹Â‹œ^[İ]›Üİ\Ù\Ü^N™ÜšYÙØ\ŒÛX\™Ú[‹X›İÛNŒMœØ›Ü™\Œ\ÛÛYÙY™ÎØ›Ü™\‹\˜Y]\ÎŒLœÛİ™\™›İÎšY[ŸB‹œ^[İ]›Üİ\’XYœ^[İ]ÛÛ™\Ù\Ü^N™ÜšYÙÜšY][\]KXÛÛ[[œÎ›Z[›X^
MLKÙœŠH™\X]
ËZ[›X^
ÌœYœŠJHZ[›X^
L\œŠHœØ[YÛ‹Z][\Î˜Ù[\ŸB‹œ^[İ]›Üİ\’XYÜY[™Î\LØ˜XÚÙÜ›İ[™ˆÙYŒYYNØ›Ü™\‹X›İÛNŒ\ÛÛYØÎØÙ›Û\Ú^™N‹Í\™[NÙ›Û]ÙZYÚLİ^]˜[œÙ›Ü›N\\˜Ø\ÙNÛ]\‹\ÜXÚ[™Î‹ŒY[_B‹œ^[İ]ÛÛ™\ÜY[™Î\LØ›Ü™\‹X›İÛNŒ\ÛÛYÙY™ßB‹œ^[İ]ÛÛ™\›\İXÚ[Ø›Ü™\‹X›İÛNŒB‹œ^[İ]ÛÛ™\“˜[Y^ÛZ[‹]ÚYŒÜY[™ÎŒØ›Ü™\ŒØ˜XÚÙÜ›İ[™››Û™NØÛÛÜš[š\š]İ^X[YÛ›YB‹œ^[İ]ÛÛ™\“˜[YHÜ[Ù\Ü^N˜›ØÚÎÛİ™\™›İÎšY[Ù›Û]ÙZYÚLİ^[İ™\™›İÎ™[\Ú\ÎİÚ]K\ÜXÙN››İÜ˜\B‹œ^[İ]ÛÛ™\“˜[YHÛX[œ^[İ]šYİ\™HÛX[œ^[İ][[İ[ÛX[œ^[İ]Ú\™HÛX[Ù\Ü^N››Û™_B‹œ^[İ]šYİ\™HÙ›Û\Ú^™N‹\™[_B‹œ^[İ][[İ[ÛX\™Ú[ŒKœ^[İ][[İ[Ü[Ù\Ü^N™›^Ø[YÛ‹Z][\Î˜Ù[\ÙØ\ŒÜÙ›Û]ÙZYÚKœ^[İ][[İ[[œ]İÚYÎÛX\™Ú[ŒÜY[™ÎœB‹œ^[İ]™XÛÜ™ÛX\™Ú[ŒÚ\İYK\Ù[œİ\B‹œ^[İ]Ú\™^Ù\Ü^N™›^Ø[YÛ‹Z][\Î˜Ù[\Ú\İYKXÛÛ[˜Ù[\ÛX\™Ú[ŒKœ^[İ]Ú\™H[œ]İÚYŒŒœÚZYÚŒŒœÛX\™Ú[ŒB‹œ^[İ]\İÜ^ÙÜšYXÛÛ[[ŒKËLNÛX\™Ú[‹]ÜŒLÜY[™ÎŒLœØ›Ü™\‹\˜Y]\ÎŒLØ˜XÚÙÜ›İ[™ˆÙŒ™YŒßB‹œ^[İ]\İÜH[ÛX\™Ú[œLœÜY[™Ë[YŒŒBYYXJX^]ÚYÌ
^Âˆœ^[İ]›Üİ\Ø›Ü™\ŒØ›Ü™\‹\˜Y]\ÎŒÛİ™\™›İÎš\ÚX›_Bˆœ^[İ]›Üİ\’XYÙ\Ü^N››Û™_Bˆœ^[İ]ÛÛ™\ÙÜšY][\]KXÛÛ[[œÎœ™\X]
ËZ[›X^
YœŠJNÙØ\ŒLÛX\™Ú[‹X›İÛNŒLÜY[™ÎŒLœØ›Ü™\Œ\ÛÛYÙY™ÎØ›Ü™\‹\˜Y]\ÎŒLœØ˜XÚÙÜ›İ[™ˆÙ™™ŸBˆœ^[İ]ÛÛ™\“˜[Y^ÙÜšYXÛÛ[[ŒKËLNÙ\Ü^N™›^Ø[YÛ‹Z][\Î˜Ù[\Ú\İYKXÛÛ[œÜXÙKX™]ÙY[ÙØ\ÜY[™ËX›İÛNØ›Ü™\‹X›İÛNŒ\ÛÛYÙL™MÙMBˆœ^[İ]ÛÛ™\“˜[YHÜ[İÚ]K\ÜXÙN››Ü›X[Kœ^[İ]ÛÛ™\“˜[YHÛX[Ù\Ü^N˜›ØÚÎÙ›^Œ]]ÎØÛÛÜ˜\ŠKYÜ™Y[ŠNÙ›Û]ÙZYÚBˆœ^[İ]šYİ\™^İ^X[YÛ›YKœ^[İ]šYİ\™HÛX[œ^[İ][[İ[ÛX[œ^[İ]Ú\™HÛX[Ù\Ü^N˜›ØÚÎÛX\™Ú[‹X›İÛNŒÜØÛÛÜˆÍÍM™Ù›Û\Ú^™N‹™[NÙ›Û]ÙZYÚİ^]˜[œÙ›Ü›N\\˜Ø\Ù_Bˆœ^[İ]šYİ\™HÙ›Û\Ú^™NŒ\™[_Kœ^[İ]İÙYØÛÛÜ˜\ŠKYÜ™Y[Š_Bˆœ^[İ][[İ[ÙÜšYXÛÛ[[ŒKÌßKœ^[İ][[İ[[œ]Ø›Ş\Ú^š[™Î˜›Ü™\‹X›ŞİÚYŒL	NÛZ[‹]ÚYŒBˆœ^[İ]™XÛÜ™ÙÜšYXÛÛ[[ŒÎØ[YÛ‹\Ù[™[™İÚYŒL	NÛZ[‹ZZYÚÚ\İYKXÛÛ[˜Ù[\ŸBˆœ^[İ]Ú\™^ÙÜšYXÛÛ[[ŒKËLNÚ\İYKXÛÛ[™›^\İ\ÙØ\\ÜY[™Ë]ÜŒœKœ^[İ]Ú\™HÛX[ÛX\™Ú[ŒBˆœ^[İ]\İÜ^ÙÜšYXÛÛ[[ŒKËLNÛX\™Ú[‹]ÜŒBŸB‚‹œ^[İ]İ[ŞÙ\Ü^N™ÜšYÙÜšY][\]KXÛÛ[[œÎ›Z[›X^
MLYœŠH™\X]
ËZ[›X^
]]ÊJHZ[›X^
L\]]ÊHZ[›X^
Ì]]ÊHZ[›X^
Ìœ]]ÊNÙØ\ŒÜY[™ÎŒL\LØ›Ü™\‹]ÜŒœÛÛYÌLŒÌNNØ˜XÚÙÜ›İ[™ˆÙNYYNNØ[YÛ‹Z][\Î˜Ù[\ŸB‹œ^[İ]İ[Ó˜[Y^İ^]˜[œÙ›Ü›N\\˜Ø\ÙNÛ]\‹\ÜXÚ[™Î‹ŒY[_BYYXJX^]ÚYÌ
^Âˆœ^[İ]İ[ŞÙÜšY][\]KXÛÛ[[œÎœ™\X]
ËZ[›X^
YœŠJNÙØ\ŒLÛX\™Ú[‹]ÜŒœÜY[™ÎŒLœØ›Ü™\ŒœÛÛYÌLŒÌNNØ›Ü™\‹\˜Y]\ÎŒLœBˆœ^[İ]İ[Ó˜[Y^ÙÜšYXÛÛ[[ŒKËL_Bˆœ^[İ]İ[Èœ^[İ]šYİ\™HÛX[Ù\Ü^N˜›ØÚßBˆœ^[İ]İ[Ğ›[šŞÙ\Ü^N››Û™_BŸB‚‹Êˆ™\İ[ÈÙXİ[ÛœÈ™]Z[ˆH^\İ[™ÈØ\™İ[[™ÈÚ[H[İÚ[™ÈXXÚX›HÈÛÛ\ÙKˆ
‹Â‹ÛÙXİ[ÛÛX\™Ú[‹X›İÛNŒLœB‹ÛÙXİ[Û”İ[[X\^Ù\Ü^N™›^Ø[YÛ‹Z][\Î˜Ù[\Ú\İYKXÛÛ[œÜXÙKX™]ÙY[Û\İ\İ[N››Û™NØİ\œÛÜœÚ[\Ù›Û]ÙZYÚÛ]\‹\ÜXÚ[™Î‹Œ[NØÛÛÜˆÌLLŒNNÜY[™ÎB‹ÛÙXİ[Û”İ[[X\N‹]ÙXšÚ]Y]Z[Ë[X\šÙ\Ù\Ü^N››Û™_B‹ÛÙXİ[Û”İ[[X\N˜Y\ØÛÛ[‰ø£!	ÎÙ›Û\Ú^™NŒKŒÍ\™[NÛ[™KZZYÚŒNİ˜[œÙ›Ü›Nœ›İ]JNLYÊNİ˜[œÚ][Û˜[œÙ›Ü›HŒM\ßB‹ÛÙXİ[Û–ÛÜ[—O‹ÛÙXİ[Û”İ[[X\N˜Y\İ˜[œÙ›Ü›N››Û™_B‹ÛÙXİ[Û–ÛÜ[—O‹ÛÙXİ[Û”İ[[X\^ÛX\™Ú[‹X›İÛNŒMBšXY\™]‹šXY\Xİ[ÛœŞÙ›^Y\™Xİ[Ûœ›İÎØ[YÛ‹Z][\Î˜Ù[\ÙØ\ŒLœB‹\]PYZ[Xİ[ÛœŞÙ\Ü^N™›^Ù›^]Ü˜\Ü˜\ÙØ\ÛX\™Ú[‹]ÜŒMœÜY[™Ë]ÜŒMØ›Ü™\‹]ÜŒ\ÛÛYÙ™MYL_K\]PYZ[Xİ[ÛœÈ]ÛÙ\Ü^N™›^Ø[YÛ‹Z][\Î˜Ù[\Ú\İYKXÛÛ[˜Ù[\ÙØ\œØ›Ü™\Œ\ÛÛYØØ™ØÙNØ›Ü™\‹\˜Y]\ÎŒLØ˜XÚÙÜ›İ[™ˆÙ™™ØÛÛÜˆÌMÌŒNNÜY[™ÎŒLLœÙ›Û]ÙZYÚLK\]PYZ[Xİ[ÛœÈ]Ûˆİ™ŞİÚYŒMÜK\]PYZ[Xİ[ÛœÈ]Û‹™[]^ØÛÛÜˆØLÌŒØ›Ü™\‹XÛÛÜˆÙL˜Ø˜ßKœÛ™\ÜÛœÙ\ŞÛX\™Ú[‹]ÜŒLœØ›Ü™\Œ\ÛÛYÙ™NØ›Ü™\‹\˜Y]\ÎŒLœÛİ™\™›İÎšY[ŸKœÛ™\ÜÛœÙ\ÈÛX\™Ú[ŒÜY[™ÎŒL\LœØ˜XÚÙÜ›İ[™ˆÙYŒ™Y_KœÛ™\ÜÛœÙ\Ï™]Ù\Ü^N™›^Ø[YÛ‹Z][\Î˜Ù[\Ú\İYKXÛÛ[œÜXÙKX™]ÙY[ÙØ\ŒLœÜY[™ÎŒLLœØ›Ü™\‹]ÜŒ\ÛÛYÙL™MÙMKœÛ™\ÜÛœÙ\Èİ›Û™Şİ^X[YÛœšYÚKœÛ™\ÜÛœÙ\È››İ›İYØÛÛÜˆÍÙÎÙ›Û]ÙZYÚÌB‹œ\ÚÙ][™ÜŞÛX\™Ú[ŒNÜY[™ÎŒMœØ›Ü™\Œ\ÛÛYÙ™NØ›Ü™\‹\˜Y]\ÎŒMØ˜XÚÙÜ›İ[™ˆÙYYŒÙYŸKœ\ÚÙ][™ÜÏ˜Ù\Ü^N˜›ØÚÎØÛÛÜˆÌLŒŒNÛ]\‹\ÜXÚ[™Î‹Œ[_Kœ\ÚÙ][™ÜÈœš[X\Kœ\ÚÙ][™ÜÈœÙXÛÛ™\^ÛX\™Ú[‹]ÜŒLKœ\Ú›İXÙ^ÛX\™Ú[\ØÛÛÜˆÍXÍYÙ›Û\Ú^™N‹\™[NÙ›Û]ÙZYÚÌB