import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {planRecordChanges} from '../src/recordChanges.js';
import {toRecordSnapshot,mergeRecordSnapshotIntoAppState} from '../src/recordModel.js';

const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const groups=fs.readFileSync(new URL('../src/GroupScoreScreen.jsx',import.meta.url),'utf8');
const leagues=fs.readFileSync(new URL('../src/CompetitionGroups.jsx',import.meta.url),'utf8');

test('an explicitly removed scorecard produces a persistent card tombstone',()=>{
 const card={id:'card-1',compId:'comp-1',playerId:'p1'};
 const changes=planRecordChanges({cards:[card]},{cards:[],deletedCardIds:['card-1']});
 assert.deepEqual(changes,[{kind:'cards',id:'card-1',data:card,deleted:true}]);
});

test('deleting a competition also tombstones attached cards for older clients',()=>{
 const card={id:'card-1',compId:'comp-1',playerId:'p1'};
 const changes=planRecordChanges({cards:[card],comps:[{id:'comp-1'}]},{cards:[],comps:[],deletedCompIds:['comp-1']});
 assert.deepEqual(changes.map(({kind,id,deleted})=>({kind,id,deleted})),[
  {kind:'comps',id:'comp-1',deleted:true},
  {kind:'cards',id:'card-1',deleted:true},
 ]);
});

test('card tombstone metadata survives snapshot translation and live merge',()=>{
 const records=toRecordSnapshot({cards:[],deletedCardIds:['card-1']});
 assert.deepEqual(records.deletedCardIds,['card-1']);
 const merged=mergeRecordSnapshotIntoAppState({cards:[],deletedCardIds:['card-1']},{cards:[{id:'card-1'}]});
 assert.deepEqual(merged.deletedCardIds,['card-1']);
 assert.deepEqual(merged.cards,[{id:'card-1'}]);
});

test('every scorecard removal path records card tombstones',()=>{
 assert.match(main,/deleteAdminRound[\s\S]*?deletedCardIds/);
 assert.match(main,/RESTART GROUP ROUND[\s\S]*?deletedCardIds|deletedCardIds[\s\S]*?RESTART GROUP ROUND/);
 assert.match(main,/removedCards=scoringChanged&&hasScores[\s\S]*?deletedCardIds/);
 assert.match(groups,/restart\(\)[\s\S]*?deletedCardIds/);
 assert.match(leagues,/deletePlaceholder[\s\S]*?deletedCardIds/);
 assert.match(leagues,/deleteLeague[\s\S]*?deletedCardIds/);
});
