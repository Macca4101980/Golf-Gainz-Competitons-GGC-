import test from 'node:test';
import assert from 'node:assert/strict';
import {createLegacyCloudStore} from '../src/legacyCloudStore.js';
function mockServer(){
 let row={payload:{players:[{id:'a',hi:10}]},updated_at:'2026-10-09T18:00:00.000Z'};
 const fetcher=async(url,opts)=>{
  if(!opts.method){return {ok:true,json:async()=>[structuredClone(row)]};}
  assert.equal(opts.method,'PATCH');
  const expected=new URL(url).searchParams.get('updated_at').slice(3);
  if(expected!==row.updated_at)return {ok:true,json:async()=>[]};
  const body=JSON.parse(opts.body);row={...body};
  return {ok:true,json:async()=>[{updated_at:row.updated_at}]};
 };
 return {fetcher,read:()=>structuredClone(row)};
}
test('rejects saves without cloud baseline',async()=>{
 const s=createLegacyCloudStore({url:'https://example.supabase.co',key:'test',fetcher:mockServer().fetcher});
 await assert.rejects(s.save({players:[]},'token'),/GGC_CLOUD_BASELINE_REQUIRED/);
});
test('two devices cannot silently overwrite each other',async()=>{
 const db=mockServer(),args={url:'https://example.supabase.co',key:'test',fetcher:db.fetcher};
 const a=createLegacyCloudStore(args),b=createLegacyCloudStore(args);
 await a.load('token');await b.load('token');
 await a.save({players:[{id:'a',hi:9}]},'token');
 await assert.rejects(b.save({players:[{id:'a',hi:11}]},'token'),/GGC_CLOUD_CONFLICT/);
 assert.equal(db.read().payload.players[0].hi,9);
 assert.equal(b.isReady(),false);
});
test('queued saves use latest acknowledged version',async()=>{
 const db=mockServer(),s=createLegacyCloudStore({url:'https://example.supabase.co',key:'test',fetcher:db.fetcher});
 await s.load('token');
 await Promise.all([s.save({n:1},'token'),s.save({n:2},'token')]);
 assert.deepEqual(db.read().payload,{n:2});
});

test('uncertain HTTP failure blocks later writes until fresh load',async()=>{
 const db=mockServer();let fail=true;
 const fetcher=async(url,opts)=>{
  if(opts.method==='PATCH'&&fail){fail=false;return {ok:false,status:503};}
  return db.fetcher(url,opts);
 };
 const s=createLegacyCloudStore({url:'https://example.supabase.co',key:'test',fetcher});
 await s.load('token');
 await assert.rejects(s.save({n:1},'token'),/reload required/);
 await assert.rejects(s.save({n:2},'token'),/GGC_CLOUD_BASELINE_REQUIRED/);
 await s.load('token');
 await s.save({n:3},'token');
 assert.deepEqual(db.read().payload,{n:3});
});
test('baseline refresh waits for pending write',async()=>{
 const db=mockServer();let release;
 const gate=new Promise(resolve=>{release=resolve});
 let pendingWrite=false;
 const fetcher=async(url,opts)=>{
  if(opts.method==='PATCH'){pendingWrite=true;await gate;}
  return db.fetcher(url,opts);
 };
 const s=createLegacyCloudStore({url:'https://example.supabase.co',key:'test',fetcher});
 await s.load('token');
 const save=s.save({n:7},'token');
 // Wait until the queued write enters the mocked server.
 for(let i=0;i<20&&!pendingWrite;i++)await Promise.resolve();
 assert.equal(pendingWrite,true);
 let loaded=false;
 const load=s.load('token').then(()=>{loaded=true});
 await Promise.resolve();
 assert.equal(loaded,false);
 release();
 await save;await load;
 assert.deepEqual(db.read().payload,{n:7});
});
