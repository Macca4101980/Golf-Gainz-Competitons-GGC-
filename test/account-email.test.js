import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const component=readFileSync(new URL('../src/EmailAddressSettings.jsx',import.meta.url),'utf8'),main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
test('signed-in golfer can request a verified account email change',()=>{assert.match(component,/auth\.updateUser\(\{email:next\}/);assert.match(component,/emailRedirectTo/);assert.match(component,/current email remains active until the change is verified/i);assert.match(main,/EmailAddressSettings/)});
