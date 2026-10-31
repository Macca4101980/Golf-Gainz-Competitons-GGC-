import test from 'node:test';
import assert from 'node:assert/strict';

let handler;
globalThis.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://qa.invalid':'test-service-key'},serve:callback=>{handler=callback}};
await import('../supabase/functions/beta12-public-leaderboard/index.ts');
delete globalThis.Deno;

function sourceFixture(){
 const holes=Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1}));
 const league={id:'league',name:'QA League',teams:[{id:'ab',name:'Team AB',memberIds:['a','b']}],handicapSettings:{mode:'fixed'}};
 const base={leagueId:'league',format:'4bbb-stableford',courseSnapshot:{tee:{name:'Green',slope:113,rating:72,holes}}};
 const state={players:[{id:'a',name:'A',hi:0},{id:'b',name:'B',hi:0}],leagues:[league],comps:[{...base,id:'w1',starts:'2000-01-01'},{...base,id:'w2',starts:'2000-01-02',resultsEmbargo:{enabled:true,releaseAt:'2999-01-01',visibleThroughHole:15}}],cards:[{id:'a1',playerId:'a',compId:'w1',gross:Array(18).fill(4)},{id:'a2',playerId:'a',compId:'w2',gross:Array(18).fill(4)}]};
 const source=()=>({leagueId:'league',sourceVersion:'qa-version',records:Object.entries(state).flatMap(([kind,rows])=>rows.map(data=>({kind,data})))});
 return {state,source};
}
const request=token=>new Request('https://qa.invalid',{method:'POST',body:JSON.stringify({p_token:token})});

test('Edge requests recalculate the overall table from saved cards and commit only through the service RPC',async()=>{
 const originalFetch=globalThis.fetch,originalDeno=globalThis.Deno;const {state,source}=sourceFixture();const commits=[];
 globalThis.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://qa.invalid':'test-service-key'}};
 globalThis.fetch=async(url,options)=>{
  assert.equal(options.headers.Authorization,'Bearer test-service-key');
  const name=url.split('/').at(-1),args=JSON.parse(options.body);
  if(name==='ggc_public_league_leaderboard_source')return Response.json(source());
  if(name==='ggc_commit_public_league_leaderboard'){
   commits.push(args);return Response.json({title:'QA League',provisional:args.p_payload.provisional,rows:args.p_payload.rows.map(r=>({result:r.result,played:r.played}))});
  }
  throw Error('Unexpected RPC '+name);
 };
 try{
  const first=await handler(request('a'.repeat(64)));assert.equal(first.status,200);
  const firstData=await first.json();assert.equal(firstData.rows[0].result,'66 pts');assert.equal(firstData.provisional,true);
  assert.ok(!JSON.stringify(firstData).includes('memberIds'));
  state.cards[1].gross[0]=3;
  const next=await handler(request('a'.repeat(64)));assert.equal((await next.json()).rows[0].result,'67 pts');
  assert.equal(commits.length,2);assert.equal(commits[1].p_source_version,'qa-version');
 }finally{globalThis.fetch=originalFetch;globalThis.Deno=originalDeno}
});

test('Edge retries a concurrent score change rather than returning a stale snapshot',async()=>{
 const originalFetch=globalThis.fetch,originalDeno=globalThis.Deno;const {source}=sourceFixture();let reads=0,commits=0;
 globalThis.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://qa.invalid':'test-service-key'}};
 globalThis.fetch=async url=>{
  if(url.endsWith('/ggc_public_league_leaderboard_source')){reads++;return Response.json(source())}
  if(++commits===1)return new Response('GGC_PUBLIC_SOURCE_CHANGED',{status:409});
  return Response.json({rows:[],fresh:true});
 };
 try{const result=await handler(request('a'.repeat(64)));assert.equal((await result.json()).fresh,true);assert.equal(reads,2);assert.equal(commits,2)}
 finally{globalThis.fetch=originalFetch;globalThis.Deno=originalDeno}
});
