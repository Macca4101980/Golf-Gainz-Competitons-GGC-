import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const script=new URL('../scripts/v4-migration-preflight.mjs',import.meta.url).pathname;
function run(data){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ggc-preflight-'));
 try {
  const file=path.join(dir,'snapshot.json');
  fs.writeFileSync(file,JSON.stringify(data));
  const result=spawnSync(process.execPath,[script,file],{encoding:'utf8'});
  return {status:result.status,report:JSON.parse(result.stdout)};
 } finally {fs.rmSync(dir,{recursive:true,force:true})}
}
test('clean migration snapshot passes without mutating its contents',()=>{
 const state={players:[{id:'a'}],societies:[{id:'g',members:['a'],admins:['a']}],comps:[{}],cards:[{}]};
 const before=JSON.stringify(state);
 const r=run(state);
 assert.equal(r.status,0);assert.equal(r.report.ready,true);assert.equal(JSON.stringify(state),before);
});
test('unknown membership fails closed and identifies group and golfer',()=>{
 const r=run({players:[{id:'a'}],societies:[{id:'g',members:['missing']}]});
 assert.equal(r.status,1);assert.deepEqual(r.report.issues,[{type:'unresolved_member',groupId:'g',golferId:'missing'}]);
});
test('duplicate golfer IDs fail',()=>{
 const r=run({players:[{id:'a'},{id:'a'}],societies:[]});
 assert.equal(r.status,1);assert.equal(r.report.issues[0].type,'duplicate_golfer_ids');
});
test('backup payload wrapper is supported',()=>{
 const r=run({payload:{players:[],societies:[],comps:[],cards:[]}});
 assert.equal(r.status,0);
});
