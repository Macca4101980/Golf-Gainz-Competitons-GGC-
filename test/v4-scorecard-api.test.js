import test from 'node:test';
import assert from 'node:assert/strict';
import {saveV4Scorecard,readV4Scorecard,ScorecardConflictError} from '../src/v4-scorecard-api.js';
const card={id:'card-1',compId:'comp-1',societyId:'group-1',playerId:'golfer-1',gross:[4,5]};
const base={baseUrl:'https://example.supabase.co/',apiKey:'public-key',accessToken:'user-token',card,expectedRevision:0};
test('own-card request is scoped and authenticated',async()=>{
 let url,opts;const revision=await saveV4Scorecard({...base,fetcher:async(u,o)=>{url=u;opts=o;return {ok:true,json:async()=>1}}});
 assert.equal(revision,1);assert.match(url,/\/rpc\/ggc_save_my_scorecard_v4$/);
 assert.equal(opts.headers.Authorization,'Bearer user-token');
 assert.deepEqual(JSON.parse(opts.body),{p_card_id:'card-1',p_comp_id:'comp-1',p_group_id:'group-1',p_expected_revision:0,p_card:card});
});
test('delegated request uses group RPC and target identity',async()=>{
 let url,payload;await saveV4Scorecard({...base,mode:'group',targetGolferId:'golfer-1',fetcher:async(u,o)=>{url=u;payload=JSON.parse(o.body);return {ok:true,json:async()=>1}}});
 assert.match(url,/\/rpc\/ggc_save_group_scorecard_v4$/);assert.equal(payload.p_target_golfer_id,'golfer-1');
});
test('stale scorecard produces a distinct conflict',async()=>{
 await assert.rejects(saveV4Scorecard({...base,expectedRevision:2,fetcher:async()=>({ok:false,status:409,text:async()=> '40001 conflict'})}),ScorecardConflictError);
});
test('never sends invalid identity, delegated target or revision',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('Unexpected network call')};
 await assert.rejects(saveV4Scorecard({...base,card:{...card,compId:''},fetcher}),/identity incomplete/);
 await assert.rejects(saveV4Scorecard({...base,expectedRevision:undefined,fetcher}),/revision required/);
 await assert.rejects(saveV4Scorecard({...base,mode:'group',targetGolferId:'other',fetcher}),/mismatch/);
 assert.equal(calls,0);
});
test('server permission denial never reports a successful save',async()=>{
 await assert.rejects(saveV4Scorecard({...base,fetcher:async()=>({ok:false,status:403,text:async()=> 'permission denied'})}),/rejected \(403\)/);
});

test('scoped read returns current revision and card',async()=>{
 let url,payload;const result=await readV4Scorecard({...base,cardId:'card-1',fetcher:async(u,o)=>{url=u;payload=JSON.parse(o.body);return {ok:true,json:async()=>[{card,revision:3}]}}});
 assert.match(url,/\/rpc\/ggc_read_scorecard_v4$/);assert.deepEqual(payload,{p_card_id:'card-1'});assert.deepEqual(result,{card,revision:3});
});
test('scoped read handles missing and denied cards without exposing data',async()=>{
 assert.equal(await readV4Scorecard({...base,cardId:'missing',fetcher:async()=>({ok:true,json:async()=>[]})}),null);
 await assert.rejects(readV4Scorecard({...base,cardId:'secret',fetcher:async()=>({ok:false,status:403})}),/read rejected/);
});
