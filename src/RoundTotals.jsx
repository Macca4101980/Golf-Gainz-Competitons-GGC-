import React from 'react';
import './roundTotals.css';

function Score({score}){
 return <><strong>{score.text}</strong><small>{score.entered}/{score.total} holes entered{score.entered<score.total?' · in progress':''}</small></>;
}
export function IndividualTotalRows({totals}){
 return totals.windows.map((window,index)=><React.Fragment key={window.id}>
  <div className={`roundTotalLabel ${window.id}`} aria-label={window.label}><b>{window.id==='provisional'?'PROV.':'TOTAL'}</b><small>{window.id==='provisional'?window.label.split('· ')[1]:window.indexes.length===9?(window.indexes[0]===9?'10–18':'1–9'):`1–${window.indexes.length}`}</small></div>
  {totals.individuals.map(player=><div className={`roundTotalCell ${window.id}`} key={player.id} aria-label={`${player.name} ${window.label}`}><Score score={player.scores[index]}/></div>)}
 </React.Fragment>);
}
export function TeamRoundTotals({totals}){
 if(!totals.teams.length)return null;
 return <section className="roundTeamTotals" aria-label="Team score totals"><h3>TEAM TOTALS</h3>
  {totals.league&&<p>Fixed League teams · includes saved partner cards from other playing groups.</p>}
  {totals.teams.map(team=><div className="roundTeamTotal" key={team.id}><div className="roundTeamNames"><b>{team.name}</b><small>{team.memberLine}</small></div>
   <div className="roundTeamWindows">{totals.windows.map((window,index)=><div key={window.id}><b>{window.label}</b><Score score={team.scores[index]}/></div>)}</div>
  </div>)}
 </section>;
}
