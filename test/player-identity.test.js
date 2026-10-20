import test from 'node:test';
import assert from 'node:assert/strict';
import {hydrateSignedInPlayer} from '../src/playerIdentity.js';

test('sign-in preserves the stable player ID used by Groups and League teams',()=>{
 const authId='8df86c2d-1def-469d-8609-5284a25701bd';
 const stableId='wl-matt-whitbread';
 const players=[{id:stableId,name:'Matt Whitbread',hi:12,authUserId:authId}];
 const profile={id:authId,display_name:'Matt Whitbread',handicap_index:13.8,passkey_enabled:false};
 const {player,players:hydrated}=hydrateSignedInPlayer(players,profile);
 const group={members:[stableId]};
 const team={memberIds:[stableId,'wl-kev-collins']};
 assert.equal(player.id,stableId);
 assert.equal(hydrated[0].id,stableId);
 assert.equal(hydrated[0].hi,13.8);
 assert.ok(group.members.includes(player.id));
 assert.ok(team.memberIds.includes(player.id));
});

test('a first-time account still creates a player with its account ID',()=>{
 const profile={id:'new-account',display_name:'New Golfer',handicap_index:9.4,passkey_enabled:true};
 const {player,players}=hydrateSignedInPlayer([],profile);
 assert.equal(player.id,'new-account');
 assert.equal(players[0].authUserId,'new-account');
 assert.equal(players[0].passkeyEnabled,true);
});

test('prefers a stable linked player when an auth-id duplicate appears first',()=>{
 const profile={id:'auth-123',display_name:'Tink',handicap_index:12.4,passkey_enabled:false};
 const players=[
  {id:'auth-123',authUserId:'auth-123',name:'Tink'},
  {id:'wl-tink',authUserId:'auth-123',name:'Tink'},
 ];
 const {player}=hydrateSignedInPlayer(players,profile);
 assert.equal(player.id,'wl-tink');
});

test('uses the explicit identity link when several linked records exist',()=>{
 const profile={id:'auth-123',display_name:'Player',handicap_index:7,passkey_enabled:false};
 const players=[
  {id:'older-player',authUserId:'auth-123',name:'Player'},
  {id:'current-player',authUserId:'auth-123',name:'Player'},
 ];
 const {player}=hydrateSignedInPlayer(players,profile,{'auth-123':'current-player'});
 assert.equal(player.id,'current-player');
});
