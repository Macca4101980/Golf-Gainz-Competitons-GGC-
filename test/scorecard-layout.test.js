import test from 'node:test';
import assert from 'node:assert/strict';
import { teamBandLayout } from '../src/scorecardLayout.js';

test('paired scorecard team bands fit the selected golfers without implicit grid columns', () => {
  assert.deepEqual(teamBandLayout(2), { teamA: '2 / span 2', teamB: null });
  assert.deepEqual(teamBandLayout(3), { teamA: '2 / span 2', teamB: '4 / span 1' });
  assert.deepEqual(teamBandLayout(4), { teamA: '2 / span 2', teamB: '4 / span 2' });
});
