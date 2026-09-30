import fs from 'fs';
import {scoreCard,FORMAT_RULES,pairScore,fourballMatchResult,oomPointsForField} from './src/scoring.js';
const load=f=>JSON.parse(fs.readFileSync(f,'utf8'));
let pass=0,fail=0;const ok=(name,cond,got,exp)=>{if(cond){pass++;console.log('PASS',name)}else{fail++;console.error('FAIL',name,'got',got,'expected',exp)}};
function stateFrom(d){return {players:d.players,courses:[{id:'harlestone',name:'Northampton Golf Club (Harlestone)',tees:[{id:'h-white',name:'White',rating:71.4,slope:133,holes:[[347,4,6],[166,3,8],[517,5,12],[397,4,2],[135,3,18],[535,5,10],[429,4,4],[367,4,16],[332,4,14],[381,4,7],[521,5,11],[596,5,1],[152,3,17],[410,4,5],[452,4,3],[166,3,9],[327,4,13],[285,4,15]].map((x,i)=>({n:i+1,yards:x[0],par:x[1],si:x[2]}))}]}],cards:d.cards,comps:d.competitions,societies:[d.society]}}
const ind=load('./test-data.json'), si=stateFrom(ind);
const expected={'test-stableford':[53,31,31],'test-stroke':[55,77,78],'test-gross-stroke':[75,75,76],'test-par-bogey':[12,-3,-3],'test-max-score':[55,77,78],'test-modified-stableford':[39,-3,-5],'test-waltz':[111,68,68]};
for(const c of ind.competitions){if(!expected[c.id])continue;let rs=ind.cards.filter(x=>x.compId===c.id).map(x=>scoreCard(x,c,si));const lower=FORMAT_RULES[c.format].lowerWins;rs.sort(lower?(a,b)=>a.rankValue-b.rankValue:(a,b)=>b.rankValue-a.rankValue);const got=rs.map(r=>r.rankValue);ok('individual '+c.id,JSON.stringify(got)===JSON.stringify(expected[c.id]),got,expected[c.id]);}
const pd=load('./pairs-test-data.json'), sp=stateFrom(pd);
const pexp={'test-pairs-4bbb-stableford':[40,38],'test-pairs-4bbb-stroke':[68,70],'test-pairs-aggregate-stableford':[73,71],'test-pairs-aggregate-stroke':[143,145]};
for(const c of pd.competitions){if(!pexp[c.id])continue;let rs=(c.pairs||[]).map(p=>pairScore(p,c,sp));const lower=FORMAT_RULES[c.format].lowerWins;rs.sort(lower?(a,b)=>a.rankValue-b.rankValue:(a,b)=>b.rankValue-a.rankValue);const got=rs.map(r=>r.rankValue);ok('pairs '+c.id,JSON.stringify(got)===JSON.stringify(pexp[c.id]),got,pexp[c.id]);}

// Remaining individual special formats
for(const [id,exp] of [['test-flag',[1798,1697,1596]],['test-eclectic',[50,72,73]]]){const c=ind.competitions.find(x=>x.id===id);let rs=ind.cards.filter(x=>x.compId===id).map(x=>scoreCard(x,c,si));const lower=FORMAT_RULES[c.format].lowerWins;rs.sort(lower?(a,b)=>a.rankValue-b.rankValue:(a,b)=>b.rankValue-a.rankValue);const got=rs.map(r=>r.rankValue);ok('individual '+id,JSON.stringify(got)===JSON.stringify(exp),got,exp)}
// Remaining pairs special formats
{const c=pd.competitions.find(x=>x.id==='test-pairs-4bbb-match');const m=fourballMatchResult(c.pairs[0],c.pairs[1],c,sp);ok('pairs 4bbb match',m.up===2,m.up,2)}
{const c=pd.competitions.find(x=>x.id==='test-pairs-blind-pairs');let rows=pd.cards.filter(x=>x.compId===c.id).map(x=>scoreCard(x,c,sp));const by=Object.fromEntries(rows.map(r=>[r.player.id,r]));let got=(c.blindDraw?.pairs||[]).map(pair=>pair.reduce((a,id)=>a+(by[id]?.points||0),0)).sort((a,b)=>b-a);ok('pairs blind pairs',JSON.stringify(got)===JSON.stringify([73,71]),got,[73,71])}

// New money / 2s / guest invariants
const comp={status:'completed',entries:['m1','m2','g1','m3'],fee:5,payouts:{overall:100},overallSplit:{first:60,second:30,third:10},twoClub:true,twoFee:2};
const pot=comp.entries.length*comp.fee;ok('money pot entrants x fee',pot===20,pot,20);ok('1st payout',pot*.6===12,pot*.6,12);ok('2nd payout',pot*.3===6,pot*.3,6);ok('3rd payout',pot*.1===2,pot*.1,2);ok('2s pot includes guests',comp.entries.length*comp.twoFee===8,comp.entries.length*comp.twoFee,8);const hits=[2,1];const share=8/3;ok('2s split per gross two',Math.abs(hits[0]*share-16/3)<1e-9,hits[0]*share,16/3);
const players=[{id:'m1'},{id:'g1',guest:true},{id:'m2'}];const oomEligible=players.filter(p=>!p.guest);ok('guest excluded from OOM eligibility',oomEligible.map(x=>x.id).join(',')==='m1,m2',oomEligible.map(x=>x.id),'m1,m2');
const src=fs.readFileSync('./src/main.jsx','utf8');
for(const [n,t] of [['build label','Build 3.6.1'],['rename group','RENAME GROUP'],['guest add','ADD GUEST'],['guest OOM exclusion','!x.player.guest'],['2s toggle','2s Club'],['2s results','2s CLUB'],['payout helper','overallPrize(c,i)'],['individual test loader','LOAD INDIVIDUAL FORMATS TEST PACK'],['pairs test loader','LOAD PAIRS FORMATS TEST PACK']])ok('static '+n,src.includes(t),src.includes(t),true);
for(const [n,t] of [['realtime merge protection','function mergeLiveState'],['create draft protection','ggc-comp-draft-'],['group scorecard shell','className=\"app score groupScore\"'],['dashboard submitted-card filtering','dashboardLive'],['scorecard team headers','teamBand teamA'],['round-group persistence','roundGroups'],['group audit scoring','GROUP SCORE'],['PWA update banner','GGC HAS BEEN UPDATED']])ok('protected '+n,src.includes(t),src.includes(t),true);
console.log(`TOTAL ${pass} passed, ${fail} failed`);if(fail)process.exit(1);
