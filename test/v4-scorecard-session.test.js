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

test('scorecard save tolerates reordered JSON object keys returned by PostgreSQL',async()=>{
 let revision=2,remote=structuredClone(original);
 const reverseKeys=obj=>Object.fromEntries(Object.entries(obj).reverse());
 const fetcher=async(url,opts)=>{
  if(url.includes('read_scorecard'))return {ok:true,json:async()=>[{card:reverseKeys(structuredClone(remote)),revision}]};
  remote=JSON.parse(opts.body).p_card;revision++;
  return {ok:true,json:async()=>revision};
 };
 const session=createV4ScorecardSession({baseUrl:'https://example.supabase.co',apiKey:'key',accessToken:'token',actorGolferId:'golfer',fetcher});
 const opened=await session.open('c1');opened.card.gross[0]=3;
 const saved=await session.save(opened.card);
 assert.equal(saved.revision,3);
 assert.equal(saved.unchanged,false);
});

test('draft edited while save is in flight does not invalidate confirmed submitted snapshot',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve});
 let revision=2,remote=structuredClone(original);
 const fetcher=async(url,opts)=>{
  if(url.includes('read_scorecard'))return {ok:true,json:async()=>[{card:structuredClone(remote),revision}]};
  await gate;remote=JSON.parse(opts.body).p_card;revision++;
  return {ok:true,json:async()=>revision};
 };
 const session=createV4ScorecardSession({baseUrl:'https://example.supabase.co',apiKey:'key',accessToken:'token',actorGolferId:'golfer',fetcher});
 const opened=await session.open('c1');opened.card.gross[0]=3;
 const saving=session.save(opened.card);
 opened.card.gross[0]=2;
 release();
 const result=await saving;
 assert.equal(result.revision,3);
 assert.equal(remote.gross[0],3);
 assert.equal(opened.card.gross[0],2);
});

test('failed save invalidates baseline because remote commit may have succeeded',async()=>{
 let revision=2,remote=structuredClone(original),writes=0;
 const fetcher=async(url)=>{
  if(url.includes('read_scorecard'))return {ok:true,json:async()=>[{card:structuredClone(remote),revision}]};
  writes++;throw Error('Connection lost after request');
 };
 const session=createV4ScorecardSession({baseUrl:'https://example.supabase.co',apiKey:'key',accessToken:'token',actorGolferId:'golfer',fetcher});
 const opened=await session.open('c1');opened.card.gross[0]=3;
 await assert.rejects(session.save(opened.card),/Connection lost/);
 await assert.rejects(session.save(opened.card),/Open the server scorecard/);
 assert.equal(writes,1);
 const reopened=await session.open('c1');assert.equal(reopened.revision,2);
});

test('post-save read failure invalidates baseline even if write was accepted',async()=>{
 let revision=2,remote=structuredClone(original),writes=0,failRead=false;
 const fetcher=async(url,opts)=>{
  if(url.includes('read_scorecard')){
   if(failRead)throw Error('Verification connection lost');
   return {ok:true,json:async()=>[{card:structuredClone(remote),revision}]};
  }
  writes++;remote=JSON.parse(opts.body).p_card;revision++;failRead=true;
  return {ok:true,json:async()=>revision};
 };
 const session=createV4ScorecardSession({baseUrl:'https://example.supabase.co',apiKey:'key',accessToken:'token',actorGolferId:'golfer',fetcher});
 const opened=await session.open('c1');opened.card.gross[0]=3;
 await assert.rejects(session.save(opened.card),/Verification connection lost/);
 assert.equal(writes,1);
 await assert.rejects(session.save(opened.card),/Open the server scorecard/);
 failRead=false;
 const reopened=await session.open('c1');
 assert.equal(reopened.revision,3);
 assert.equal(reopened.card.gross[0],3);
});

test('two golfers scoring different cards preserve both scores without replacing either card',async()=>{
 const cards=new Map([
  ['c1',{...structuredClone(original),id:'c1',playerId:'golfer-a'}],
  ['c2',{...structuredClone(original),id:'c2',playerId:'golfer-b'}]
 ]);
 const revisions=new Map([['c1',1],['c2',1]]);
 const fetcher=async(url,opts)=>{
  const p=JSON.parse(opts.body);
  if(url.includes('read_scorecard')){
   const id=p.p_card_id,card=cards.get(id);
   return {ok:true,json:async()=>card?[{card:structuredClone(card),revision:revisions.get(id)}]:[]};
  }
  const id=p.p_card_id;
  if(revisions.get(id)!==p.p_expected_revision)return {ok:false,status:409,text:async()=> 'stale revision'};
  cards.set(id,structuredClone(p.p_card));revisions.set(id,revisions.get(id)+1);
  return {ok:true,json:async()=>revisions.get(id)};
 };
 const opts={baseUrl:'https://example.supabase.co',apiKey:'key',accessToken:'token',fetcher};
 const a=createV4ScorecardSession({...opts,actorGolferId:'golfer-a'});
 const b=createV4ScorecardSession({...opts,actorGolferId:'golfer-b'});
 const aCard=(await a.open('c1')).card,bCard=(await b.open('c2')).card;
 aCard.gross[0]=3;bCard.gross[1]=4;
 await Promise.all([a.save(aCard),b.save(bCard)]);
 assert.deepEqual(cards.get('c1').gross,[3,5]);
 assert.deepEqual(cards.get('c2').gross,[4,4]);
 assert.equal(revisions.get('c1'),2);assert.equal(revisions.get('c2'),2);
});

test('two devices editing the same golfer card reject stale second submission',async()=>{
 let remote=structuredClone(original),revision=1,writes=0;
 const fetcher=async(url,opts)=>{
  const p=JSON.parse(opts.body);
  if(url.includes('read_scorecard'))return {ok:true,json:async()=>[{card:structuredClone(remote),revision}]};
  if(p.p_expected_revision!==revision)return {ok:false,status:409,text:async()=> 'stale revision'};
  remote=structuredClone(p.p_card);revision++;writes++;
  return {ok:true,json:async()=>revision};
 };
 const opts={baseUrl:'https://example.supabase.co',apiKey:'key',accessToken:'token',actorGolferId:'golfer',fetcher};
 const phone=createV4ScorecardSession(opts),laptop=createV4ScorecardSession(opts);
 const first=(await phone.open('c1')).card,second=(await laptop.open('c1')).card;
 first.gross[0]=3;second.gross[0]=6;
 await phone.save(first);
 await assert.rejects(laptop.save(second),ScorecardConflictError);
 assert.deepEqual(remote.gross,[3,5]);assert.equal(writes,1);
});
