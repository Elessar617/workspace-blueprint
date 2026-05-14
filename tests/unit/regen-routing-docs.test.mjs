import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBranchDoc } from '../../scripts/regen-routing-docs.mjs';

test('renderBranchDoc emits markdown for build branch', () => {
  const md = renderBranchDoc('build');
  assert.ok(md.includes('# Routing Branch: Build'));
  assert.ok(md.includes('tdd-loop'));
  assert.ok(md.includes('karpathy-guidelines'));
  assert.ok(md.includes('Hook profile: `standard`'));
});

test('renderBranchDoc emits markdown for review branch', () => {
  const md = renderBranchDoc('review');
  assert.ok(md.includes('# Routing Branch: Review'));
  assert.ok(md.includes('superpowers:requesting-code-review'));
});

test('renderBranchDoc emits markdown for spike branch', () => {
  const md = renderBranchDoc('spike');
  assert.ok(md.includes('spike-protocol'));
  assert.ok(md.includes('Hook profile: `minimal`'));
});
