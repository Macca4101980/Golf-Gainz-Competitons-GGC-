import {FORMAT_RULES, scoreCard, pairScore, fourballMatchResult, normaliseBlindPairIds} from './scoring.js';
import {groupLeaderboard, isGroupFormat} from './groupScoring.js';
import {winterLeagueTable} from './winterLeague.js';
import {publicVisibility} from './leagueDisplay.js';

const completed = (c, now) => c.status === 'completed' || (!['draft','cancelled','deleted'].includes(c.status) && now >= Date.parse(c.ends));
const amount = n => '£' + Number(n).toFixed(2).replace(/\.00$/, '');
const list = values => values.length < 2 ? values.join('') : values.slice(0,-1).join(', ') + ' & ' + values.at(-1);
const names = (ids, state) => ids.map(id => state.players.find(p => p.id === id)?.name || 'Unknown golfer').join(' & ');
const indexes = c => c.holesMode === 'front9' ? Array.from({length:9},(_,i)=>i) : c.holesMode === 'back9' ? Array.from({length:9},(_,i)=>i+9) : Array.from({length:18},(_,i)=>i);

function twos(c, state, pot) {
 const ids = new Set(c.entries || []), hits = new Map();
 for (const card of state.cards || []) if (card.compId === c.id && ids.has(card.playerId)) {
  const count = indexes(c).filter(i => +card.gross?.[i] === 2).length;
  if (count) hits.set(card.playerId, (hits.get(card.playerId) || 0) + count);
 }
 const count = [...hits.values()].reduce((a,b)=>a+b,0);
 return {hits, share:count ? pot/count : 0};
}

// Display only: use the same standings and pot rules as the existing money screens.
export function leaderboardPayoutLines(c, state, now = Date.now()) {
 if (['draft','scheduled','cancelled','deleted'].includes(c.status) && !(c.status === 'scheduled' && now >= Date.parse(c.starts))) return [];
 const visibility = publicVisibility(c, now);
 const releaseAt = c.resultsEmbargo?.enabled ? Date.parse(c.resultsEmbargo.releaseAt) : NaN;
 const winnersReady = !visibility.provisional && (completed(c, now) || (Number.isFinite(releaseAt) && now >= releaseAt));
 const league = (state.leagues || []).find(l=>l.id === c.leagueId && l.teams?.length);
 const lines = [];
 if (!winnersReady && Number.isFinite(releaseAt)) {
  const date = new Date(releaseAt);
  const time = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'numeric',minute:'2-digit',hour12:true}).format(date).replace(':00','').replace(' ','');
  const day = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',day:'numeric',month:'long'}).format(date);
  lines.push(`Comp Winners shown at ${time} ${day}`);
 }
 let twosResult;
 if (league) {
  const cfg = {twosFee:8, weeklyPrizePerPlayer:10, ...league.moneySettings};
  const weeks = winterLeagueTable(league, state, new Date(now)).weekly;
  const week = weeks.find(w=>w.comp.id === c.id), winner = week?.rows.find(r=>r.position === 1 && r.complete === indexes(c).length && Number.isFinite(r.points));
  const team = league.teams.find(t=>t.id === winner?.teamId);
  if (winnersReady && team && +cfg.weeklyPrizePerPlayer > 0) lines.push(`Comp Winners ${amount(+cfg.weeklyPrizePerPlayer)} each = ${names(team.memberIds || [], state)}`);
  const members = (league.memberIds || []).filter(id=>state.players.some(p=>p.id === id));
  const contribution = members.length * (+cfg.twosFee || 0) / Math.max(1, weeks.length || league.targetCompetitions || 1);
  let carry = 0;
  for (const w of weeks) {
   carry += contribution;
   const result = twos({...w.comp, entries:w.comp.entries || league.memberIds || []}, state, carry);
   if (w.comp.id === c.id) {twosResult = result; break;}
   if (completed(w.comp, now) && result.hits.size) carry = 0;
  }
 } else {
  let rows = [];
  if (isGroupFormat(c.format)) rows = groupLeaderboard(c,state).map(r=>({...r, ids:r.playerIds}));
  else if (c.format === '4bbb-match' && c.pairs?.length === 2) {
   const match = fourballMatchResult(c.pairs[0],c.pairs[1],c,state);
   if (match.up) rows = [{ids:c.pairs[match.up > 0 ? 0 : 1].ids}];
  } else if (c.format === 'blind-pairs') rows = (c.blindDraw?.pairs || []).map(p=>{
   const ids=normaliseBlindPairIds(p), cards=ids.map(id=>state.cards.find(card=>card.compId===c.id&&card.playerId===id));
   return cards.every(Boolean)?{ids, rankValue:cards.reduce((n,card)=>n+scoreCard(card,c,state).points,0)}:null;
  }).filter(Boolean);
  else if (FORMAT_RULES[c.format]?.category === 'pairs') rows = (c.pairs || []).map(p=>({...pairScore(p,c,state),ids:p.ids}));
  else if (FORMAT_RULES[c.format]?.verified) rows = (state.cards || []).filter(card=>card.compId===c.id).map(card=>({...scoreCard(card,c,state),ids:[card.playerId]}));
  if (c.format !== '4bbb-match') rows = rows.filter(r=>!r.noReturn && (c.format === 'flag' ? !!r.flagResult?.hole || r.flagResult?.completed18 : r.complete === undefined || r.complete === indexes(c).length));
  if (c.format !== '4bbb-match') rows.sort((a,b)=>FORMAT_RULES[c.format]?.lowerWins?a.rankValue-b.rankValue:b.rankValue-a.rankValue);
  const split = c.overallSplit || {first:100,second:0,third:0};
  const pot = (c.entries || []).length * (+c.fee || 0) * (+(c.payouts?.overall ?? 100))/100;
  [split.first,split.second,split.third].forEach((pct,i)=>{
   const row=rows[i], prize=pot*(+pct||0)/100;
   if (winnersReady && row?.ids?.length && prize>0) lines.push(`${i===0?'Comp Winners':i===1?'Comp 2nd':'Comp 3rd'} ${amount(prize/row.ids.length)} each = ${names(row.ids,state)}`);
  });
  if (c.twoClub) twosResult = twos(c,state,(c.entries || []).length*(+c.twoFee || 0));
 }
 if (twosResult?.share > 0) {
  // Multiple 2s earn multiple shares; group by actual per-person payout.
  const groups = new Map();
  for (const [id,count] of twosResult.hits) {
   const payout = (twosResult.share*count).toFixed(2);
   groups.set(payout,[...(groups.get(payout)||[]),id]);
  }
  for (const [payout,ids] of groups) lines.push(`Weekly 2s ${amount(+payout)} each : ${list(ids.map(id=>state.players.find(p=>p.id===id)?.name || 'Unknown golfer'))}`);
 }
 return lines;
}
