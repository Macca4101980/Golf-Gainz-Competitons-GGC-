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
