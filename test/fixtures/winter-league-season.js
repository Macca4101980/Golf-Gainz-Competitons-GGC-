// Dedicated synthetic season. No real golfer/league records are changed.
export function winterLeagueSeasonFixture(){
 const prefix='qa-wl-20261020';
 const groupId=prefix+'-group',leagueId=prefix+'-league',courseId=prefix+'-course';
 const players=['a','b','c','d','e','f','g','h'].map((x,i)=>({id:prefix+'-'+x,name:'QA Golfer '+x.toUpperCase(),hi:i<2||i===4||i===5?10:0,unclaimed:true,placeholder:true}));
 const names=['QA Solo','QA Better Ball','QA No Recovery','QA Level Par'];
 const teams=names.map((name,i)=>({id:prefix+'-team-'+i,name,memberIds:players.slice(i*2,i*2+2).map(p=>p.id),badgeImage:'/golf-gain-icon-v5.png'}));
 const group={id:groupId,name:'QA Winter League regression',code:'QA-WL-20261020',ownerId:'5630395f-6cea-4109-9bac-e8f4bae34dfd',admins:['5630395f-6cea-4109-9bac-e8f4bae34dfd','b3a16302-19ac-4efc-b780-1ba4e6bc39ba'],members:[...players.map(p=>p.id),'b3a16302-19ac-4efc-b780-1ba4e6bc39ba','5630395f-6cea-4109-9bac-e8f4bae34dfd']};
 const league={id:leagueId,name:'QA Winter League regression',societyId:groupId,teams,memberIds:players.map(p=>p.id),startingHandicaps:Object.fromEntries(players.map(p=>[p.id,p.hi])),targetCompetitions:10,handicapSettings:{mode:'team',allowance:90,bestCount:8,target:36,cutPerPoint:.5,direction:'down',teamAdjustment:'split',lockStartingHandicaps:true},moneySettings:{entryFee:12,twosFee:8,weeklyPrizePerPlayer:2,finalFirst:60}};
 const course={id:courseId,name:'QA Par 72',tees:[{name:'Green',slope:113,rating:72,holes:Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1,yards:350}))}]};
 const comps=Array.from({length:10},(_,i)=>({id:prefix+'-w'+(i+1),name:'QA Week '+(i+1),societyId:groupId,leagueId,course:courseId,tee:'Green',format:'stableford',handicapAllowance:90,holesMode:'18',status:i===3?'cancelled':'completed',starts:new Date(Date.UTC(2026,0,1+i*7,8)).toISOString(),ends:new Date(Date.UTC(2026,0,7+i*7,18)).toISOString(),entries:players.map(p=>p.id),pairs:teams.map(t=>({id:t.id,ids:t.memberIds,name:t.name})),fee:0}));
 const cards=comps.flatMap((c,w)=>[0,2,3,4,6].map(i=>({id:c.id+'-card-'+i,societyId:groupId,compId:c.id,playerId:players[i].id,gross:Array.from({length:18},(_,h)=>i===0||i===6?4:i===4?(w===9&&h<2?2:6):(i===2?(h%2?5:3):(h%2?3:5))),handicapIndexUsed:players[i].hi,submitted:true,submittedAt:new Date(Date.parse(c.starts)+(i===3?2:0)*86400000).toISOString(),playedAt:new Date(Date.parse(c.starts)+(i===3?2:0)*86400000).toISOString()})));
 return {league,state:{players,societies:[group],leagues:[league],courses:[course],comps,cards}};
}
