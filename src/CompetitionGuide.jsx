import React,{useMemo,useState}from'react';

const categoryOrder=['Individual','Pairs','Group'];

export default function CompetitionGuide({formats,rules}){
 const[query,setQuery]=useState('');
 const grouped=useMemo(()=>{
  const seen=new Set(),needle=query.trim().toLowerCase();
  return categoryOrder.map(category=>({category,items:formats.filter(format=>{
   if(format[4]!==category)return false;
   const key=`${category}:${format[1]}`;
   if(seen.has(key))return false;
   seen.add(key);
   const rule=rules[format[0]]||{};
   return !needle||[format[1],format[2],rule.description,rule.entry,rule.result].some(value=>String(value||'').toLowerCase().includes(needle));
  })})).filter(group=>group.items.length);
 },[formats,rules,query]);
 return <div className="formatGuide">
  <div className="formatGuideIntro"><span>⛳</span><div><b>Competition formats and scoring</b><p>Choose a format to see how it is played, what you enter and how the winner is decided.</p></div></div>
  <label className="formatGuideSearch">Find a format<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Try Stableford, Scramble or Matchplay"/></label>
  {grouped.length?grouped.map(group=><section className="formatGuideGroup" key={group.category}><h3>{group.category.toUpperCase()} FORMATS <small>{group.items.length}</small></h3>{group.items.map(format=><FormatItem key={format[0]} format={format} rule={rules[format[0]]||{}}/>)}</section>):<p className="formatGuideEmpty">No competition formats match that search.</p>}
  <section className="golfBasics">
   <h3>GOLF SCORING — THE BASICS</h3>
   <Basic title="Stroke Play / Medal" text="Count every stroke taken. Gross is the actual total; nett is the total after the Playing Handicap is applied. The lowest score wins."/>
   <Basic title="Stableford" text="Score points on each hole from your nett score: normally 2 for nett par, 3 for nett birdie and 1 for nett bogey. A worse hole can score zero without ruining the whole round. Highest total wins."/>
   <Basic title="Matchplay" text="Play against an opponent hole by hole. Win a hole to go one up, lose it to go one down, or halve it. The match ends when the lead is greater than the holes remaining."/>
   <Basic title="Handicaps" text="Your Handicap Index is converted for the course and tees, then the competition allowance gives your Playing Handicap. Shot dots show where handicap strokes are received; GGC calculates these automatically."/>
   <Basic title="Gross, nett, par and stroke index" text="Gross is the strokes actually taken. Nett is gross after handicap strokes. Par is the target score for the hole. Stroke Index (SI) decides the order in which handicap shots are received."/>
  </section>
 </div>
}

function FormatItem({format,rule}){
 const allowance=Number.isFinite(rule.defaultAllowance)?`${rule.defaultAllowance}% typical allowance`:'Allowance set by the organiser';
 return <details className="formatGuideItem"><summary><span><b>{format[1]}</b><small>{format[2]}</small></span><em>›</em></summary><div><p>{rule.description&&rule.description!==format[2]?rule.description:format[2]}</p><dl><dt>Score entry</dt><dd>{rule.entry||'Follow the score entry shown on the live card.'}</dd><dt>Result</dt><dd>{rule.result||'GGC calculates the result from the selected competition settings.'}</dd><dt>Handicap</dt><dd>{allowance}. The organiser can confirm or change the allowance when setting up the competition.</dd></dl></div></details>
}
function Basic({title,text}){return <details className="golfBasic"><summary>{title}<em>›</em></summary><p>{text}</p></details>}
