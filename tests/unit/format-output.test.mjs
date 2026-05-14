import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatOutput } from '../../scripts/lib/format-output.mjs';

const SAMPLE_RESULT = {
  branch: 'build',
  hook_profile: 'standard',
  workspace: 'src/',
  mandatories: ['tdd-loop', 'karpathy-guidelines'],
  agents: ['planner', 'implementer', 'reviewer', 'adversary'],
  mcps_project: ['filesystem', 'git'],
  mcps_plugin: ['serena', 'context7'],
  signals: {
    files: ['src/gateway/rate_limit.go', 'src/gateway/rate_limit_test.go'],
    languages: ['go'],
    recent_edits: ['src/gateway/router.go'],
    workspace: 'src/',
    active_rules: ['all'],
  },
  instincts: [
    { id: 'tdd-go', confidence: 0.85, _scope: 'project', action: 'write tests first for go services' },
    { id: 'grep-edit', confidence: 0.78, _scope: 'global', action: 'grep before edit' },
  ],
  hints: [
    { name: 'golang-patterns', reason: 'language=go' },
  ],
};

test('formatOutput includes authoritative header', () => {
  const text = formatOutput(SAMPLE_RESULT);
  assert.ok(text.includes('ROUTING (authoritative)'));
  assert.ok(text.includes('You MUST invoke each REQUIRED skill'));
});

test('formatOutput includes branch summary line', () => {
  const text = formatOutput(SAMPLE_RESULT);
  assert.ok(text.includes('branch: build'));
  assert.ok(text.includes('profile: standard'));
});

test('formatOutput lists REQUIRED-SKILLS', () => {
  const text = formatOutput(SAMPLE_RESULT);
  assert.ok(text.includes('REQUIRED-SKILLS: tdd-loop, karpathy-guidelines'));
});

test('formatOutput shows REQUIRED-SKILLS: (none) when empty', () => {
  const text = formatOutput({ ...SAMPLE_RESULT, mandatories: [] });
  assert.ok(text.includes('REQUIRED-SKILLS: (none)'));
});

test('formatOutput shows files: (none) when no file scope', () => {
  const text = formatOutput({
    ...SAMPLE_RESULT,
    signals: { ...SAMPLE_RESULT.signals, files: [] },
  });
  assert.ok(text.includes('files: (none)'));
});

test('formatOutput shows active-instincts block with scope + confidence', () => {
  const text = formatOutput(SAMPLE_RESULT);
  assert.ok(text.includes('active-instincts:'));
  assert.ok(text.includes('[project 0.85] write tests first for go services'));
  assert.ok(text.includes('[global 0.78] grep before edit'));
});

test('formatOutput shows (none) when instincts empty', () => {
  const text = formatOutput({ ...SAMPLE_RESULT, instincts: [] });
  assert.ok(text.includes('(none)'));
});

test('formatOutput lists HINTS with reasons', () => {
  const text = formatOutput(SAMPLE_RESULT);
  assert.ok(text.includes('HINTS'));
  assert.ok(text.includes('golang-patterns (signaled by language=go)'));
});

test('formatOutput stays under 750 tokens for typical inputs', () => {
  const text = formatOutput(SAMPLE_RESULT);
  // ~4 chars per token rough estimate; 750 tokens ≈ 3000 chars.
  assert.ok(text.length < 3000, `Output is ${text.length} chars, exceeds 750-token budget`);
});

test('formatOutput uses (none) for missing MCP lists', () => {
  const text = formatOutput({ ...SAMPLE_RESULT, mcps_project: [], mcps_plugin: [] });
  assert.ok(text.includes('MCPs (project-configured): (none)'));
  assert.ok(text.includes('MCPs (plugin-available): (none)'));
});
