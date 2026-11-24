import test from'node:test';
import assert from'node:assert/strict';
import{buildMatchplayRecord,currentMatchplayRecord,editMatchplayRecord,fixtureCompetitionPreset,isMatchplaySeries,matchplayHandicapSettings,matchplaySeries,standardLeagues}from'../src/matchplaySeriesModel.js';

const teams=[
 {id:'t1',name:'Team One',memberIds:['p1','p2']},
 {id:'t2',name:'Team Two',memberIds:['p3','p4']},
 {id:'t3',name:'Team Three',memberIds:['p5','p6']},
 {id:'t4',name:'Team Four',memberIds:['p7','p8']}
];
const league={id:'wl',name:'Winter League',societyId:'g1',teams,oomSettings:{bestCount:0},startingHandicaps:{p1:7.6,p2:12,p3:18,p4:20,p5:5,p6:9,p7:14,p8:22}};
const players=teams.flatMap(team=>team.memberIds.map(id=>({id,name:id,hi:10})));

function leagueState({releaseAt='2027-01-10T18:00:00Z'}={}){
 return{players,cards:[],courses:[],societies:[{id:'g1'}],leagues:[league],comps:[
  {id:'week-1',leagueId:'wl',name:'Week 1',starts:'2027-01-01T08:00:00Z',ends:'2027-01-02T18:00:00Z',status:'completed',historicalTeamScores:{t1:40,t2:38,t3:36,t4:34}},
  {id:'week-2',leagueId:'wl',name:'Week 2',starts:'2027-01-08T08:00:00Z',ends:'2027-01-09T18:00:00Z',status:'completed',historicalTeamScores:{t1:30,t2:32,t3:45,t4:44},resultsEmbargo:{enabled:true,provisionalAt:'2027-01-08T08:00:00Z',releaseAt}}
 ]};
}

test('matchplay records share League persistence but stay out of normal League screens',()=>{
 const record=buildMatchplayRecord({id:'cup',name:'Club Cup',societyId:'g1',entrants:teams,entrantType:'team',createdAt:'2027-01-01T12:00:00Z'}),state={leagues:[league,record]};
 assert.equal(record.recordType,'matchplay-series');
 assert.equal(isMatchplaySeries(record),record.matchplay);
 assert.deepEqual(standardLeagues(state).map(item=>item.id),['wl']);
 assert.deepEqual(matchplaySeries(state).map(item=>item.id),['cup']);
});

test('a League playoff stays forecasted and unscoreable until final results are released',()=>{
 const state=leagueState(),createdAt='2027-01-09T19:00:00Z';
 const record=buildMatchplayRecord({id:'playoff',name:'Winter Playoffs',societyId:'g1',mode:'playoff',sourceLeague:league,playoffSize:4,createdAt,state});
 assert.equal(record.matchplay.qualificationStatus,'forecasted');
 assert.ok(record.matchplay.fixtures.every(fixture=>fixture.status==='forecasted'));
 const before=currentMatchplayRecord(record,{...state,leagues:[league,record]},new Date('2027-01-10T17:59:59Z'));
 assert.equal(before.matchplay.qualificationStatus,'forecasted');
 assert.ok(before.matchplay.fixtures.every(fixture=>fixture.status==='forecasted'));
});

test('a forecast playoff uses the same provisional positions shown in the live League table',()=>{
 const state=leagueState(),createdAt='2027-01-09T19:00:00Z';
 const record=buildMatchplayRecord({id:'live-playoff',name:'Live Playoffs',societyId:'g1',mode:'playoff',sourceLeague:league,playoffSize:4,createdAt,state});
 const firstRound=record.matchplay.fixtures.filter(fixture=>fixture.round===1);
 assert.deepEqual(firstRound.map(fixture=>[fixture.entrantAId,fixture.entrantBId]),[['t3','t2'],['t4','t1']]);
 assert.ok(firstRound.every(fixture=>fixture.status==='forecasted'));
});

test('final release qualifies and locks the League playoff seeding',()=>{
 const state=leagueState(),createdAt='2027-01-09T19:00:00Z';
 const record=buildMatchplayRecord({id:'playoff-lock',name:'Winter Playoffs',societyId:'g1',mode:'playoff',sourceLeague:league,playoffSize:4,createdAt,state});
 const qualified=currentMatchplayRecord(record,{...state,leagues:[league,record]},new Date('2027-01-10T18:00:01Z'));
 assert.equal(qualified.matchplay.qualificationStatus,'qualified');
 assert.ok(qualified.matchplay.fixtures.filter(fixture=>fixture.round===1).every(fixture=>fixture.status==='scheduled'));
 assert.deepEqual(qualified.matchplay.fixtures.filter(fixture=>fixture.round===1).map(fixture=>[fixture.entrantAId,fixture.entrantBId]),[['t3','t1'],['t4','t2']]);

 const corrected={...state,comps:state.comps.map(comp=>comp.id==='week-2'?{...comp,historicalTeamScores:{t1:60,t2:32,t3:20,t4:10}}:comp),leagues:[league,qualified]};
 assert.equal(currentMatchplayRecord(qualified,corrected,new Date('2027-01-11T12:00:00Z')),qualified);
});

