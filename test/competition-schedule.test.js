import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addCalendarDays,defaultCompetitionEnd,competitionEndForEdit,shiftCompetitionEnd} from '../src/competitionSchedule.js';
import {leagueCompetitionLifecycle} from '../src/winterLeague.js';
process.env.TZ='Europe/London';
const week1={status:'scheduled',starts:'2026-10-16T05:00:00.000Z',ends:'2026-10-23T17:00:00.000Z',days:7};
test('editing unrelated fields preserves Week 1 Friday 18:00 deadline',()=>{
 const ends=competitionEndForEdit({existing:week1,starts:week1.starts,days:7,league:true});
 assert.equal(ends.toISOString(),week1.ends);
 assert.equal(leagueCompetitionLifecycle({...week1,ends:ends.toISOString()},new Date('2026-10-23T16:59:59Z')),'live');
 assert.equal(leagueCompetitionLifecycle({...week1,ends:ends.toISOString()},new Date('2026-10-23T17:00:00Z')),'closed');
});
test('new seven-calendar-day League week closes Friday at 18:00',()=>{
 assert.equal(defaultCompetitionEnd('2026-10-31T06:00:00Z',7,{league:true}).toISOString(),'2026-11-06T18:00:00.000Z');
});
test('League deadlines preserve 18:00 across autumn and spring clock changes',()=>{
 assert.equal(defaultCompetitionEnd('2026-10-24T05:00:00Z',7,{league:true}).toISOString(),'2026-10-30T18:00:00.000Z');
 assert.equal(defaultCompetitionEnd('2027-03-27T06:00:00Z',7,{league:true}).toISOString(),'2027-04-02T17:00:00.000Z');
 assert.equal(addCalendarDays('2026-10-24T05:00:00Z',7).toISOString(),'2026-10-31T06:00:00.000Z');
});
test('ordinary competitions retain duration semantics and custom deadlines',()=>{
 assert.equal(defaultCompetitionEnd('2026-11-01T10:00:00Z',1).toISOString(),'2026-11-02T10:00:00.000Z');
 assert.equal(competitionEndForEdit({existing:week1,starts:week1.starts,days:7,explicitEnd:'2026-10-23T19:30'}).toISOString(),'2026-10-23T18:30:00.000Z');
});
test('moving or extending a competition retains its chosen closing clock time',()=>{
 assert.equal(shiftCompetitionEnd(week1.ends,week1.starts,'2026-10-24T05:00:00Z').toISOString(),'2026-10-31T18:00:00.000Z');
 assert.equal(competitionEndForEdit({existing:week1,starts:week1.starts,days:8}).toISOString(),'2026-10-24T17:00:00.000Z');
});
test('manual completion and cancellation remain authoritative',()=>{
 for(const [status,expected] of [['completed','closed'],['cancelled','cancelled'],['draft','draft']])assert.equal(leagueCompetitionLifecycle({...week1,status},new Date('2026-10-20T12:00Z')),expected);
});
test('both editing paths use the saved deadline and batch creation uses calendar helper',()=>{
 const schedule=readFileSync(new URL('../src/CompetitionGroups.jsx',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(schedule,/ends=toIso\(draft.ends\)/);
 assert.match(schedule,/aria-label="Entry closes"/);
 assert.match(main,/competitionEndForEdit\(\{existing:liveExisting/);
 assert.match(main,/defaultCompetitionEnd\(st,duration,\{league:true\}\)/);
 assert.doesNotMatch(main,/starts.getTime\(\)\+duration\*24/);
});
