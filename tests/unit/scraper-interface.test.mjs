import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrapeEcc } from '../../scripts/lib/ecc-scraper.mjs';
import { scrapeHarness } from '../../scripts/lib/harness-scraper.mjs';
import { scrapeNative } from '../../scripts/lib/native-scraper.mjs';

const SCRAPERS = { scrapeEcc, scrapeHarness, scrapeNative };

test('all scrapers accept ({ root, options }) and return { records, sha? }', () => {
  for (const [name, fn] of Object.entries(SCRAPERS)) {
    const result = fn({ root: '/nonexistent-path-for-test', options: {} });
    assert.ok(typeof result === 'object', `${name} should return an object`);
    assert.ok(Array.isArray(result.records), `${name} should return result.records as array`);
  }
});
