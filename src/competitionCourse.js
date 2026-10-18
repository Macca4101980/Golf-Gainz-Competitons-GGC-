// The selected course and all its tee/hole metadata travel with each competition.
export function snapshotCompetitionCourse(course,teeName){
 if(!course||!Array.isArray(course.tees))return null;
 const selected=course.tees.find(t=>t.name===teeName);
 if(!selected||!Array.isArray(selected.holes)||selected.holes.length!==18)return null;
 return JSON.parse(JSON.stringify({...course,tees:[selected],snapshotVersion:1}));
}
export function competitionCourse(comp,state){
 return comp?.courseSnapshot||(state?.courses||[]).find(x=>x.id===comp?.course)||null;
}
export function competitionTee(comp,state){
 return competitionCourse(comp,state)?.tees?.find(t=>t.name===comp.tee)||null;
}

export function planCompetitionSnapshots(comps,courses){
 const updates=[],blocked=[];
 for(const comp of comps||[]){
  if(comp.courseSnapshot)continue;
  const course=(courses||[]).find(x=>x.id===comp.course);
  const snapshot=snapshotCompetitionCourse(course,comp.tee);
  const tee=snapshot?.tees?.[0];
  if(!tee||!Number.isFinite(+tee.rating)||+tee.rating<=0||!Number.isFinite(+tee.slope)||+tee.slope<=0||new Set(tee.holes.map(h=>+h.si)).size!==18||tee.holes.some(h=>!Number.isInteger(+h.si)||+h.si<1||+h.si>18||!Number.isInteger(+h.par)||+h.par<3||+h.par>6)){
   blocked.push(comp.id);continue;
  }
  updates.push({compId:comp.id,courseSnapshot:snapshot});
 }
 return {updates,blocked};
}
