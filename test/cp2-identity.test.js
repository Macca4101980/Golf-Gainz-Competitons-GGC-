import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';const src=fs.readFileSync(new URL('../src/CompetitionGroups.jsx',import.meta.url),'utf8');const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');test('CP2 placeholder supports optional email and visible status',()=>{assert.match(main,/Email \(optional\)/);assert.match(main,/emailVerified:false/);assert.match(main,/membershipStatus:'not-invited'/);assert.match(main,/GGC MEMBER/);assert.match(main,/INVITE SENT/);assert.match(main,/NOT INVITED/);assert.match(main,/verified GGC account/)});

test('CP2 Group owns creation and editing of unclaimed golfers',()=>{
  const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
  assert.match(main,/ADD NEW GOLFER/);
  assert.match(main,/function saveNewGolfer/);
  assert.match(main,/function editUnclaimedGolfer/);
  assert.match(main,/EDIT GOLFER/);
  assert.match(main,/p\.authUserId\?'GGC MEMBER':p\.membershipStatus==='invite-sent'\?'INVITE SENT':'NOT INVITED'/);
});

test('CP2 Invite Existing Golfer only lists claimed GGC identities',()=>{
  const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
  assert.match(main,/!!p\.authUserId&&!p\.unclaimed&&!p\.placeholder&&!p\.guest/);
});

test('CP2 League no longer creates duplicate golfers',()=>{
  const leagues=fs.readFileSync(new URL('../src/CompetitionGroups.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(leagues,/<h3>GOLFERS<\/h3>/);
  assert.doesNotMatch(leagues,/>\+ ADD GOLFER<\/button>/);
  assert.match(leagues,/league\.memberIds\?\.includes\(p\.id\)\?'IN LEAGUE':'ADD'/);
});
