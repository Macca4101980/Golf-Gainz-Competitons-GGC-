import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestStateStore} from '../src/testStateStore.js';

function fakeClient({userId='golfer-a',initial=null}={}) {
  const records=new Map(initial ? [[userId,{payload:initial,revision:1}]] : []);
  const client={
    auth:{getUser:async()=>({data:{user:{id:userId}},error:null})},
    from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:records.get(userId)||null,error:null})})})})}),
    rpc:async(_name,args)=>{
      const row=records.get(userId);
      if ((row?.revision||0)!==args.p_expected_revision) return {data:null,error:{code:'40001',message:'Revision conflict'}};
      const revision=(row?.revision||0)+1;
      records.set(userId,{payload:args.p_payload,revision});
      return {data:revision,error:null};
    }
  };
  return {client,records};
}

test('first save starts at revision one and loads again',async()=>{
  const {client}=fakeClient();
  const store=createTestStateStore(client);
  assert.equal(await store.load(),null);
  assert.equal(await store.save({comps:[{id:'c1'}]}),1);
  assert.deepEqual(await store.load(),{comps:[{id:'c1'}]});
});

test('stale device cannot overwrite another device',async()=>{
  const {client,records}=fakeClient({initial:{comps:[]}});
  const a=createTestStateStore(client),b=createTestStateStore(client);
  await a.load();await b.load();
  await a.save({comps:[{id:'new'}]});
  await assert.rejects(()=>b.save({comps:[]}),/CLOUD_CONFLICT/);
  assert.deepEqual(records.get('golfer-a').payload,{comps:[{id:'new'}]});
});

test('saving requires a signed-in user',async()=>{
  const {client}=fakeClient();
  client.auth.getUser=async()=>({data:{user:null},error:null});
  await assert.rejects(()=>createTestStateStore(client).load(),/Sign in required/);
});
