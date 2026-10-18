import test from 'node:test';
import assert from 'node:assert/strict';
import {planCompetitionSnapshots} from '../src/competitionCourse.js';
const holes=Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1}));
const course={id:'course1',tees:[{name:'White',rating:71.4,slope:125,holes}]};
test('plan snapshots without modifying competitions',()=>{const comps=[{id:'c1',course:'course1',tee:'White'}];const plan=planCompetitionSnapshots(comps,[course]);assert.equal(plan.updates.length,1);assert.equal(plan.blocked.length,0);assert.equal(comps[0].courseSnapshot,undefined)});
test('reject incomplete metadata',()=>{const plan=planCompetitionSnapshots([{id:'c1',course:'missing',tee:'White'}],[course]);assert.deepEqual(plan.blocked,['c1'])});
