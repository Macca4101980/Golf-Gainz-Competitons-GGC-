import test from 'node:test';
import assert from 'node:assert/strict';
import {persistV4Scorecard} from '../src/v4-scorecard-persist.js';
import {ScorecardConflictError} from '../src/v4-scorecard-api.js';
const card={id:'card-1',compId:'comp-1',societyId:'group-1',playerId:'golfer-1',gross:[4,5]};
const base={baseUrl:'https://example.supabase.co',apiKey:'key',accessToken:'token',actorGolferId:'golfer-1',card};
function fake(existing,revision=1){const calls=[];return {calls,fetcher:async(url,options)=>{const payload=JSON.parse(options.body);calls.push({url,payload});if(url.includes('read_scorecard'))return {ok:true,json:async()=>existing?[{card:existing,revision}]:[]};return {ok:true,json:async()=>revision+1}}}}
test('creates missing own scorecard with revision zero',async()=>{
 const api=fake(null);const out=await persistV4Scorecard({...base,fetcher:api.fetcher});
 assert.equal(out.revision,2);assert.equal(api.calls.length,2);
 assert.match(api.calls[1].url,/save_my_scorecard/);assert.equal(api.calls[1].payload.p_expected_revision,0);
});
test('creates missing delegated scorecard through admin RPC',async()=>{
 const api=fake(null);await persistV4Scorecard({...base,actorGolferId:'admin-1',fetcher:api.fetcher});
 assert.match(api.calls[1].url,/save_group_scorecard/);assert.equal(api.calls[1].payload.p_target_golfer_id,'golfer-1');
});
test('existing scorecard requires exact baseline and uses its revision',async()=>{
 const api=fake(card,4);const updated={...card,gross:[4,4]};
 const out=await persistV4Scorecard({...base,card:updated,baselineCard:card,baselineRevision:4,fetcher:api.fetcher});
 assert.equal(out.revision,5);assert.equal(api.calls[1].payload.p_expected_revision,4);
});
test('unchanged card is not rewritten',async()=>{
 const api=fake(card,4);const out=await persistV4Scorecard({...base,baselineCard:card,baselineRevision:4,fetcher:api.fetcher});
 assert.deepEqual(out,{revision:4,unchanged:true});assert.equal(api.calls.length,1);
});
test('changed remote scorecard cannot be silently overwritten',async()=>{
 const api=fake({...card,gross:[3,5]},4);
 await assert.rejects(persistV4Scorecard({...base,card:{...card,gross:[4,4]},baselineCard:card,baselineRevision:4,fetcher:api.fetcher}),ScorecardConflictError);
 assert.equal(api.calls.length,1);
});
test('missing baseline for existing card fails closed',async()=>{
 const api=fake(card,4);
 await assert.rejects(persistV4Scorecard({...base,card:{...card,gross:[4,4]},fetcher:api.fetcher}),ScorecardConflictError);
 assert.equal(api.calls.length,1);
});
