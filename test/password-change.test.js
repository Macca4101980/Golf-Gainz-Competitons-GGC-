import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePasswordChange} from '../src/passwordChange.js';

test('password changes require at least 12 characters',()=>{
 assert.equal(validatePasswordChange('short','short'),'Use at least 12 characters.');
});

test('password changes require matching values',()=>{
 assert.equal(validatePasswordChange('twelve-chars!','different-value'),'Passwords do not match.');
});

test('a matching 12-character password is accepted',()=>{
 assert.equal(validatePasswordChange('twelve-chars!','twelve-chars!'),'');
});
