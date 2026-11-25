import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');

test('temporary golfers only join the selected Group after the authoritative RPC succeeds',()=>{
 const save=main.slice(main.indexOf('async function saveNewGolfer'),main.indexOf('async function editUnclaimedGolfer'));
 assert.match(save,/await saveCloud\(playerState,setCloud,auth\.access_token\);setState\(playerState\);const result=await runGroupAction\('ggc_group_add_temporary_golfer'/);
 assert.match(save,/if\(result\.group&&onAuthoritativeGroup\)await onAuthoritativeGroup\(result\.group\)/);
 assert.doesNotMatch(save,/const next=\{\.\.\.state,players:\[\.\.\.state\.players,p\],societies:/);
 assert.doesNotMatch(save,/location\.reload/);
});

test('Group actions refresh authoritative membership in place and block repeated submissions',()=>{
 const groups=main.slice(main.indexOf('function GroupsPage'),main.indexOf('function SocietySwitchModal'));
 assert.match(groups,/if\(groupActionBusyRef\.current\)return false/);
 assert.match(groups,/onAuthoritativeGroup\(result\.group\)/);
 const action=groups.slice(groups.indexOf('async function confirmedGroupAction'),groups.indexOf('async function claimOwner'));
 assert.doesNotMatch(action,/location\.reload/);
 const modal=main.slice(main.indexOf('function SocietyModal'),main.indexOf('function winterLeagueCardHandicap'));
 assert.match(modal,/if\(!name\.trim\(\)\|\|busyRef\.current\)return/);
 assert.match(modal,/disabled=\{busy\}/);
 assert.doesNotMatch(modal,/location\.reload/);
});
