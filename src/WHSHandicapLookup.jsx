import React,{useEffect,useState}from'react';

export default function WHSHandicapLookup({token,onApply}){
 const[configured,setConfigured]=useState(false),[membershipNumber,setMembershipNumber]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[golfer,setGolfer]=useState(null),[applied,setApplied]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/whs-handicap',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(active)setConfigured(data?.configured===true)}).catch(()=>{});return()=>{active=false}},[]);
 if(!configured)return null;
 async function lookup(){
  setBusy(true);setError('');setGolfer(null);setApplied(false);
  try{const response=await fetch('/api/whs-handicap',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({membershipNumber})});const data=await response.json().catch(()=>null);if(!response.ok)throw Error(data?.error||'Handicap lookup failed.');setGolfer(data.golfer)}catch(e){setError(e?.message||'Handicap lookup failed.')}finally{setBusy(false)}
 }
 async function apply(){setBusy(true);setError('');try{await onApply(golfer);setApplied(true)}catch(e){setError(e?.message||'The handicap was found but could not be saved.')}finally{setBusy(false)}}
 return <div className="whsLookup"><h3>ENGLAND GOLF HANDICAP</h3><p className="muted">Read-only lookup. GGC cannot change your WHS record.</p><label>Membership number (formerly CDH)<input inputMode="numeric" autoComplete="off" maxLength={10} value={membershipNumber} onChange={e=>setMembershipNumber(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="10-digit number"/></label><button className="secondary" disabled={busy||membershipNumber.length!==10||!token} onClick={lookup}>{busy?'CHECKING…':'CHECK OFFICIAL HANDICAP'}</button>{golfer&&<div className="whsResult"><span><b>{golfer.displayName||'England Golf member'}</b><small>{golfer.homeClub||'Home club not supplied'} · membership ending {golfer.membershipNumberLast4}</small></span><strong>HI {Number(golfer.handicapIndex).toFixed(1)}</strong><button className="primary" disabled={busy||applied} onClick={apply}>{applied?'HANDICAP UPDATED':'USE THIS HANDICAP'}</button></div>}{error&&<small className="autherror" role="alert">{error}</small>}</div>;
}
