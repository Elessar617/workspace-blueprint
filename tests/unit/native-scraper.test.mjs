import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scrapeNative } from '../../scripts/lib/native-scraper.mjs';

test('scrapeNative indexes local agents, skills, rules, and project MCPs', () => {
  const root = mkdtempSync(join(tmpdir(), 'native-'));
  mkdirSync(join(root, '.claude', 'agents'), { recursive: true });
  mkdirSync(join(root, '.claude', 'skills', 'tdd-loop'), { recursive: true });
  mkdirSync(join(root, '.claude', 'rules'), { recursive: true });

  writeFileSync(join(root, '.claude', 'agents', 'reviewer-agent.md'),
    '---\ntools: Read, Bash, Grep\n---\n# Reviewer\n');
  writeFileSync(join(root, '.claude', 'skills', 'tdd-loop', 'SKILL.md'),
    '---\nname: tdd-loop\ndescription: TDD\n---\n# TDD\n');
  writeFileSync(join(root, '.claude', 'rules', 'testing-discipline.md'), '# Testing\n');
  writeFileSync(join(root, '.claude', 'settings.json'), JSON.stringify({
    mcpServers: {
      filesystem: { command: 'npx' },
    },
  }));

  const result = scrapeNative(root);
  const reviewer = result.find((item) => item.name === 'reviewer' && item.kind === 'agent');
  assert.ok(reviewer);
  assert.deepEqual(reviewer.tools, ['Read', 'Bash', 'Grep']);
  assert.ok(result.some((item) => item.name === 'tdd-loop' && item.kind === 'skill'));
  assert.ok(result.some((item) => item.name === 'testing-discipline' && item.kind === 'rule'));
  assert.ok(result.some((item) => item.name === 'filesystem' && item.kind === 'mcp'));

  rmSync(root, { recursive: true, force: true });
});
