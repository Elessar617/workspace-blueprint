import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { route } from '../../scripts/route.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(__dirname, '..', 'routing-cases');

const loadRegistry = () => {
  const dir = join(__dirname, '..', '..', '.claude', 'registry');
  const read = (f) => {
    try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); }
    catch { return []; }
  };
  return {
    agents: read('ecc-agents.json'),
    native: read('native-inventory.json'),
    skills: [...read('ecc-skills.json'), ...read('harness-skills.json')],
    commands: read('ecc-commands.json'),
    mcps: [...read('ecc-mcps.json'), ...read('harness-mcps.json')],
    builtins: read('harness-builtins.json'),
  };
};

const registry = loadRegistry();

for (const file of readdirSync(CASES_DIR)) {
  if (!file.endsWith('.json')) continue;
  const tc = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8'));
  test(`routing-case: ${tc.name}`, () => {
    const r = route({ ...tc.input, registry });
    if (tc.expected.branch) assert.equal(r.branch, tc.expected.branch, 'branch');
    if (tc.expected.hook_profile) assert.equal(r.hook_profile, tc.expected.hook_profile, 'hook_profile');
    if (tc.expected.languages_detected) {
      assert.deepEqual(r.languages_detected.sort(), tc.expected.languages_detected.sort(), 'languages');
    }
    if (tc.expected.languages_detected_must_include) {
      for (const lang of tc.expected.languages_detected_must_include) {
        assert.ok(r.languages_detected.includes(lang), `language missing: ${lang}`);
      }
    }
    // Under the new shape, language-specific items (e.g., go-reviewer, golang-patterns)
    // surface in r.hints rather than r.agents / r.skills. Check both locations so
    // existing routing-cases JSON files preserve their assertion intent.
    if (tc.expected.agents_must_include) {
      const hintNames = (r.hints || []).map((h) => h.name);
      const reachable = [...r.agents, ...hintNames];
      for (const a of tc.expected.agents_must_include) {
        assert.ok(reachable.includes(a), `agent missing: ${a}`);
      }
    }
    if (tc.expected.skills_must_include) {
      const hintNames = (r.hints || []).map((h) => h.name);
      const reachable = [...r.skills, ...hintNames];
      for (const s of tc.expected.skills_must_include) {
        assert.ok(reachable.includes(s), `skill missing: ${s}`);
      }
    }

    // Only project-configured items need to resolve via the local registry.
    // Plugin-discretionary items (e.g., exa, serena, context7 — surfaced as
    // mcps_plugin or as plugin-prefixed skills like "superpowers:foo") are
    // advisory hints and may be absent depending on which plugins are installed.
    const registryNames = new Set(Object.values(registry)
      .flat()
      .filter(Boolean)
      .map((item) => item.name));
    const stripPlugin = (name) => name.includes(':') ? name.split(':').pop() : name;
    const routedNames = [
      ...r.agents,
      ...r.skills.map(stripPlugin),
      ...(r.commands || []).map((cmd) => cmd.replace(/^\//, '')),
      ...(r.mcps_project || r.mcps),
    ];
    for (const name of routedNames) {
      assert.ok(registryNames.has(name), `routed item does not resolve: ${name}`);
    }
  });
}
