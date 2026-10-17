import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotCompetitionCourse,competitionCourse,competitionTee} from '../src/competitionCourse.js';
import {scoreCard} from '../src/scoring.js';
import {groupScore} from '../src/groupScoring.js';

const holes=Array.from({length:18},(_,i)=>({n:i+1,par:i===0?5:4,si:i+1,yards:300+i}));
const personal={id:'harlestone',name:'Northampton',tees:[{name:'Yellow',rating:70.4,slope:127,holes},{name:'White',rating:71.4,slope:133,holes:holes.map(h=>({...h,yards:h.yards+20}))}]};
test('snapshot embeds selected tee and all eighteen holes',()=>{
 const snapshot=snapshotCompetitionCourse(personal,'Yellow');
 assert.equal(snapshot.tees.length,1);assert.equal(snapshot.tees[0].holes.length,18);
 assert.equal(snapshot.tees[0].slope,127);assert.equal(snapshot.tees[0].rating,70.4);
 assert.deepEqual(snapshot.tees[0].holes.map(h=>h.si),Array.from({length:18},(_,i)=>i+1));
});
test('snapshot is independent from source course edits and deletion',()=>{
 const snapshot=snapshotCompetitionCourse(personal,'Yellow');
 const comp={course:'harlestone',tee:'Yellow',courseSnapshot:snapshot};
 const state={courses:[]};
 assert.deepEqual(competitionCourse(comp,state),snapshot);
 assert.equal(competitionTee(comp,state).holes[0].yards,300);
 personal.tees[0].holes[0].yards=999;
 assert.equal(competitionTee(comp,state).holes[0].yards,300);
 personal.tees[0].holes[0].yards=300;
});
test('snapshot is preferred to conflicting local course',()=>{
 const snapshot=snapshotCompetitionCourse(personal,'Yellow');
 const comp={course:'harlestone',tee:'Yellow',courseSnapshot:snapshot};
 const state={courses:[{id:'harlestone',tees:[{name:'Yellow',rating:100,slope:155,holes:[]}]}]};
 assert.equal(competitionTee(comp,state).slope,127);
});
test('incomplete selected tee cannot create snapshot',()=>{
 assert.equal(snapshotCompetitionCourse({tees:[{name:'Yellow',holes:holes.slice(0,9)}]},'Yellow'),null);
});
