import crypto from 'node:crypto';

const WHS_BASE='https://isvapi.whsplatform.englandgolf.org';
const COUNTRY='eng';
let tokenCache=null;
const requestWindows=new Map();

const firstValue=(source,paths)=>{
 for(const path of paths){
  let value=source;
  for(const key of path.split('.'))value=value&&typeof value==='object'?value[key]:undefined;
  if(value!==undefined&&value!==null&&value!=='')return value;
 }
 return null;
};

export function validateMembershipNumber(value){
 const number=String(value||'').replace(/\s+/g,'');
 if(!/^\d{10}$/.test(number))throw Object.assign(new Error('Enter the 10-digit England Golf membership number.'),{status:400});
 return number;
}

export function createClientToken(username,secret,issuedAt=Math.floor(Date.now()/1000)){
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const head=encode({alg:'HS256',typ:'JWT'}),body=encode({aud:'isv-api',iss:username,iat:issuedAt});
 const signature=crypto.createHmac('sha256',secret).update(`${head}.${body}`).digest('base64url');
 return `${head}.${body}.${signature}`;
}

export function normaliseVisitor(data,membershipNumber){
 const handicap=Number(firstValue(data,['handicapIndex','handicap.index','handicap.handicapIndex','currentHandicap.handicapIndex','currentHandicapIndex']));
 if(!Number.isFinite(handicap))throw Object.assign(new Error('England Golf returned the golfer but no active Handicap Index.'),{status:422});
 const first=firstValue(data,['firstName','person.firstName','member.firstName']);
 const last=firstValue(data,['lastName','surname','person.lastName','member.lastName']);
 const displayName=firstValue(data,['displayName','fullName','name','member.displayName'])||[first,last].filter(Boolean).join(' ')||null;
 const homeClub=firstValue(data,['homeClub.name','club.name','homeClubName','membership.club.name','memberships.0.club.name']);
 const lastScoreAt=firstValue(data,['lastScoreDateUTC','lastScoreAtUTC','handicap.lastScoreDateUTC']);
 return {membershipNumberLast4:String(membershipNumber).slice(-4),displayName,homeClub:homeClub||null,handicapIndex:handicap,lastScoreAt:lastScoreAt||null,retrievedAt:new Date().toISOString(),source:'England Golf WHS'};
}

function configured(){return !!(process.env.WHS_ISV_USERNAME&&process.env.WHS_ISV_SECRET)}

async function verifyGgcUser(req){
 const authorization=String(req.headers?.authorization||'');
 if(!authorization.startsWith('Bearer '))throw Object.assign(new Error('Sign in to GGC before checking a handicap.'),{status:401});
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
 const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 if(!url||!key)throw Object.assign(new Error('GGC authentication is not configured on the server.'),{status:503});
 const response=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:authorization}});
 if(!response.ok)throw Object.assign(new Error('Your GGC sign-in has expired. Sign in again and retry.'),{status:401});
 const user=await response.json();
 if(!user?.id)throw Object.assign(new Error('GGC could not verify your account.'),{status:401});
 return user.id;
}

function enforceRateLimit(userId){
 const now=Date.now(),window=requestWindows.get(userId);
 if(!window||now-window.startedAt>=60000){requestWindows.set(userId,{startedAt:now,count:1});return}
 window.count+=1;
 if(window.count>12)throw Object.assign(new Error('Too many handicap checks. Wait a minute and try again.'),{status:429});
}

async function whsAccessToken(){
 if(tokenCache&&tokenCache.expiresAt>Date.now()+60000)return tokenCache.value;
 const username=process.env.WHS_ISV_USERNAME,secret=process.env.WHS_ISV_SECRET;
 const response=await fetch(`${WHS_BASE}/api/${COUNTRY}/v1/account/token`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({clientToken:createClientToken(username,secret)})});
 const data=await response.json().catch(()=>null);
 if(!response.ok||!data?.accessToken)throw Object.assign(new Error('England Golf authentication failed.'),{status:502,detail:data});
 const parsed=Date.parse(data.expiresAtUTC||'');
 tokenCache={value:data.accessToken,expiresAt:Number.isFinite(parsed)?parsed:Date.now()+10*60*1000};
 return tokenCache.value;
}

async function lookupVisitor(membershipNumber){
 const token=await whsAccessToken();
 const response=await fetch(`${WHS_BASE}/api/${COUNTRY}/v1/club/visitors/${encodeURIComponent(membershipNumber)}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
 const data=await response.json().catch(()=>null);
 if(response.status===404)throw Object.assign(new Error('No England Golf golfer was found for that membership number.'),{status:404});
 if(!response.ok)throw Object.assign(new Error('England Golf could not return that handicap right now.'),{status:response.status===429?429:502,detail:data});
 return normaliseVisitor(data,membershipNumber);
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET')return res.status(200).json({ok:true,configured:configured(),mode:'read-only'});
 if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST only'});
 try{
  if(!configured())throw Object.assign(new Error('England Golf WHS lookup is awaiting API credentials.'),{status:503});
  const userId=await verifyGgcUser(req);enforceRateLimit(userId);
  const membershipNumber=validateMembershipNumber(req.body?.membershipNumber);
  const golfer=await lookupVisitor(membershipNumber);
  return res.status(200).json({ok:true,golfer});
 }catch(error){return res.status(error.status||500).json({ok:false,error:error.message});}
}
