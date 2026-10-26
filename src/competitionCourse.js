export function buildCourseSnapshot(course,teeName){
 if(!course)return null;
 const tee=(course.tees||[]).find(t=>t.name===teeName);
 if(!tee||!(tee.holes||[]).length)return null;
 return {
  id:course.id||null,
  name:course.name||'Course',
  source:course.source||null,
  sourceCourseId:course.sourceCourseId||null,
  tee:{
   id:tee.id||null,
   name:tee.name||teeName||'Tee',
   slope:Number(tee.slope)||0,
   rating:Number(tee.rating)||0,
   yards:Number(tee.yards)||0,
   gender:tee.gender||null,
   source:tee.source||course.source||null,
   sourceCourseId:tee.sourceCourseId||course.sourceCourseId||null,
   holes:(tee.holes||[]).map((h,i)=>({
    n:Number(h.n)||i+1,
    par:Number(h.par)||0,
    si:Number(h.si)||i+1,
    ...(h.yards==null?{}:{yards:Number(h.yards)||0})
   }))
  }
 };
}

export function competitionCourse(c,state,card=null){
 const snapshot=c?.courseSnapshot;
 const snapshotTee=snapshot?.tee;
 if(snapshot&&snapshotTee&&(snapshotTee.holes||[]).length){
  const tee={...snapshotTee,name:snapshotTee.name||c?.tee||'Tee',holes:(snapshotTee.holes||[]).map(h=>({...h}))};
  const course={id:snapshot.id||c?.course||null,name:snapshot.name||'Course',source:snapshot.source||null,sourceCourseId:snapshot.sourceCourseId||null,tees:[tee]};
  const par=tee.holes.reduce((sum,h)=>sum+(Number(h.par)||0),0)||72;
  return {course,tee,holes:tee.holes,par,fromSnapshot:true};
 }
 const course=(state?.courses||[]).find(x=>x.id===(card?.courseId||c?.course));
 const tee=course?.tees?.find(t=>t.name===(card?.tee||c?.tee));
 const holes=tee?.holes||[];
 const par=holes.reduce((sum,h)=>sum+(Number(h.par)||0),0)||72;
 return {course,tee,holes,par,fromSnapshot:false};
}
