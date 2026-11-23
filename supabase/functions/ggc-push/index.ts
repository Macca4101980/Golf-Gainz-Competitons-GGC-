import webpush from'npm:web-push@3.6.7';
import{createClient}from'npm:@supabase/supabase-js@2.105.0';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json'}});
const sameSecret=(left:string,right:string)=>{const a=new TextEncoder().encode(left),b=new TextEncoder().encode(right);if(a.length!==b.length)return false;let different=0;for(let i=0;i<a.length;i++)different|=a[i]^b[i];return different===0};

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL')||'',serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(!url||!serviceKey)return json({error:'Push service is not configured'},500);
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const schedulerToken=req.headers.get('x-ggc-scheduler-secret')||'';
 const{data:expectedSchedulerToken}=await admin.rpc('ggc_scheduler_secret');
 const scheduled=!!schedulerToken&&typeof expectedSchedulerToken==='string'&&sameSecret(schedulerToken,expectedSchedulerToken);
 if(!scheduled){
  const bearer=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  const{data:{user}}=bearer?await admin.auth.getUser(bearer):{data:{user:null}};
  if(!user)return json({error:'Unauthorized'},401);
 }
 let published=0;
 if(scheduled){
  const{data,error:publishError}=await admin.rpc('ggc_publish_scheduled_updates');
  if(publishError)return json({error:'Could not publish scheduled updates'},500);
  published=Number(data||0);
 }
 const{data:config,error:configError}=await admin.rpc('ggc_push_server_config');
 if(configError||!config?.[0])return json({error:'Push keys unavailable'},500);
 webpush.setVapidDetails(config[0].subject,config[0].public_key,config[0].private_key);
 const{data:deliveries,error}=await admin.rpc('ggc_claim_push_deliveries',{p_limit:100});
 if(error)return json({error:'Could not claim push deliveries'},500);
 let delivered=0,failed=0;
 for(const item of deliveries||[]){
  try{
   await webpush.sendNotification(item.subscription,JSON.stringify({title:item.title,body:item.body||'Open GGC to view this update.',url:item.url,tag:`ggc-update-${item.update_id}`,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png'}),{TTL:86400,urgency:'normal'});
   await admin.rpc('ggc_finish_push_delivery',{p_delivery_id:item.delivery_id,p_success:true,p_disable_subscription:false,p_error:null});delivered++;
  }catch(cause){
   const status=Number((cause as {statusCode?:number})?.statusCode||0),disable=status===404||status===410;
   await admin.rpc('ggc_finish_push_delivery',{p_delivery_id:item.delivery_id,p_success:false,p_disable_subscription:disable,p_error:String((cause as Error)?.message||cause)});failed++;
  }
 }
 return json({ok:true,scheduled,published,delivered,failed});
});
