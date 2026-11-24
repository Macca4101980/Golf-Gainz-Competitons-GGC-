import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');

test('Group visibility is controlled from each Settings Group card',()=>{
 assert.match(main,/className="settingsGroupVisibility"/);
 assert.match(main,/type="checkbox" checked=\{shown\}/);
 assert.match(main,/onChange=\{\(\)=>toggleGroupVisibility\(g\.id\)\}/);
 assert.match(main,/SHOW ON HOME/);
 assert.match(css,/\.settingsGroupVisibility input/);
});

test('My Golf no longer duplicates the Group visibility list',()=>{
 assert.doesNotMatch(main,/<h2>MY GROUPS<\/h2>/);
});
