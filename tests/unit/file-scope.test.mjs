import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFileScope, WORKSPACE_ROOTS, EXTENSIONS } from '../../scripts/lib/file-scope.mjs';

test('extracts workspace-rooted paths from prompt', () => {
  const result = extractFileScope({
    prompt: 'fix the bug in src/gateway/rate_limit.go',
    gitStatusOutput: '',
    gitDiffOutput: '',
  });
  assert.deepEqual(result, ['src/gateway/rate_limit.go']);
});

test('extracts extension-bearing tokens', () => {
  const result = extractFileScope({
    prompt: 'update foo.py and bar.ts',
    gitStatusOutput: '',
    gitDiffOutput: '',
  });
  assert.deepEqual(result.sort(), ['bar.ts', 'foo.py']);
});

test('merges git status output', () => {
  const result = extractFileScope({
    prompt: '',
    gitStatusOutput: ' M src/foo.go\n?? tests/bar.test.mjs\n',
    gitDiffOutput: '',
  });
  assert.deepEqual(result.sort(), ['src/foo.go', 'tests/bar.test.mjs']);
});

test('merges git diff output', () => {
  const result = extractFileScope({
    prompt: '',
    gitStatusOutput: '',
    gitDiffOutput: 'src/router.mjs\ntests/router.test.mjs\n',
  });
  assert.deepEqual(result.sort(), ['src/router.mjs', 'tests/router.test.mjs']);
});

test('dedupes across sources', () => {
  const result = extractFileScope({
    prompt: 'fix src/foo.go',
    gitStatusOutput: ' M src/foo.go\n',
    gitDiffOutput: 'src/foo.go\n',
  });
  assert.deepEqual(result, ['src/foo.go']);
});

test('caps at 20 files', () => {
  const longList = Array.from({ length: 30 }, (_, i) => ` M src/file${i}.go`).join('\n');
  const result = extractFileScope({
    prompt: '',
    gitStatusOutput: longList,
    gitDiffOutput: '',
  });
  assert.equal(result.length, 20);
});

test('prompt paths are preserved before git-derived cap', () => {
  const longList = Array.from({ length: 30 }, (_, i) => ` M src/file${i}.go`).join('\n');
  const result = extractFileScope({
    prompt: 'review scripts/route.mjs',
    gitStatusOutput: longList,
    gitDiffOutput: '',
  });
  assert.equal(result[0], 'scripts/route.mjs');
  assert.equal(result.length, 20);
});

test('handles quoted paths with spaces', () => {
  const result = extractFileScope({
    prompt: 'fix "docs/my file.md"',
    gitStatusOutput: '',
    gitDiffOutput: '',
  });
  assert.deepEqual(result, ['docs/my file.md']);
});

test('handles parentheses and trailing punctuation', () => {
  const result = extractFileScope({
    prompt: 'fix docs/report(1).md and src/foo.go.',
    gitStatusOutput: '',
    gitDiffOutput: '',
  });
  assert.deepEqual(result, ['docs/report(1).md', 'src/foo.go']);
});

test('returns empty array on empty inputs', () => {
  const result = extractFileScope({ prompt: '', gitStatusOutput: '', gitDiffOutput: '' });
  assert.deepEqual(result, []);
});

test('handles prompt with no path-like tokens', () => {
  const result = extractFileScope({
    prompt: 'tell me about the project',
    gitStatusOutput: '',
    gitDiffOutput: '',
  });
  assert.deepEqual(result, []);
});

test('exports WORKSPACE_ROOTS and EXTENSIONS for consumers', () => {
  assert.ok(WORKSPACE_ROOTS.includes('src'));
  assert.ok(EXTENSIONS.includes('go'));
});
