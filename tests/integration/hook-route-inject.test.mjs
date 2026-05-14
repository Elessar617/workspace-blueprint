import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const HOOK = join(REPO_ROOT, '.claude', 'hooks', 'route-inject.sh');

function runHook(promptObj) {
  return spawnSync('bash', [HOOK], {
    cwd: REPO_ROOT,
    input: JSON.stringify(promptObj),
    encoding: 'utf8',
    timeout: 15000,
  });
}

test('hook returns JSON with additionalContext for build prompt', () => {
  const result = runHook({ prompt: 'add a rate limiter to the gateway' });
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.ok(payload.hookSpecificOutput.additionalContext.includes('branch: build'));
  assert.ok(payload.hookSpecificOutput.additionalContext.includes('REQUIRED-SKILLS: caveman, tdd-loop'));
});

test('hook detects Go language when prompt mentions a .go file path', () => {
  const result = runHook({ prompt: 'add rate limiter to src/gateway/rate_limit.go' });
  const payload = JSON.parse(result.stdout);
  assert.ok(payload.hookSpecificOutput.additionalContext.includes('languages: go'));
  assert.ok(payload.hookSpecificOutput.additionalContext.includes('golang-patterns'));
});

test('hook gracefully degrades when prompt is empty', () => {
  const result = runHook({ prompt: '' });
  assert.equal(result.status, 0);
});

test('hook handles review branch keyword', () => {
  const result = runHook({ prompt: 'act as reviewer and audit the routing code' });
  const payload = JSON.parse(result.stdout);
  assert.ok(payload.hookSpecificOutput.additionalContext.includes('branch: review'));
});

test('hook output includes active-instincts block', () => {
  const result = runHook({ prompt: 'add a rate limiter' });
  const payload = JSON.parse(result.stdout);
  assert.ok(payload.hookSpecificOutput.additionalContext.includes('active-instincts:'));
});
