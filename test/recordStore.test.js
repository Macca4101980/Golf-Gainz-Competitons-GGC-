import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordStore} from '../src/recordStore.js';

function fakeDb(){
 const records=new Map();
 const api={
  from(){
   return {
    select(){
     return {
      eq(_field,kind){
       return {
        eq(_field2,id){
         return {
          async maybeSingle(){
           const row=records.get(kind+':'+id);
           return {data:row?{...row}:null,error:null};
          }
         };
        }
       };
      }
     };
    }
   };
  },
  async rpc(_name,args){
   const k=args.p_kind+':'+args.p_id,old=records.get(k);
   if((old?.version??null)!==args.p_expected_version)return {data:null,error:{message:'GGC_VERSION_CONFLICT'}};
   const version=(old?.version??0)+1;
   records.set(k,{data:args.p_data,version,deleted:args.p_deleted});
   return {data:version,error:null};
  }
 };
 return api;
}
test('different records save independently',async()=>{
 const db=fakeDb(),a=createRecordStore(db),b=createRecordStore(db);
 await a.load('players','one');
 await a.save('players','one',{hi:9});
 await b.load('players','two');
 await b.save('players','two',{hi:12});
 assert.deepEqual(await a.load('players','two'),{hi:12});
 assert.deepEqual(await b.load('players','one'),{hi:9});
});
test('stale same-record writes are rejected',async()=>{
 const db=fakeDb(),a=createRecordStore(db),b=createRecordStore(db);
 await a.save('players','one',{hi:9});
 await b.load('players','one');
 await a.save('players','one',{hi:8});
 await assert.rejects(b.save('players','one',{hi:11}),/GGC_VERSION_CONFLICT/);
 assert.deepEqual(await a.load('players','one'),{hi:8});
});
test('deletion marker blocks stale resurrection',async()=>{
 const db=fakeDb(),a=createRecordStore(db),b=createRecordStore(db);
 await a.load('players','old');
 await a.save('players','old',{name:'old'});
 await b.load('players','old');
 await a.save('players','old',{name:'old'},{deleted:true});
 await assert.rejects(b.save('players','old',{name:'old'}),/GGC_VERSION_CONFLICT/);
 assert.equal(await b.load('players','old'),null);
});

test('parallel saves for the same record use successive versions',async()=>{
 const db=fakeDb(),store=createRecordStore(db);
 await store.load('cards','round-1');
 const versions=await Promise.all([
  store.save('cards','round-1',{score:36}),
  store.save('cards','round-1',{score:37}),
  store.save('cards','round-1',{score:38})
 ]);
 assert.deepEqual(versions,[1,2,3]);
 assert.deepEqual(await store.load('cards','round-1'),{score:38});
});
test('a failed stale write invalidates the local record version',async()=>{
 const db=fakeDb(),a=createRecordStore(db),b=createRecordStore(db);
 await a.load('cards','round-2');
 await a.save('cards','round-2',{score:36});
 await b.load('cards','round-2');
 await a.save('cards','round-2',{score:40});
 await assert.rejects(b.save('cards','round-2',{score:30}),/GGC_VERSION_CONFLICT/);
 assert.equal(b.getVersion('cards','round-2'),null);
 await b.load('cards','round-2');
 assert.equal(b.getVersion('cards','round-2'),2);
});
test('records with different IDs save independently',async()=>{
 const db=fakeDb(),store=createRecordStore(db);
 await Promise.all([store.load('cards','player-a'),store.load('cards','player-b')]);
 await Promise.all([
  store.save('cards','player-a',{score:32}),
  store.save('cards','player-b',{score:41})
 ]);
 assert.deepEqual(await store.load('cards','player-a'),{score:32});
 assert.deepEqual(await store.load('cards','player-b'),{score:41});
});

test('an in-flight stale load cannot replace a version after a concurrent save',async()=>{
 const db=fakeDb(),store=createRecordStore(db);
 await store.load('cards','round-race');
 await store.save('cards','round-race',{score:30});
 const originalFrom=db.from.bind(db);
 let releaseRead,readStarted;
 const started=new Promise(resolve=>{readStarted=resolve;});
 const release=new Promise(resolve=>{releaseRead=resolve;});
 db.from=(table)=>{
  const query=originalFrom(table);
  return {select(...args){
   const selection=query.select(...args);
   return {eq(field,kind){
    const byKind=selection.eq(field,kind);
    return {eq(field2,id){
     const byId=byKind.eq(field2,id);
     return {async maybeSingle(){
      const result=await byId.maybeSingle();
      readStarted();
      await release;
      return result;
     }};
    }};
   }};
  }};
 };
 const staleLoad=store.load('cards','round-race');
 await started;
 await store.save('cards','round-race',{score:40});
 releaseRead();
 await assert.rejects(staleLoad,/GGC_STALE_RECORD_LOAD/);
 assert.equal(store.getVersion('cards','round-race'),2);
 db.from=originalFrom;
 assert.deepEqual(await store.load('cards','round-race'),{score:40});
});

test('network exception during retrieval invalidates a previously cached version',async()=>{
 const db=fakeDb(),store=createRecordStore(db);
 await store.load('cards','network');
 await store.save('cards','network',{score:35});
 await store.load('cards','network');
 assert.equal(store.getVersion('cards','network'),1);
 db.from=()=>{throw Error('connection dropped')};
 await assert.rejects(store.load('cards','network'),/connection dropped/);
 assert.equal(store.getVersion('cards','network'),null);
});

test('retrieved version baselines allow safe updates to existing records',async()=>{
 const db=fakeDb(),first=createRecordStore(db),second=createRecordStore(db);
 await first.load('cards','existing');
 await first.save('cards','existing',{points:36});
 second.seedVersions([{kind:'cards',id:'existing',version:1}]);
 assert.equal(await second.save('cards','existing',{points:39}),2);
 assert.deepEqual(await first.load('cards','existing'),{points:39});
});
test('stale seeded version rejects overwrite',async()=>{
 const db=fakeDb(),first=createRecordStore(db),second=createRecordStore(db);
 await first.save('cards','existing',{points:36});
 second.seedVersions([{kind:'cards',id:'existing',version:1}]);
 await first.save('cards','existing',{points:42});
 await assert.rejects(second.save('cards','existing',{points:31}),/GGC_VERSION_CONFLICT/);
});
test('seeding invalid versions does not discard existing versions',async()=>{
 const db=fakeDb(),store=createRecordStore(db);
 await store.load('cards','one');
 await store.save('cards','one',{points:36});
 assert.throws(()=>store.seedVersions([{kind:'cards',id:'one',version:0}]),/GGC_INVALID_RECORD_VERSION/);
 assert.equal(store.getVersion('cards','one'),1);
});
