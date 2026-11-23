import React from 'react';
import {formatInformation} from './formatInformation.js';

export default function FormatRulesPanel({format,rule,label,allowance,competition={},details=false}){
 const info=formatInformation(format,rule,label,allowance,competition);
 const content=<div className="formatInformationCard formatRulesShared">
  <dl>
   <div><dt>PLAYERS</dt><dd>{info.participants}</dd></div>
   <div><dt>HOW IT WORKS</dt><dd>{info.howItWorks}</dd></div>
   <div><dt>SCORE ENTRY</dt><dd>{info.scoreEntry}</dd></div>
   <div><dt>HANDICAP</dt><dd>{info.handicap}</dd></div>
   <div><dt>WINNER</dt><dd>{info.winner}</dd></div>
  </dl>
  {info.note&&<p className="formatInformationNote">{info.note}</p>}
 </div>;
 if(details)return <details className="formatRulesDetails"><summary aria-label={`${info.title} format information`}>ⓘ Format rules</summary>{content}</details>;
 return <div className="card formatInformationCard"><h3>{info.title}</h3>{content}</div>;
}
