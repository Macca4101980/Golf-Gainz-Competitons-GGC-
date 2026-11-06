import test from 'node:test';
import assert from 'node:assert/strict';
import {competitionManagementSections} from '../src/managementNavigation.js';

test('each accessible competition appears at exactly one management destination',()=>{
 const state={leagues:[{id:'league',societyId:'a',name:'League'}],comps:[{id:'solo',societyId:'a'},{id:'week1',societyId:'a',leagueId:'league'},{id:'week2',societyId:'a',leagueId:'league'},{id:'orphan',societyId:'a',leagueId:'missing'},{id:'other',societyId:'b'},{id:'deleted',societyId:'a',status:'deleted'}]};
 const before=JSON.stringify(state),result=competitionManagementSections(state,'a');
 assert.deepEqual(result.standalone.map(c=>c.id),['solo','orphan']);
 assert.deepEqual(result.leagues[0].competitions.map(c=>c.id),['week1','week2']);
 const ids=[...result.standalone,...result.leagues.flatMap(l=>l.competitions)].map(c=>c.id);
 assert.equal(ids.length,new Set(ids).size);assert.equal(ids.length,4);
 assert.equal(JSON.stringify(state),before);
});

test('deleted or cross-group league references cannot hide a competition',()=>{
 const result=competitionManagementSections({leagues:[{id:'gone',societyId:'a'},{id:'foreign',societyId:'b'}],deletedLeagueIds:['gone'],comps:[{id:'one',societyId:'a',leagueId:'gone'},{id:'two',societyId:'a',leagueId:'foreign'},{id:'tombstone',societyId:'a'}],deletedCompIds:['tombstone']},'a');
 assert.deepEqual(result.standalone.map(c=>c.id),['one','two']);assert.deepEqual(result.leagues,[]);
});

test('an empty league stays reachable and empty states are safe',()=>{
 assert.deepEqual(competitionManagementSections({},'a'),{standalone:[],leagues:[]});
 const r=competitionManagementSections({leagues:[{id:'empty',societyId:'a'}]},'a');
 assert.equal(r.leagues[0].league.id,'empty');assert.deepEqual(r.leagues[0].competitions,[]);
});
