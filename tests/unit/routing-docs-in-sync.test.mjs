import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderBranchDoc } from '../../scripts/regen-routing-docs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

const BRANCHES = ['build', 'bug', 'refactor', 'spike', 'spec-author', 'ship', 'review'];

for (const branch of BRANCHES) {
  test(`.claude/routing/${branch}.md matches regen output`, () => {
    const committed = readFileSync(join(REPO_ROOT, '.claude', 'routing', `${branch}.md`), 'utf8');
    const expected = renderBranchDoc(branch);
    assert.equal(committed, expected,
      `\n${branch}.md is out of sync with route.mjs. Run: npm run regen-routing-docs`);
  });
}
