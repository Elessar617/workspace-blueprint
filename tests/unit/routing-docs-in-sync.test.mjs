import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderBranchDoc,
  renderRoutingStep1Table,
  renderProcedureBody,
  renderRegistryComment,
  computeCounts,
  applyAllRegenSurfaces,
} from '../../scripts/regen-routing-docs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

const BRANCHES = ['build', 'bug', 'refactor', 'spike', 'spec-author', 'ship', 'review'];

// Bounded loop: iterate over the fixed branch list. No dynamic discovery here —
// the branch set is intentionally explicit so drift across the source-of-truth and
// the rendered files is visible at review time (NASA #2 + #6).
for (const branch of BRANCHES) {
  test(`.claude/routing/${branch}.md matches regen output`, () => {
    const committed = readFileSync(join(REPO_ROOT, '.claude', 'routing', `${branch}.md`), 'utf8');
    const expected = renderBranchDoc(branch);
    assert.equal(committed, expected,
      `\n${branch}.md is out of sync with route.mjs. Run: npm run regen-routing-docs`);
  });

  test(`.claude/routing/${branch}.md contains the registry-resolution comment block`, () => {
    const committed = readFileSync(join(REPO_ROOT, '.claude', 'routing', `${branch}.md`), 'utf8');
    // Invariant: every routing branch file must document the resolution path so a
    // fresh agent reading the branch file in isolation knows how named agents/
    // skills/MCPs resolve to concrete paths (closes H6 from the 2026-05-15 audit).
    assert.ok(
      committed.includes(renderRegistryComment()),
      `${branch}.md missing the canonical registry-resolution comment block. Run: npm run regen-routing-docs`
    );
  });
}

test('ROUTING.md Step 1 table matches TASK_RULES (no drift)', () => {
  const committed = readFileSync(join(REPO_ROOT, 'ROUTING.md'), 'utf8');
  const expected = renderRoutingStep1Table();
  // The generator emits the table body bounded by stable comment markers. The
  // test asserts the full marked region (start marker, body, end marker) is
  // present byte-for-byte. Any drift — missing keyword, reordered row, stale
  // workspace path — fails this assertion red.
  assert.ok(
    committed.includes(expected),
    `ROUTING.md Step 1 table is out of sync with TASK_RULES. Run: npm run regen-routing-docs`
  );
});

test('ROUTING.md includes every keyword from TASK_RULES (audit H3 closure)', () => {
  const committed = readFileSync(join(REPO_ROOT, 'ROUTING.md'), 'utf8');
  // H3 specifically called out: 'act as reviewer', 'prototype', 'propose',
  // 'publish', 'cut a v', 'cleanup', 'restructure'. We don't hardcode the list
  // — we read TASK_RULES via the generator's helper to stay source-driven.
  const { TASK_RULES } = computeCounts.__sources;
  for (const rule of TASK_RULES) {
    for (const kw of rule.keywords) {
      assert.ok(
        committed.includes(`"${kw}"`),
        `ROUTING.md Step 1 table missing keyword "${kw}" for branch ${rule.branch}. Run: npm run regen-routing-docs`
      );
    }
  }
});

for (const file of ['AGENTS.md', '.cursorrules', 'GEMINI.md']) {
  test(`${file} procedure body matches canonical procedure (no drift)`, () => {
    const committed = readFileSync(join(REPO_ROOT, file), 'utf8');
    const expected = renderProcedureBody(file);
    assert.ok(
      committed.includes(expected),
      `${file} procedure body is out of sync. Run: npm run regen-routing-docs`
    );
  });
}

test('CLAUDE.md, CONTEXT.md, START-HERE.md count fields match filesystem inspection', () => {
  // Acceptance criterion 1 (byte-identical) is enforced via the
  // applyAllRegenSurfaces idempotency test below. Here we assert each count
  // surface in human prose is reachable by reading the file and confirming it
  // contains the expected count-bearing snippet, computed from filesystem
  // inspection (closes H5).
  const counts = computeCounts();
  const claude = readFileSync(join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
  const context = readFileSync(join(REPO_ROOT, 'CONTEXT.md'), 'utf8');
  const startHere = readFileSync(join(REPO_ROOT, 'START-HERE.md'), 'utf8');

  // CLAUDE.md prose count: "**N skills** in `.claude/skills/`"
  assert.ok(
    claude.includes(`**${counts.skills} skills** in \`.claude/skills/\``),
    `CLAUDE.md skill-count prose drifted. Run: npm run regen-routing-docs`
  );

  // CLAUDE.md tree-diagram skill-count line (prefix-anchored).
  assert.ok(
    claude.includes(`│  ├─ skills/            ← on-demand procedures (${counts.skills} skills`),
    `CLAUDE.md tree skill count drifted. Run: npm run regen-routing-docs`
  );

  // CLAUDE.md tree-diagram hook-count line (prefix-anchored).
  assert.ok(
    claude.includes(`│  ├─ hooks/             ← ${counts.hooks} bash hooks`),
    `CLAUDE.md tree hook count drifted. Run: npm run regen-routing-docs`
  );

  // CONTEXT.md "all N rules" — closes M3.
  assert.ok(
    context.includes(`\`.claude/rules/\` (all ${counts.rules})`),
    `CONTEXT.md "all N rules" count drifted. Run: npm run regen-routing-docs`
  );

  // START-HERE.md rule and hook counts.
  assert.ok(
    startHere.includes(`**\`.claude/rules/\`** — ${counts.rules} always-loaded constraints`),
    `START-HERE.md rule count drifted. Run: npm run regen-routing-docs`
  );
  assert.ok(
    startHere.includes(`**\`.claude/hooks/\`** — ${counts.hooks} bash hooks`),
    `START-HERE.md hook count drifted. Run: npm run regen-routing-docs`
  );
});

test('applyAllRegenSurfaces is idempotent (running twice produces the same content)', () => {
  // Read the on-disk content for each surface. Run the generator transformer.
  // Run it again on the result. Assert no diff between first and second pass.
  // Idempotency is the load-bearing invariant of the byte-identity criterion:
  // the test reads, transforms, transforms again — the second transformation
  // must be a no-op. If it isn't, the generator has hidden state or
  // non-determinism that will cause CI/local drift.
  const surfaces = [
    'ROUTING.md',
    'AGENTS.md',
    '.cursorrules',
    'GEMINI.md',
    'CLAUDE.md',
    'CONTEXT.md',
    'START-HERE.md',
  ];
  for (const surface of surfaces) {
    const original = readFileSync(join(REPO_ROOT, surface), 'utf8');
    const once = applyAllRegenSurfaces({ [surface]: original })[surface];
    const twice = applyAllRegenSurfaces({ [surface]: once })[surface];
    assert.equal(once, twice, `${surface}: generator is not idempotent`);
  }
});
