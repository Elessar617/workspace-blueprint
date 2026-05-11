import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectTransition, mergeWithCache } from '../../scripts/route.mjs';

test('detectTransition fires on "now let\'s"', () => {
  assert.equal(detectTransition("now let's work on the auth piece"), true);
});

test('detectTransition fires on "switch to"', () => {
  assert.equal(detectTransition('switch to the python module'), true);
});

test('detectTransition fires on "actually,"', () => {
  assert.equal(detectTransition('actually, let me try the other approach'), true);
});

test('detectTransition does NOT fire on mid-task chatter', () => {
  assert.equal(detectTransition('yes do that'), false);
  assert.equal(detectTransition('ok'), false);
  assert.equal(detectTransition('explain more'), false);
});

test('mergeWithCache reuses cache when no transition', () => {
  const cache = { branch: 'build', agents: ['planner'], skills: [] };
  const fresh = { branch: 'build', agents: ['implementer'], skills: ['x'] };
  const result = mergeWithCache(cache, fresh, false);
  assert.deepEqual(result, cache);
});

test('mergeWithCache uses fresh when transition detected', () => {
  const cache = { branch: 'build', agents: ['planner'] };
  const fresh = { branch: 'bug', agents: ['implementer'] };
  const result = mergeWithCache(cache, fresh, true);
  assert.deepEqual(result, fresh);
});
