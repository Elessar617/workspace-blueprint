import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

// Audit files parsed for [CHMLN]\d+ finding IDs (agent-architecture audit's
// numbering convention). The architecture-deepening audit uses bare "### 1./2./..."
// numbered headings and is NOT parsed here; its 5 candidates are tracked by
// inspection. Each gets a "**Status:** open" line in its body that flips to
// "**Status:** closed (<sha>)" when its work lands; visual inspection is the
// enforcement until a future test enrichment.
const AUDITS = [
  'docs/audit/2026-05-15-agent-architecture-audit.md',
];
const OPTIONAL_AUDIT = 'docs/audit/2026-05-15-security-audit.md';

function parseFindings(content) {
  const findings = [];

  // Prose-format findings: "#### C1 — ..." or "#### Finding C1 ..." style.
  const headingRe = /^####?\s+(?:Finding\s+)?([CHMLN]\d+)\b/gm;
  const matches = [...content.matchAll(headingRe)].map(m => ({ id: m[1], start: m.index }));
  for (let i = 0; i < matches.length; i++) {
    const sectionStart = matches[i].start;
    const sectionEnd = i + 1 < matches.length ? matches[i + 1].start : content.length;
    const section = content.slice(sectionStart, sectionEnd);
    const statusMatch = section.match(/\*\*Status:\*\*\s+([^\n|]+)/);
    findings.push({ id: matches[i].id, status: statusMatch ? statusMatch[1].trim() : null });
  }

  // Table-row findings (Medium, Low, Negative tables): rows like
  // "| M5 (`F8.2`) | ... | **Status:** open |" or "| N1 (`F11.1`) | ... | closed-by-absence |"
  const tableRowRe = /^\|\s*(M\d+|L\d+|N\d+)\s*(?:\(`|[|\s])/gm;
  for (const tm of content.matchAll(tableRowRe)) {
    const id = tm[1];
    if (findings.some(f => f.id === id)) continue;
    const lineEnd = content.indexOf('\n', tm.index);
    const row = content.slice(tm.index, lineEnd === -1 ? undefined : lineEnd);
    const statusMatch = row.match(/\*\*Status:\*\*\s+([^|]+)/);
    findings.push({ id, status: statusMatch ? statusMatch[1].trim() : null });
  }

  return findings;
}

const VALID_STATUS = /^closed \([a-f0-9]{7,40}\)$|^closed-by-absence$/;

test('every finding in agent-architecture audit has a closed status', () => {
  const content = readFileSync(join(REPO_ROOT, AUDITS[0]), 'utf8');
  const findings = parseFindings(content);
  assert.ok(
    findings.length > 0,
    'no findings parsed; check the regex against the audit file'
  );
  for (const f of findings) {
    assert.match(
      f.status || '',
      VALID_STATUS,
      `Finding ${f.id} has status "${f.status}" — expected "closed (<sha>)" or "closed-by-absence"`
    );
  }
});

test('every finding in security audit (if present) has a closed status', () => {
  const path = join(REPO_ROOT, OPTIONAL_AUDIT);
  if (!existsSync(path)) {
    return; // Security audit is created in iteration 05; no-op before then.
  }
  const content = readFileSync(path, 'utf8');
  const findings = parseFindings(content);
  for (const f of findings) {
    assert.match(
      f.status || '',
      /^closed \([a-f0-9]{7,40}\)$/,
      `Security finding ${f.id} has status "${f.status}"`
    );
  }
});
