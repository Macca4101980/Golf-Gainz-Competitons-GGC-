import test from 'node:test';
import assert from 'node:assert/strict';
import {planV4ScorecardMigration} from '../scripts/v4-scorecard-migration-plan.mjs';
const state={players:[{id:'p1'},{id:'p2'}],societies:[{id:'g1'},{id:'teat'}],comps:[{id:'c1',societyId:'g1'},{id:'ct',societyId:'teat'}],cards:[{id:'a',compId:'c1',societyId:'g1',playerId:'p1',gross:[4]},{id:'t',compId:'ct',societyId:'teat',playerId:'p2'}]};
test('scopes migrated cards and excludes explicitly removed test group',()=>{
 const plan=planV4ScorecardMigration(state,{excludedGroupIds:['teat']});
 assert.equal(plan.ready,true);assert.deepEqual(plan.scope,[{comp_id:'c1',group_id:'g1'}]);
 assert.deepEqual(plan.cards.map(c=>[c.id,c.revision]),[['a',1]]);
 assert.deepEqual(plan.excludedCards,['t']);
});
test('blocks orphan golfer, mismatched competition and duplicate card IDs',()=>{
 const bad=structuredClone(state);
 bad.cards.push({id:'a',compId:'c1',societyId:'g1',playerId:'p1'});
 bad.cards.push({id:'bad',compId:'c1',societyId:'teat',playerId:'p1'});
 bad.cards.push({id:'missing',compId:'c1',societyId:'g1',playerId:'unknown'});
 const plan=planV4ScorecardMigration(bad);
 assert.equal(plan.ready,false);
 assert.ok(plan.issues.some(x=>x.type==='missing_or_duplicate_card_id'));
 assert.ok(plan.issues.some(x=>x.type==='card_competition_scope_mismatch'));
 assert.ok(plan.issues.some(x=>x.type==='card_missing_golfer'));
});
test('rejects competitions referring to absent groups',()=>{
 const bad=structuredClone(state);bad.comps.push({id:'orphan',societyId:'none'});
 assert.ok(planV4ScorecardMigration(bad).issues.some(x=>x.type==='competition_missing_group'));
});

test('exclusion cannot hide a card assigned to a different competition',()=>{
 const bad=structuredClone(state);
 bad.cards.push({id:'hidden',compId:'c1',societyId:'teat',playerId:'p1'});
 const plan=planV4ScorecardMigration(bad,{excludedGroupIds:['teat']});
 assert.equal(plan.ready,false);
 assert.ok(plan.issues.some(x=>x.type==='excluded_card_scope_mismatch'));
 assert.ok(!plan.excludedCards.includes('hidden'));
});
test('duplicate competition IDs are rejected even across excluded groups',()=>{
 const bad=structuredClone(state);
 bad.comps.push({id:'c1',societyId:'teat'});
 const plan=planV4ScorecardMigration(bad,{excludedGroupIds:['teat']});
 assert.equal(plan.ready,false);
 assert.ok(plan.issues.some(x=>x.type==='missing_or_duplicate_competition_id'));
});
test('duplicate card IDs cannot be hidden by excluded group',()=>{
 const bad=structuredClone(state);
 bad.cards.push({id:'a',compId:'ct',societyId:'teat',playerId:'p2'});
 const plan=planV4ScorecardMigration(bad,{excludedGroupIds:['teat']});
 assert.equal(plan.ready,false);
 assert.ok(plan.issues.some(x=>x.type==='missing_or_duplicate_card_id'));
});
