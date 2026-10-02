const API_BASE='https://uk-golf-course-data-api.p.rapidapi.com';
const API_HOST='uk-golf-course-data-api.p.rapidapi.com';
async function call(path){
 const key=process.env.RAPIDAPI_KEY;if(!key){const e=new Error('UK Golf API is not configured');e.status=500;throw e}
 const r=await fetch(API_BASE+path,{headers:{'X-RapidAPI-Key':key,'X-RapidAPI-Host':API_HOST,Accept:'application/json'}});
 const body=await r.json().catch(()=>null);if(!r.ok){const e=new Error(body?.message||('UK Golf API returned HTTP '+r.status));e.status=r.status;throw e}return body?.data??body;
}
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({ok:false,error:'GET only'});
 try{
  const action=String(req.query?.action||'search');
  if(action==='search'){const q=String(req.query?.q||'').trim();if(q.length<2)return res.status(400).json({ok:false,error:'Enter at least 2 characters'});const data=await call('/clubs?search='+encodeURIComponent(q)+'&limit=20');return res.status(200).json({ok:true,data});}
  if(action==='courses'){const id=String(req.query?.clubId||'');if(!id)return res.status(400).json({ok:false,error:'clubId required'});const data=await call('/clubs/'+encodeURIComponent(id)+'/courses');return res.status(200).json({ok:true,data});}
  if(action==='scorecard'){const id=String(req.query?.courseId||'');if(!id)return res.status(400).json({ok:false,error:'courseId required'});const data=await call('/courses/'+encodeURIComponent(id)+'/scorecard');return res.status(200).json({ok:true,data});}
  return res.status(400).json({ok:false,error:'Unknown action'});
 }catch(e){return res.status(e.status||500).json({ok:false,error:e.message})}
}