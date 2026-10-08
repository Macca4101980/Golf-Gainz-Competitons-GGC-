import test from 'node:test';
import assert from 'node:assert/strict';
import {createV4ScorecardSession} from '../src/v4-scorecard-session.js';
import {ScorecardConflictError} from '../src/v4-scorecard-api.js';
const original={id:'c1',compId:'comp',societyId:'group',playerId:'golfer',gross:[4,5]};
function fixture(){
 let server=structuredClone(original),revision=2,writes=0;
 const fetcher=async(url,opts)=>{
  const p=JSON.parse(opts.body);
  if(url.includes('read_scorecard'))return {ok:true,json:async()=>server?[{card:structuredClone(server),revision}]:[]};
  writes++;
  if(p.p_expected_revision!==revision)return {ok:false,status:409,text:async()=> '40001 conflict'};
  server=structuredClone(p.p_card);revision++;
  return {ok:true,json:async()=>revision};
 };
 const session=createV4ScorecardSession({baseUrl:'https://example.supabase.co',apiKey:'key',accessToken:'token',actorGolferId:'golfer',fetcher});
 return {session,get:()=>({server,revision,writes}),change:(card)=>{server=structuredClone(card);revision++},remove:()=>{server=null}};
}
test('cannot save before opening trusted server baseline',async()=>{
 const f=fixture();await assert.rejects(f.session.save({...original,gross:[3,5]}),/Open the server/);assert.equal(f.get().writes,0);
});
test('opening yields independent snapshot and edits save with server revision',async()=>{
 const f=fixture(),opened=await f.session.open('c1');opened.card.gross[0]=3;
 const result=await f.session.save(opened.card);assert.equal(result.revision,3);assert.deepEqual(f.get().server.gross,[3,5]);
 assert.equal((await f.session.save(opened.card)).unchanged,true);assert.equal(f.get().writes,1);
});
test('concurrent remote edit blocks local overwrite',async()=>{
 const f=fixture(),opened=await f.session.open('c1');f.change({...original,gross:[2,5]});opened.card.gross[0]=3;
 await assert.rejects(f.session.save(opened.card),ScorecardConflictError);assert.deepEqual(f.get().server.gross,[2,5]);assert.equal(f.get().writes,0);
});
test('deleted remote card blocks recreation',async()=>{
 const f=fixture(),opened=await f.session.open('c1');f.remove();opened.card.gross[0]=3;
 await assert.rejects(f.session.save(opened.card),ScorecardConflictError);assert.equal(f.get().writes,0);
});
test('changing card identity is forbidden',async()=>{
 const f=fixture();await f.session.open('c1');
 await assert.rejects(f.session.save({...original,playerId:'other'}),/identity changed/);assert.equal(f.get().writes,0);
});

test('overlapping saves on one device cannot race each other',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve});
 let revision=1,writes=0,remote=structuredClone(original);
 const fetcher=async(url,opts)=>{
  if(url.includes('read_scorecard'))return {ok:true,json:async()=>[{card:structuredClone(remote),revision}]};
  writes++;await gate;remote=JSON.parse(opts.body).p_card;revision++;
  return {ok:true,json:async()=>revision};
 };
 const session=createV4ScorecardSession({baseUrl:'https://example.supabase.co',apiKey:'key',accessToken:'token',actorGolferId:'golfer',fetcher});
 const opened=await session.open('c1');opened.card.gross[0]=3;
 const first=session.save(opened.card);
 await assert.rejects(session.save({...opened.card,gross:[2,5]}),/already in progress/);
 release();await first;assert.equal(writes,1);assert.deepEqual(remote.gross,[3,5]);
});

test('open cannot replace baseline while save is pending, and close is blocked',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve});
 let remote=structuredClone(original),revision=2;
 const fetcher=async(url,opts)=>{
  if(url.includes('read_scorecard'))return {ok:true,json:async()=>[{card:structuredClone(remote),revision}]};
  await gate;remote=JSON.parse(opts.body).p_card;revision++;
  return {ok:true,json:async()=>revision};
 };
 const session=createV4ScorecardSession({baseUrl:'https://example.supabase.co',apiKey:'key',accessToken:'token',actorGolferId:'golfer',fetcher});
 const opened=await session.open('c1');opened.card.gross[0]=3;
 const saving=session.save(opened.card);
 await assert.rejects(session.open('c1'),/already in progress/);
 assert.throws(()=>session.close('c1'),/during an operation/);
 release();await saving;
 const next=await session.open('c1');assert.equal(next.revision,3);
});
test('overlapping opens cannot overwrite a baseline with out-of-order responses',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve});
 const fetcher=async()=>{await gate;return {ok:true,json:async()=>[{card:structuredClone(original),revision:2}]}};
 const session=createV4ScorecardSession({baseUrl:'https://example.supabase.co',apiKey:'key',accessToken:'token',actorGolferId:'golfer',fetcher});
 const opening=session.open('c1');
 await assert.rejects(session.open('c1'),/already in progress/);
 release();await opening;
});

test('save refuses success when server readback does not match submitted card',async()=>{
 let remote=structuredClone(original),revision=2,writes=0;
 const fetcher=async(url)=>{
  if(url.includes('read_scorecard'))return {ok:true,json:async()=>[{card:structuredClone(remote),revision}]};
  writes++;revision++;return {ok:true,json:async()=>revision};
 };
 const session=createV4ScorecardSession({baseUrl:'https://example.supabase.co',apiKey:'key',accessToken:'token',actorGolferId:'golfer',fetcher});
 const opened=await session.open('c1');opened.card.gross[0]=3;
 await assert.rejects(session.save(opened.card),ScorecardConflictError);
 assert.equal(writes,1);
 await assert.rejects(session.save(opened.card),/Open the server scorecard/);
});
