import {winterLeagueTable} from './winterLeague.js';
import {completedPlayoffPlacings,entrantPrizeShares,leaguePrizeForecast,linkedPrizePlayoffs,seasonPrizePots} from './leagueMoneyModel.js';

const pence=value=>Math.round((Number(value)||0)*100);
const status=(comp,now=Date.now())=>{if(comp?.status==='cancelled'||comp?.status==='deleted'||comp?.status==='draft')return comp.status;if(comp?.status==='completed')return'completed';const end=Date.parse(comp?.ends);return Number.isFinite(end)&&now>=end?'completed':comp?.status||'live'};
const embargoed=(comp,now=Date.now())=>{const release=Date.parse(comp?.resultsEmbargo?.releaseAt);return !!(comp?.resultsEmbargo?.enabled&&Number.isFinite(release)&&now<release)};

export function leagueMoneyLedger(state,league,now=Date.now()){
 const cfg={entryFee:12,twosFee:8,weeklyPrizePerPlayer:10,finalFirst:60,...(league?.moneySettings||{})};
 const members=(league?.memberIds||[]).map(id=>(state.players||[]).find(p=>p.id===id)).filter(Boolean),payouts=[];
 let wl=null;try{wl=winterLeagueTable(league,state,new Date(now))}catch{}
 const weeks=wl?.weekly||[],finalWeek=w=>status(w.comp,now)==='completed'&&!embargoed(w.comp,now);
 const twosPerWeek=members.length*(+cfg.twosFee||0)/Math.max(1,weeks.length||league?.targetCompetitions||1);let carry=0;
 for(const w of weeks){if(!finalWeek(w))continue;const winner=(w.rows||[]).find(r=>r.position===1&&Number.isFinite(r.points)),team=(league.teams||[]).find(t=>t.id===winner?.teamId);
  for(const playerId of team?.memberIds||[]){const player=(state.players||[]).find(p=>p.id===playerId);if(player)payouts.push({key:`week-${w.comp.id}-${playerId}`,compId:w.comp.id,playerId,name:player.name,reason:`Week ${w.weekNumber} winner`,amount:+cfg.weeklyPrizePerPlayer||0});}
  carry+=twosPerWeek;const ids=new Set(w.comp?.entries||league.memberIds||[]),hits=[];
  for(const card of (state.cards||[]).filter(card=>card.compId===w.comp?.id&&ids.has(card.playerId)))for(const[g,hole]of(card.gross||[]).map((g,i)=>[g,i+1]))if(+g===2)hits.push({playerId:card.playerId,hole});
  if(!hits.length)continue;const share=carry/hits.length,allocations=[],allocated=new Set();
  for(const t of league.teams||[]){const memberIds=(t.memberIds||[]).filter(id=>(state.players||[]).some(p=>p.id===id)),teamHits=hits.filter(hit=>memberIds.includes(hit.playerId));if(!teamHits.length)continue;memberIds.forEach(id=>allocated.add(id));if(t.shareTwos){const each=share*teamHits.length/Math.max(1,memberIds.length);memberIds.forEach(playerId=>allocations.push({playerId,amount:each,reason:`Week ${w.weekNumber} 2s · ${t.name} shared`}));}else for(const playerId of memberIds){const count=teamHits.filter(hit=>hit.playerId===playerId).length;if(count)allocations.push({playerId,amount:share*count,reason:`Week ${w.weekNumber} 2s`});}}
  for(const playerId of new Set(hits.map(hit=>hit.playerId)))if(!allocated.has(playerId)){const count=hits.filter(hit=>hit.playerId===playerId).length;allocations.push({playerId,amount:share*count,reason:`Week ${w.weekNumber} 2s`});}
  for(const allocation of allocations){const player=(state.players||[]).find(p=>p.id===allocation.playerId);if(player)payouts.push({key:`twos-${w.comp.id}-${allocation.playerId}`,compId:w.comp.id,name:player.name,...allocation});}carry=0;
 }
 const scheduled=Math.max(weeks.length,Number(league?.targetCompetitions)||0),winnerRecipients=(league?.teams||[]).length?Math.max(1,...league.teams.map(t=>Math.max(1,(t.memberIds||[]).length))):1;
 const forecast=leaguePrizeForecast({memberCount:members.length,entryFeePerPlayer:cfg.entryFee,twosFeePerPlayer:cfg.twosFee,scheduledWeeks:scheduled,weeklyPrizePerPlayer:cfg.weeklyPrizePerPlayer,weeklyWinnerRecipients:winnerRecipients});
 const playoff=linkedPrizePlayoffs(state,league.id).find(r=>r.id===cfg.playoffSeriesId)||linkedPrizePlayoffs(state,league.id)[0]||null,destination=playoff?(cfg.seasonPrizeDestination||'playoff'):'league-table';
 const pots=seasonPrizePots({remainingLeaguePot:forecast.seasonEndingFund,destination,playoffPercent:cfg.playoffPotPercent??50,separatePlayoffPot:cfg.separatePlayoffPot,leagueChampionBonus:cfg.leagueChampionBonus,playoffCancelled:playoff?.status==='cancelled'||playoff?.matchplay?.status==='cancelled',cancellationFallback:cfg.playoffCancellationFallback});
 const complete=weeks.length>0&&weeks.every(finalWeek);
 if(complete&&wl?.table?.length&&pots.leaguePot>0){const pct=Math.max(0,Math.min(100,+cfg.finalFirst||0));for(const[teamRow,amount,label]of[[wl.table[0],pots.leaguePot*pct/100,'League 1st'],[wl.table[1],pots.leaguePot*(100-pct)/100,'League 2nd']])for(const playerId of teamRow?.memberIds||[]){const player=(state.players||[]).find(p=>p.id===playerId);if(player)payouts.push({key:`final-${label}-${playerId}`,playerId,name:player.name,reason:label,amount:amount/Math.max(1,teamRow.memberIds.length)});}}
 if(complete&&wl?.table?.length&&pots.championBonus>0){const ids=(wl.table[0]?.memberIds||[]).filter(id=>(state.players||[]).some(p=>p.id===id));for(const playerId of ids){const player=state.players.find(p=>p.id===playerId);payouts.push({key:`league-champion-bonus-${playerId}`,playerId,name:player.name,reason:'League champion bonus',amount:pots.championBonus/Math.max(1,ids.length)});}}
 const placings=completedPlayoffPlacings(playoff);if(pots.playoffPot>0&&placings){const pct=Math.max(0,Math.min(100,+(cfg.playoffFinalFirst??60)||0));for(const[entrantId,amount,label]of[[placings.winnerId,pots.playoffPot*pct/100,'Playoff winner'],[placings.runnerUpId,pots.playoffPot*(100-pct)/100,'Playoff runner-up']])for(const part of entrantPrizeShares(league,entrantId,amount)){const player=(state.players||[]).find(p=>p.id===part.playerId);if(player)payouts.push({key:`playoff-${playoff.id}-${label}-${part.playerId}`,playerId:part.playerId,name:player.name,reason:label,amount:part.amount});}}
 const balances=new Map(members.map(player=>[player.id,{playerId:player.id,name:player.name,earnedPence:0,paidPence:0,manualPaidPence:0,prizes:[],history:[]}])) ,legacy=league.moneyPaidOut||{},payments=league.moneyPayoutPayments||{};
 for(const prize of payouts){const row=balances.get(prize.playerId);if(!row)continue;row.earnedPence+=pence(prize.amount);const paid=Object.prototype.hasOwnProperty.call(payments,prize.key)?Math.max(0,Math.min(pence(prize.amount),pence(payments[prize.key]))):legacy[prize.key]?pence(prize.amount):0;row.paidPence+=paid;row.prizes.push({...prize,amountPence:pence(prize.amount),paidPence:paid});if(paid)row.history.push({id:prize.key,amountPence:paid,description:prize.reason});}
 for(const payment of Object.values(league.moneyPaymentsById||{})){const row=balances.get(payment.playerId);if(row){const amount=Number(payment.amountPence)||0;row.paidPence+=amount;row.manualPaidPence+=amount;row.history.push(payment);}}
 for(const row of balances.values()){let remaining=row.manualPaidPence;row.prizes=row.prizes.map(prize=>{const directlyPaid=prize.paidPence||0,allocated=Math.min(Math.max(0,prize.amountPence-directlyPaid),remaining);remaining-=allocated;const displayPaidPence=directlyPaid+allocated;return{...prize,displayPaidPence,owedPence:Math.max(0,prize.amountPence-displayPaidPence)}});row.owedPence=Math.max(0,row.earnedPence-row.paidPence);}
 return{cfg,members,payouts,balances,entryPaid:league.moneyPaidIn||{},entryDuePence:pence((+cfg.entryFee||0)+(+cfg.twosFee||0)),forecast,pots,playoff};
}

export function playerMoneySummaries(state,playerId,now=Date.now()){
 return(state.leagues||[]).filter(l=>l.recordType!=='matchplay-series'&&(l.memberIds||[]).includes(playerId)).map(league=>{const ledger=leagueMoneyLedger(state,league,now),balance=ledger.balances.get(playerId);return{league,entryPaid:!!ledger.entryPaid[playerId],entryDuePence:ledger.entryDuePence,earnedPence:balance?.earnedPence||0,paidPence:balance?.paidPence||0,owedPence:balance?.owedPence||0,prizes:balance?.prizes||[],history:balance?.history||[]};});
}
