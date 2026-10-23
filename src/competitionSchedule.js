// Calendar arithmetic deliberately preserves local wall-clock times across DST.
export function addCalendarDays(value, days) {
 const date=new Date(value);
 date.setDate(date.getDate()+Number(days));
 return date;
}
export function calendarDaySpan(starts,ends) {
 const a=new Date(starts),b=new Date(ends);
 return Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);
}
export function defaultCompetitionEnd(starts,days,{league=false}={}) {
 const end=addCalendarDays(starts,Math.max(1,Number(days)||1)-(league?1:0));
 if(league)end.setHours(18,0,0,0);
 return end;
}
export function shiftCompetitionEnd(ends,oldStart,newStart) {
 return addCalendarDays(ends,calendarDaySpan(oldStart,newStart));
}
// A fee/name/scoring edit must never replace an explicitly saved deadline.
export function competitionEndForEdit({existing,starts,days,league=false,explicitEnd}) {
 if(explicitEnd)return new Date(explicitEnd);
 if(existing?.ends){
  const shifted=shiftCompetitionEnd(existing.ends,existing.starts,starts);
  return addCalendarDays(shifted,Number(days)-Number(existing.days||1));
 }
 return defaultCompetitionEnd(starts,days,{league});
}
