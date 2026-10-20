import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseSync} from 'rolldown/utils';

test('stateful screens have stable component identities across App renders',()=>{
 const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 const parsed=parseSync('main.jsx',source,{lang:'jsx'});
 assert.deepEqual(parsed.errors,[]);
 const moduleFunctions=new Set(parsed.program.body.filter(n=>n.type==='FunctionDeclaration').map(n=>n.id.name));
 for(const name of ['ScoreScreen','CompModal','GroupsPage','SettingsHub','CourseLibrary','Admin']){
  assert.ok(moduleFunctions.has(name),`${name} must not be recreated inside App on every score/save render`);
 }
 const app=parsed.program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='App');
 assert.deepEqual(app.body.body.filter(n=>n.type==='FunctionDeclaration'&&/^[A-Z]/.test(n.id.name)).map(n=>n.id.name),[]);
});
