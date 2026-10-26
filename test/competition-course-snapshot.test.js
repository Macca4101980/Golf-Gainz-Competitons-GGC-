import test from'node:test';
import assert from'node:assert/strict';
import{buildCourseSnapshot,competitionCourse}from'../src/competitionCourse.js';
import{scoreCard}from'../src/scoring.js';

const holes=Array.from({length:18},(_,i)=>({n:i+1,par:i===1?3:4,si:i+1,yards:300+i}));
const ownerCourse={id:'owner-course',name:'Northampton',tees:[{id:'green',name:'Green',slope:125,rating:68.7,holes}]};
const comp={id:'comp',course:'owner-course',tee:'Green',format:'stableford',holesMode:'18',handicapAllowance:95,courseSnapshot:buildCourseSnapshot(ownerCourse,'Green')};
const player={id:'member',name:'Member',hi:18};
const card={id:'card',compId:'comp',playerId:'member',courseId:'owner-course',tee:'Green',gross:Array(18).fill(4)};

test('member can resolve all competition holes without access to owner course library',()=>{
 const resolved=competitionCourse(comp,{courses:[]});
 assert.equal(resolved.fromSnapshot,true);
 assert.equal(resolved.course.name,'Northampton');
 assert.equal(resolved.tee.name,'Green');
 assert.equal(resolved.holes.length,18);
 assert.equal(resolved.tee.slope,125);
});

test('score calculation uses the immutable competition snapshot',()=>{
 const state={players:[player],courses:[],cards:[card]};
 const result=scoreCard(card,comp,state);
 assert.equal(result.holes.length,18);
 assert.equal(result.complete,18);
 assert.ok(Number.isFinite(result.points));
});

test('later course-library edits do not change the competition snapshot',()=>{
 const changed={...ownerCourse,name:'Changed course',tees:[{...ownerCourse.tees[0],slope:155,holes:holes.map(h=>({...h,par:5}))}]};
 const resolved=competitionCourse(comp,{courses:[changed]});
 assert.equal(resolved.course.name,'Northampton');
 assert.equal(resolved.tee.slope,125);
 assert.equal(resolved.holes[0].par,4);
});

test('legacy competitions still fall back to their visible course record',()=>{
 const legacy={...comp,courseSnapshot:undefined};
 const resolved=competitionCourse(legacy,{courses:[ownerCourse]});
 assert.equal(resolved.fromSnapshot,false);
 assert.equal(resolved.holes.length,18);
});