test('standalone structures are wrapped as versioned matchplay series records',()=>{
 const entrants=teams.slice(0,4),base={name:'Series',societyId:'g1',entrants,entrantType:'team',createdAt:'2027-01-01T12:00:00Z'};
 const knockout=buildMatchplayRecord({...base,id:'ko',mode:'knockout'});
 const leagueSeries=buildMatchplayRecord({...base,id:'rr',mode:'round-robin',points:{winPoints:3,drawPoints:1,lossPoints:0}});
 const groups=buildMatchplayRecord({...base,id:'groups',mode:'group-stage',groupCount:2,qualifiersPerGroup:1});
 assert.deepEqual([knockout.matchplay.type,leagueSeries.matchplay.type,groups.matchplay.type],['knockout','round-robin','group-stage']);
 assert.ok([knockout,leagueSeries,groups].every(record=>record.recordType==='matchplay-series'&&record.societyId==='g1'));
});

test('a fixture creates a linked GGC scorecard preset',()=>{
 const record=buildMatchplayRecord({id:'scorecard-series',name:'Club Cup',societyId:'g1',entrants:teams.slice(0,2),entrantType:'team',createdAt:'2027-01-01T12:00:00Z'}),fixture=record.matchplay.fixtures[0];
 const preset=fixtureCompetitionPreset(record,fixture);
 assert.deepEqual({format:preset.format,entries:preset.entries,pairs:preset.pairs.map(pair=>pair.id),series:preset.matchplaySeriesId,fixture:preset.matchplayFixtureId},{format:'fourball-match',entries:['p1','p2','p3','p4'],pairs:['t1','t2'],series:'scorecard-series',fixture:fixture.id});
});

test('a linked playoff returns to the competition-start handicap snapshot without Winter League cuts',()=>{
 const state=leagueState({releaseAt:'2027-01-09T18:00:00Z'}),createdAt='2027-01-10T19:00:00Z';
 const record=buildMatchplayRecord({id:'handicap-playoff',name:'Winter Playoffs',societyId:'g1',mode:'playoff',sourceLeague:league,playoffSize:4,createdAt,state});
 const fixture=record.matchplay.fixtures.find(item=>item.round===1),settings=matchplayHandicapSettings(record,{...state,leagues:[league,record]}),preset=fixtureCompetitionPreset(record,fixture,{...state,leagues:[league,record]});
 assert.equal(settings.source,'competition-start');
 assert.equal(settings.allowance,90);
 assert.equal(settings.adjustmentMode,'none');
 assert.equal(settings.excludeLeagueAdjustments,true);
 assert.deepEqual(preset.handicapSnapshot,league.startingHandicaps);
 assert.equal(preset.excludeLeagueAdjustments,true);
 assert.equal(preset.handicapAllowance,90);
});

test('forecast playoff settings can be edited but handicap rules lock after a scorecard exists',()=>{
 const state=leagueState(),createdAt='2027-01-09T19:00:00Z';
 const record=buildMatchplayRecord({id:'editable-playoff',name:'Knockouts',societyId:'g1',mode:'playoff',sourceLeague:league,playoffSize:4,createdAt,state});
 const edited=editMatchplayRecord(record,{...state,leagues:[league,record]},{name:'Final Four',playoffSize:2,handicapSource:'competition-end',handicapAllowance:95,handicapAdjustmentMode:'league-final'});
 assert.equal(edited.name,'Final Four');
 assert.equal(edited.matchplay.qualificationSize,2);
 assert.equal(edited.handicapSettings.allowance,95);
 assert.equal(edited.handicapSettings.adjustmentMode,'league-final');
 assert.equal(edited.handicapSettings.source,'competition-end');
 const settings=matchplayHandicapSettings(edited,{...state,leagues:[league,edited]});
 assert.equal(settings.adjustments.p1,-1);
 assert.equal(settings.adjustments.p5,0);
 assert.throws(()=>editMatchplayRecord(edited,{...state,leagues:[league,edited],comps:[{id:'ko-card',matchplaySeriesId:edited.id}]},{handicapAllowance:90}),/locked/);
 assert.throws(()=>editMatchplayRecord(edited,{...state,leagues:[league,edited],comps:[{id:'ko-card',matchplaySeriesId:edited.id}]},{handicapAdjustmentMode:'none'}),/locked/);
});
