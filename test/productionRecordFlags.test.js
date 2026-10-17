import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
test('record reads can be enabled for live Supabase',()=>{assert.match(source,/const RECORD_READ_ENABLED=CLOUD&&import\.meta\.env\.VITE_GGC_RECORD_READ==='true'/);assert.doesNotMatch(source,/const RECORD_READ_ENABLED=IS_ISOLATED_TEST/)});
test('record writes require record reads',()=>{assert.match(source,/const RECORD_STORE_ENABLED=RECORD_READ_ENABLED&&import\.meta\.env\.VITE_GGC_RECORD_STORE==='true'/);assert.doesNotMatch(source,/const RECORD_STORE_ENABLED=IS_ISOLATED_TEST/)});
