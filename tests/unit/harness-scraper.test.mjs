import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scrapeHarness } from '../../scripts/lib/harness-scraper.mjs';

test('scrapeHarness stores portable plugin paths and keeps latest duplicate skill', () => {
  const root = mkdtempSync(join(tmpdir(), 'harness-'));
  const pluginsDir = join(root, 'plugins');
  mkdirSync(join(pluginsDir, 'market', 'superpowers', '5.0.7', 'skills', 'brainstorming'), { recursive: true });
  mkdirSync(join(pluginsDir, 'market', 'superpowers', '5.1.0', 'skills', 'brainstorming'), { recursive: true });

  const result = scrapeHarness({ root: pluginsDir, options: { settingsPaths: [] } });
  const skills = result.records.filter((r) => r.kind === 'skill');
  assert.equal(skills.length, 1);
  assert.equal(skills[0].name, 'brainstorming');
  assert.equal(skills[0].version, '5.1.0');
  assert.equal(skills[0].plugin_path, 'market/superpowers/5.1.0/skills/brainstorming');
  assert.equal(skills[0].plugin_path.startsWith('/'), false);

  rmSync(root, { recursive: true, force: true });
});

test('scrapeHarness reads MCPs from multiple settings files', () => {
  const root = mkdtempSync(join(tmpdir(), 'harness-'));
  const one = join(root, 'one.json');
  const two = join(root, 'two.json');
  writeFileSync(one, JSON.stringify({ mcpServers: { git: { command: 'npx' } } }));
  writeFileSync(two, JSON.stringify({ mcpServers: { fetch: { command: 'npx' } } }));

  const result = scrapeHarness({ root: join(root, 'missing'), options: { settingsPaths: [one, two] } });
  const mcps = result.records.filter((r) => r.kind === 'mcp');
  assert.deepEqual(mcps.map((item) => item.name).sort(), ['fetch', 'git']);

  rmSync(root, { recursive: true, force: true });
});
