import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditProtection,reconcileRecord} from '../src/editProtection.js';

test('incoming cloud update to another field survives an active local edit',()=>{
 const edit=createEditProtection();
 edit.begin('players','hooky',{id:'hooky',email:null,hi:12});
 edit.update('players','hooky',{id:'hooky',email:'richard-hook@live.co.uk',hi:12});
 const received=edit.receive('players','hooky',{id:'hooky',email:null,hi:11});
 assert.equal(received.merged.email,'richard-hook@live.co.uk');
 assert.equal(received.merged.hi,11);
 assert.deepEqual(received.conflicts,[]);
 assert.deepEqual(edit.pending('players','hooky').fields,['email']);
});

test('concurrent edit of same field is reported, not silently overwritten',()=>{
 const result=reconcileRecord({baseline:{email:null},local:{email:'mine@example.com'},remote:{email:'theirs@example.com'},dirtyFields:['email']});
 assert.deepEqual(result.conflicts,['email']);
 assert.equal(result.merged.email,'mine@example.com');
});

test('failed save keeps edits protected until confirmed',()=>{
 const edit=createEditProtection();
 edit.begin('cards','c1',{id:'c1',scores:[4,5]});
 edit.update('cards','c1',{id:'c1',scores:[4,4]});
 edit.markSaving('cards','c1',true);
 edit.markSaving('cards','c1',false);
 assert.deepEqual(edit.pending('cards','c1').fields,['scores']);
 edit.confirm('cards','c1',{id:'c1',scores:[4,4]});
 assert.equal(edit.pending('cards','c1'),null);
});

test('remote update to a dirty field is protected after a second refresh',()=>{
 const edit=createEditProtection();
 edit.begin('cards','c1',{id:'c1',score:4,notes:''});
 edit.update('cards','c1',{id:'c1',score:3,notes:''});
 const first=edit.receive('cards','c1',{id:'c1',score:4,notes:'cloud'});
 assert.equal(first.merged.score,3);
 assert.deepEqual(edit.pending('cards','c1').fields,['score']);
 const second=edit.receive('cards','c1',{id:'c1',score:5,notes:'cloud'});
 assert.deepEqual(second.conflicts,['score']);
 assert.equal(second.merged.score,3);
});

test('save acknowledgement cannot erase edits made while save was in flight',()=>{
 const edit=createEditProtection();
 edit.begin('cards','c1',{id:'c1',score:4});
 edit.update('cards','c1',{id:'c1',score:3});
 edit.markSaving('cards','c1',true);
 edit.update('cards','c1',{id:'c1',score:2});
 edit.confirm('cards','c1',{id:'c1',score:3});
 assert.equal(edit.pending('cards','c1').local.score,2);
 assert.deepEqual(edit.pending('cards','c1').fields,['score']);
});
