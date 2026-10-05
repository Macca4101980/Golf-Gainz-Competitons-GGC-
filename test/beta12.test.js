import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
test('Beta.12 scheduled cards show go-live time and competition edits are timestamped',()=>{assert.match(main,/Goes live:/);assert.match(main,/status,updatedAt:new Date\(\)\.toISOString\(\)/)});
test('Beta.12 normal members cannot manage competitions or advanced Group settings',()=>{assert.match(main,/const canEdit=admin;/);assert.match(main,/society&&admin&&/);assert.match(main,/adminGroupIds\.has\(editComp\.societyId\)/)});
test('Beta.12 pending Group invitations are shown on Home',()=>{assert.match(main,/pendingGroupInvites/);assert.match(main,/GROUP INVITATIONS/);assert.match(main,/respondGroupInvite\(inv,true\)/)});
test('Beta.12 Add Golfer draft survives a Groups remount',()=>{assert.match(main,/ggc-add-golfer-draft/);assert.match(main,/sessionStorage\.setItem\(golferDraftKey/);assert.match(main,/sessionStorage\.removeItem\(golferDraftKey\)/)});
test('Beta.12 competition groups are collapsible',()=>{assert.match(main,/groupCompTwirl/);assert.match(main,/open=\{s\.id===society\?\.id\}/)});
test('Beta.12 Group and Access no longer renders course management',()=>{assert.doesNotMatch(main,/return <><Title t="Settings"\/><h2>COURSES<\/h2>/)});
