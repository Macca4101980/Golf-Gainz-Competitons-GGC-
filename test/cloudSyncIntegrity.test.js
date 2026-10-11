import test from 'node:test';
import assert from 'node:assert/strict';
import {createLegacyCloudStore} from '../src/legacyCloudStore.js';

test('stale device cannot overwrite a newer cloud state', async () => {
  let version='2026-10-11T07:00:00.000Z';
  let payload={players:[{id:'hooky',email:null}]};
  const fetcher=async (url,options={}) => {
    if (!options.method) return {ok:true,json:async()=>[{payload:structuredClone(payload),updated_at:version}]};
    const expected=new URL(url).searchParams.get('updated_at').slice(3);
    if(expected!==version)return {ok:true,json:async()=>[]};
    const body=JSON.parse(options.body);
    payload=body.payload;version=body.updated_at;
    return {ok:true,json:async()=>[{updated_at:version}]};
  };
  const first=createLegacyCloudStore({url:'https://example.supabase.co',key:'test',fetcher});
  const second=createLegacyCloudStore({url:'https://example.supabase.co',key:'test',fetcher});
  const a=await first.load('token'),b=await second.load('token');
  a.players[0].email='richard-hook@live.co.uk';
  await first.save(a,'token');
  b.players[0].email='old-copy@example.com';
  await assert.rejects(second.save(b,'token'),/GGC_CLOUD_CONFLICT/);
  assert.equal(payload.players[0].email,'richard-hook@live.co.uk');
  assert.equal(second.isReady(),false);
});

test('cloud write failure must not report success',async()=>{
  const store=createLegacyCloudStore({url:'https://example.supabase.co',key:'test',fetcher:async(_url,options={})=>options.method?{ok:false,status:503}:{ok:true,json:async()=>[{payload:{},updated_at:'2026-10-11T07:00:00.000Z'}]}});
  await store.load('token');
  await assert.rejects(store.save({players:[]},'token'),/Cloud write failed: 503/);
});
