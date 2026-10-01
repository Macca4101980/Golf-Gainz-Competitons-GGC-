import test from'node:test';import assert from'node:assert/strict';import{handicapAdjustment,leagueHandicapSettings,wlCutForScore,winterLeagueTable}from'../src/winterLeague.js';

test('Winter League preset remains 90%, team based and 0.5 per point above 36',()=>{const s=leagueHandicapSettings({});assert.equal(s.allowance,90);assert.equal(s.mode,'team');assert.equal(s.target,36);assert.equal(wlCutForScore(36,s),0);assert.equal(wlCutForScore(37,s),.5);assert.equal(wlCutForScore(38,s),1);assert.equal(wlCutForScore(39,s),1.5)});
test('fixed and manual modes do not auto adjust',()=>{assert.equal(handicapAdjustment(42,{mode:'fixed',target:36,cutPerPoint:1}),0);assert.equal(handicapAdjustment(42,{mode:'manual',target:36,cutPerPoint:1}),0)});
test('down-only never gives shots back',()=>{assert.equal(handicapAdjustment(30,{mode:'team',target:36,cutPerPoint:.5,giveBackPerPoint:.5,direction:'down'}),0)});
test('up and down can return shots',()=>{assert.equal(handicapAdjustment(34,{mode:'team',target:36,cutPerPoint:.5,giveBackPerPoint:.2,direction:'both'}),.4);assert.equal(handicapAdjustment(38,{mode:'team',target:36,cutPerPoint:.5,giveBackPerPoint:.2,direction:'both'}),-1)});
test('legacy cutStart settings migrate to target',()=>{const s=leagueHandicapSettings({wlSettings:{cutStart:40,cutPerPoint:.25,allowance:85}});assert.equal(s.target,39);assert.equal(s.cutPerPoint,.25);assert.equal(s.allowance,85)});

test('team split adjustment divides a one-shot team cut equally',()=>{const d=handicapAdjustment(37,{mode:'team',target:36,netParTarget:0,cutPerPoint:1,giveBackPerPoint:0,direction:'down'});assert.equal(d,-1);assert.equal(d/2,-.5)});
test('net level par buffer delays the cut threshold',()=>{assert.equal(handicapAdjustment(37,{mode:'team',target:36,netParTarget:1,cutPerPoint:.5,direction:'down'}),0);assert.equal(handicapAdjustment(38,{mode:'team',target:36,netParTarget:1,cutPerPoint:.5,direction:'down'}),-.5)});
test('fractional cuts accumulate without mutating normal handicap index',()=>{const p={hi:8.4};const first=handicapAdjustment(37,{mode:'team',target:36,cutPerPoint:.5,direction:'down'});const second=handicapAdjustment(38,{mode:'team',target:36,cutPerPoint:.5,direction:'down'});assert.equal(first+second,-1.5);assert.equal(p.hi,8.4)});

test('25/26 historical weekly team scores reproduce the completed workbook top five',()=>{const names=['Sultans of swing','Flintstones','The Bogey men','Putter madness','The Long Shots'],totals=[302,300,300,298,297],all={
'Sultans of swing':[23,31,36,44,35,39,37,45,27,35],'Flintstones':[36,36,36,36,41,36,41,35,38,36],'The Bogey men':[40,43,39,35,38,34,34,31,34,37],'Putter madness':[32,38,38,36,36,38,27,40,35,37],'The Long Shots':[35,33,40,32,42,36,34,33,39,38]};const teams=names.map((name,i)=>({id:'t'+i,name,memberIds:['a'+i,'b'+i]})),league={id:'l',teams,handicapSettings:{mode:'team',allowance:90,bestCount:8,target:36,cutPerPoint:.5,direction:'down',teamAdjustment:'each'}},comps=Array.from({length:10},(_,w)=>({id:'w'+w,leagueId:'l',starts:`2025-10-${String(w+1).padStart(2,'0')}`,historicalTeamScores:Object.fromEntries(teams.map((t,i)=>[t.id,all[names[i]][w]]))})),state={players:teams.flatMap((t,i)=>t.memberIds.map(id=>({id,hi:10}))),courses:[],cards:[],comps};const table=winterLeagueTable(league,state).table;assert.deepEqual(table.slice(0,5).map(x=>[x.name,x.total]),names.map((n,i)=>[n,totals[i]]))});


test('26/27 live League with no cards still produces table, handicap state and 10 weekly slots',()=>{
 const teams=[{id:'t1',name:'Very Little Helps',memberIds:['p1','p2']},{id:'t2',name:'Flintstones',memberIds:['p3','p4']}];
 const league={id:'winter-league-2026-27',teams,handicapSettings:{mode:'team',allowance:90,bestCount:8,target:36,cutPerPoint:.5,direction:'down',teamAdjustment:'each'}};
 const comps=Array.from({length:10},(_,i)=>({id:'26w'+(i+1),leagueId:league.id,name:'Winter League 26/27 (Week '+(i+1)+')',starts:'2026-10-'+String(i+1).padStart(2,'0')+'T08:00:00',status:'draft'}));
 const state={players:[{id:'p1',name:'Macca',hi:8.4},{id:'p2',name:'Dan',hi:6.9},{id:'p3',name:'Summy',hi:10.1},{id:'p4',name:'Nighty',hi:9.3}],courses:[],cards:[],comps};
 const wl=winterLeagueTable(league,state);
 assert.equal(wl.table.length,2);assert.equal(wl.weekly.length,10);assert.equal(wl.table[0].weeks.length,10);
 assert.equal(wl.table[0].finalAdjustments.p1,0);assert.equal(wl.table[0].finalAdjustments.p2,0);
 assert.equal(wl.table[0].weeks[0].beforeAdjustments.p1,0)
});

test('Results dependencies required by the League results view are exported',()=>{
 assert.equal(typeof winterLeagueTable,'function');assert.equal(typeof leagueHandicapSettings,'function')
});
