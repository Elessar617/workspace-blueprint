import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDetectScript, detectProjectDir } from '../../scripts/lib/detect-project-dir.mjs';

test('findDetectScript returns null when no plugin cache exists', () => {
  const result = findDetectScript({ pluginCacheRoot: '/nonexistent/path' });
  assert.equal(result, null);
});

test('detectProjectDir returns nulls when detect script not found', () => {
  const result = detectProjectDir({ pluginCacheRoot: '/nonexistent/path', cwd: '/tmp' });
  assert.equal(result.projectHash, null);
  assert.equal(result.projectDir, null);
});

test('detectProjectDir gracefully degrades on bash error', () => {
  const result = detectProjectDir({
    pluginCacheRoot: '/nonexistent/path',
    cwd: '/no/such/dir',
  });
  assert.equal(result.projectHash, null);
});
