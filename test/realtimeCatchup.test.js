import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const start=main.indexOf("const channel=supabase.channel('ggc-records-live')");
const end=main.indexOf('},[auth?.access_token,profileReady]);',start);
const realtime=main.slice(start,end);

test('realtime notifications are retained across a cloud catch-up',()=>{
 assert.ok(start>=0&&end>start,'realtime subscription effect exists');
 assert.doesNotMatch(realtime,/pending\.clear\(\)/,'catch-up must never erase events received during fetch');
 assert.match(realtime,/finally\{busy=false;if\(active&&pending\.size\)void flush\(\)\}/,'pending events are retried after catch-up');
});
test('realtime notifications are only acknowledged after successful record acceptance',()=>{
 assert.match(main,/if\(!next\)break;[\s\S]*?pending\.delete\(key\)/);
});
test('incoming notification during catch-up remains available for replay',async()=>{
 const pending=new Map();
 let busy=true;
 const received=[];
 const flush=()=>{if(busy)return;for(const [key,value] of [...pending]){received.push(value);pending.delete(key)}};
 pending.set('cards:player2',{score:3});
 flush();
 assert.equal(received.length,0);
 assert.equal(pending.size,1);
 busy=false;
 if(pending.size)flush();
 assert.deepEqual(received,[{score:3}]);
 assert.equal(pending.size,0);
});

test('a newer event for the same scorecard is not acknowledged by an older fetch',()=>{
 const pending=new Map();
 const oldEvent={kind:'cards',id:'card1',version:10};
 pending.set('cards:card1',oldEvent);
 const inFlight=pending.get('cards:card1');
 const newerEvent={kind:'cards',id:'card1',version:11};
 pending.set('cards:card1',newerEvent);
 if(pending.get('cards:card1')===inFlight)pending.delete('cards:card1');
 assert.deepEqual(pending.get('cards:card1'),newerEvent);
});
test('realtime source uses identity check before acknowledging an event',()=>{
 assert.match(main,/if\(pending\.get\(key\)===change\)pending\.delete\(key\)/);
});
