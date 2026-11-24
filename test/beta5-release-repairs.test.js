import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const group=fs.readFileSync(new URL('../src/GroupScoreScreen.jsx',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261124143000_repair_competition_participant_visibility.sql',import.meta.url),'utf8');

test('Foursomes and other shared-ball formats use their own handicap guidance',()=>{
  assert.match(group,/formatInformation\(c\.format/);
  assert.match(group,/<small>\{formatInfo\.handicap\}<\/small>/);
  assert.doesNotMatch(group,/Default scramble allowance/);
});

test('Individual Eclectic never renders the team-total block',()=>{
  assert.match(main,/c\.format !== "eclectic" && <TeamRoundTotals/);
});

test('participant visibility is read-only and limited to shared Group competition references',()=>{
  assert.match(migration,/ggc_can_read_competition_participant/);
  assert.match(migration,/competition\.data->'entries' \? p_player_id/);
  assert.match(migration,/playing_group->'playerIds' \? p_player_id/);
  assert.match(migration,/team->'memberIds' \? p_player_id/);
  assert.match(migration,/for select/);
  assert.doesNotMatch(migration,/for update|for insert|for delete/i);
});
