import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readInstincts, parseInstinctFile, extractAction } from '../../scripts/lib/instinct-reader.mjs';

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'instinct-test-'));
  const projectInstincts = join(root, 'projects', 'abc123def456', 'instincts', 'personal');
  const globalInstincts = join(root, 'instincts', 'personal');
  mkdirSync(projectInstincts, { recursive: true });
  mkdirSync(globalInstincts, { recursive: true });
  return { root, projectInstincts, globalInstincts };
}

test('parseInstinctFile extracts frontmatter and action', () => {
  const content = `---
id: prefer-functional
confidence: 0.8
scope: project
domain: code-style
---

# Prefer Functional

## Action
Use functional patterns over classes when appropriate.

## Evidence
Observed 5 times.
`;
  const result = parseInstinctFile(content);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'prefer-functional');
  assert.equal(result[0].confidence, 0.8);
  assert.equal(result[0].scope, 'project');
});

test('extractAction returns first non-empty line of ## Action', () => {
  const content = '## Action\n\nUse explicit error types.\n\nDo not swallow errors.\n';
  assert.equal(extractAction(content), 'Use explicit error types.');
});

test('extractAction returns empty string when no ## Action section', () => {
  assert.equal(extractAction('# Title\n\nSome body.'), '');
});

test('readInstincts filters by confidence threshold', () => {
  const { root, globalInstincts } = makeFixture();
  try {
    writeFileSync(join(globalInstincts, 'low.yaml'),
      '---\nid: low-conf\nconfidence: 0.5\n---\n\n## Action\nLow confidence action.\n');
    writeFileSync(join(globalInstincts, 'high.yaml'),
      '---\nid: high-conf\nconfidence: 0.9\n---\n\n## Action\nHigh confidence action.\n');

    const result = readInstincts({
      xdgDataHome: root,
      projectHash: 'abc123def456',
      maxCount: 6,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'high-conf');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readInstincts dedupes by id with project winning over global', () => {
  const { root, projectInstincts, globalInstincts } = makeFixture();
  try {
    writeFileSync(join(globalInstincts, 'shared.yaml'),
      '---\nid: shared\nconfidence: 0.85\nscope: global\n---\n\n## Action\nGlobal version.\n');
    writeFileSync(join(projectInstincts, 'shared.yaml'),
      '---\nid: shared\nconfidence: 0.75\nscope: project\n---\n\n## Action\nProject version.\n');

    const result = readInstincts({
      xdgDataHome: root,
      projectHash: 'abc123def456',
      maxCount: 6,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0]._scope, 'project');
    assert.equal(result[0].action, 'Project version.');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readInstincts sorts by confidence DESC and caps at maxCount', () => {
  const { root, globalInstincts } = makeFixture();
  try {
    for (let i = 0; i < 10; i += 1) {
      const conf = 0.7 + i * 0.02;
      writeFileSync(
        join(globalInstincts, `i${i}.yaml`),
        `---\nid: i${i}\nconfidence: ${conf}\n---\n\n## Action\nAction ${i}.\n`,
      );
    }

    const result = readInstincts({
      xdgDataHome: root,
      projectHash: 'no-such-hash',
      maxCount: 3,
    });

    assert.equal(result.length, 3);
    assert.ok(result[0].confidence >= result[1].confidence);
    assert.ok(result[1].confidence >= result[2].confidence);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readInstincts returns empty array when xdg dir missing', () => {
  const result = readInstincts({
    xdgDataHome: '/nonexistent/path',
    projectHash: 'no-such-hash',
    maxCount: 6,
  });
  assert.deepEqual(result, []);
});

test('readInstincts skips unparseable files gracefully', () => {
  const { root, globalInstincts } = makeFixture();
  try {
    writeFileSync(join(globalInstincts, 'bad.yaml'), 'not valid yaml frontmatter at all');
    writeFileSync(join(globalInstincts, 'good.yaml'),
      '---\nid: good\nconfidence: 0.8\n---\n\n## Action\nGood.\n');

    const result = readInstincts({
      xdgDataHome: root,
      projectHash: 'no-such-hash',
      maxCount: 6,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'good');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
