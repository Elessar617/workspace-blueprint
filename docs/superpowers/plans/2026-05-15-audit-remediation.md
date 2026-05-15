# Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every finding in [`docs/audit/2026-05-15-agent-architecture-audit.md`](../../audit/2026-05-15-agent-architecture-audit.md) and [`docs/audit/2026-05-15-architecture-deepening-audit.md`](../../audit/2026-05-15-architecture-deepening-audit.md), plus add performance regression and security review, so workspace-blueprint is finalized for downstream consumer adoption.

**Architecture:** Five iterations through `build/workflows/NN-slug/` pipeline (deepening-first cascade), interleaved with ten bite-sized direct commits, bracketed by a performance baseline (pre) and a cross-cutting finalize-gate test (post). Per-iteration planner agents author each iteration's `01-spec/SPEC.md` by lifting from the design spec; this master plan provides bite-sized tasks for everything that doesn't pass through a planner agent (direct commits, baseline capture, finalize gate).

**Tech Stack:** Node 18+ ESM (`.mjs`), bash hooks (Claude Code hook interface), `gray-matter` for frontmatter parsing, Node's built-in `--test` runner, `jq` for JSON parsing in hooks. **All `child_process` use in scripts is `spawnSync` with array args (no shell interpolation) for security.**

**Spec:** [`docs/superpowers/specs/2026-05-15-audit-remediation-design.md`](../specs/2026-05-15-audit-remediation-design.md) (committed `e1577dd`).

---

## File Structure

This plan creates and modifies the following files. Each has one clear responsibility.

### New files

| Path | Responsibility |
|---|---|
| `scripts/bench.mjs` | One-shot benchmark runner; n=10 samples per metric; writes JSON to `docs/baselines/`. |
| `docs/baselines/2026-05-15-perf.json` | Pre-finalize performance baseline against SHA `346431e`. |
| `tests/perf/baseline-guard.test.mjs` | Median-to-median perf comparison test against baseline; 5% tolerance. Runs in CI environment. |
| `tests/integration/h1-cross-cycle-awareness.test.mjs` | Fixture-based test that adversary/reviewer specs route prior-cycle reports. |
| `tests/unit/audit-findings-status.test.mjs` | Finalize-gate test: every finding has `status: closed (sha)` or `status: closed-by-absence`. |
| `.claude/rules/memory-discipline.md` | New rule covering Serena memory and `.mcp-memory.json` discipline. |
| `docs/audit/2026-05-15-security-audit.md` | Populated by iteration 05; same `status:` mechanism. |

### Significantly modified files

| Path | Modifying iteration | Modification |
|---|---|---|
| `scripts/regen-routing-docs.mjs` | Iteration 01 | Extended to generate ROUTING.md Step-1, per-IDE preambles, map-file counts. |
| `ROUTING.md` | Iteration 01 | Step-1 table regenerated from `TASK_RULES`. |
| `AGENTS.md`, `.cursorrules`, `GEMINI.md` | Iteration 01 | Procedure body generated; per-IDE wrapper kept. |
| `CLAUDE.md`, `CONTEXT.md`, `START-HERE.md` | Iteration 01 | Counts derived from filesystem. |
| `.claude/hooks/*.sh` (all 5) | Iteration 02 | Refactored against shared bash include. |
| `.claude/hooks/route-inject.sh` | Iteration 02 | Replaced with Node-based equivalent; adds truncation marker; error log. |
| `.claude/agents/{adversary,reviewer}-agent.md` | Iteration 02 | Add prior-cycle inputs. |
| `scripts/route.mjs` | Iteration 03 | CLI block extracted; module becomes import-safe. |
| `.claude/settings.json` | Iteration 03, 04, direct | New `PreToolUse(Task,Skill)` matchers; portability moved to PreToolUse; hook-ordering comment. |
| `scripts/lib/instinct-reader.mjs` | Iteration 04 | Gate, trigger filter, confidence decay. |
| `scripts/lib/{ecc,harness,native}-scraper.mjs` | Direct commit | Unified interface across three scrapers. |
| `scripts/rebuild-registry.mjs` | Iteration 04 | Fail on registry overlap without `prefer:` config. |
| `.claude/registry/ecc-config.json` | Iteration 04 | Add `prefer:` key support. |
| `.claude/skills/handoff/SKILL.md` | Iteration 04 | Require `created:` + `applies_to:` frontmatter; document 24h decay. |
| `.claude/MCP-SETUP.md` | Iteration 04 | Document `BLUEPRINT_INSTINCTS` env flag. |
| `docs/audit/2026-05-15-{agent-architecture,architecture-deepening}-audit.md` | Each iteration / direct commit | `status:` field added per finding. |
| `tests/unit/source-of-truth.test.mjs` | Direct commit (Deepening #5) | Extend to walk hooks/*.sh and verify registration. |

### Order of execution

```
T1   Pre-iteration baseline (direct commit)
T2   Set up cross-cutting finalize-gate test scaffolding (direct commit)
T3   Group A direct commits (independent): M9, M10, M11, L1, L5, Deepening #4
T4   Iteration 01 kickoff: 01-regen-prose-widen
T5   Iteration 02 kickoff: 02-hook-scaffolding
T6   Group B direct commits (depend on iter 02 file touches): M1, M2
T7   Iteration 03 kickoff: 03-route-cli-extract-and-gate
T8   Group C direct commits (depend on iter 03): L4, Deepening #5
T9   Iteration 04 kickoff: 04-instinct-gate-registry-tighten
T10  Iteration 05 kickoff: 05-perf-security-hardening
T11  Finalize gate verification + close-out
```

---

## Task 1: Pre-iteration baseline capture

**Files:**
- Create: `scripts/bench.mjs`
- Create: `docs/baselines/2026-05-15-perf.json`
- Modify: `package.json` (add `"bench": "node scripts/bench.mjs"` to scripts)

- [ ] **Step 1: Write `scripts/bench.mjs` using `spawnSync` (no shell interpolation)**

```javascript
#!/usr/bin/env node
// One-shot benchmark runner. n=10 samples per metric; writes JSON.
// Each metric records {p50, p95, p99} across samples.
// Uses spawnSync with array args (no shell interpolation) for safety.

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const N = 10;

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { p50: percentile(sorted, 50), p95: percentile(sorted, 95), p99: percentile(sorted, 99) };
}

function timeMs(fn) {
  const start = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function runQuiet(command, args, options = {}) {
  const r = spawnSync(command, args, { stdio: ['pipe', 'pipe', 'pipe'], ...options });
  if (r.status !== 0 && r.status !== null) {
    throw new Error(`${command} ${args.join(' ')} exited ${r.status}`);
  }
  return r;
}

function benchHookRouteInject() {
  const samples = [];
  const hookPath = join(REPO_ROOT, '.claude', 'hooks', 'route-inject.sh');
  for (let i = 0; i < N; i++) {
    samples.push(timeMs(() => {
      runQuiet('bash', [hookPath], { input: '{"prompt":"add a feature"}' });
    }));
  }
  return stats(samples);
}

function benchNpmTest() {
  const samples = [];
  for (let i = 0; i < N; i++) {
    samples.push(timeMs(() => {
      runQuiet('npm', ['test'], { cwd: REPO_ROOT });
    }));
  }
  return stats(samples);
}

function benchRebuildRegistry() {
  const samples = [];
  for (let i = 0; i < N; i++) {
    samples.push(timeMs(() => {
      runQuiet('npm', ['run', 'rebuild-registry'], { cwd: REPO_ROOT });
    }));
  }
  return stats(samples);
}

const shaResult = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT });
const sha = shaResult.stdout.toString().trim();
const env = process.env.CI === 'true' ? 'ci' : 'local';

const baseline = {
  captured_at: new Date().toISOString(),
  captured_against_sha: sha,
  captured_in_env: env,
  samples: N,
  metrics: {
    hook_route_inject: benchHookRouteInject(),
    npm_test_duration: benchNpmTest(),
    rebuild_registry: benchRebuildRegistry(),
  },
  notes: env === 'local'
    ? 'Captured locally; CI re-run recommended for the canonical reference.'
    : 'Canonical CI capture.',
};

const outDir = join(REPO_ROOT, 'docs', 'baselines');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, '2026-05-15-perf.json');
writeFileSync(outFile, JSON.stringify(baseline, null, 2) + '\n');
console.log(`wrote ${outFile}`);
```

- [ ] **Step 2: Add npm script**

Modify `package.json` — add to `scripts`:

```json
"bench": "node scripts/bench.mjs"
```

- [ ] **Step 3: Run benchmark**

Run: `npm run bench`
Expected: `wrote /path/to/docs/baselines/2026-05-15-perf.json` and the file contains a JSON with `captured_against_sha`, `samples: 10`, and three metric entries each with p50/p95/p99.

- [ ] **Step 4: Verify baseline file structure**

Run: `jq '.captured_against_sha, .samples, (.metrics | keys)' docs/baselines/2026-05-15-perf.json`
Expected: prints the SHA, `10`, and an array containing `hook_route_inject`, `npm_test_duration`, `rebuild_registry`.

- [ ] **Step 5: Commit**

Subject: `feat(bench): capture pre-finalize performance baselines`

Body (paste via HEREDOC):
```
Adds scripts/bench.mjs (n=10 sampled benchmark runner using
spawnSync with array args — no shell interpolation) and the
docs/baselines/2026-05-15-perf.json reference.

Baselines are the reference for the 5% median-to-median perf gate
introduced in iteration 05 (tests/perf/baseline-guard.test.mjs).
Each iteration records an informational single-sample check; the
strict gate runs in CI against this committed baseline.
```

---

## Task 2: Cross-cutting finalize-gate test scaffolding

This sets up the finalize-gate test in a "fails red, will go green" state. The test asserts every finding has `status: closed (sha)`. Until all findings close, the test fails — which is correct.

**Files:**
- Create: `tests/unit/audit-findings-status.test.mjs`
- Modify: `docs/audit/2026-05-15-agent-architecture-audit.md` (add `status: open` to each finding)
- Modify: `docs/audit/2026-05-15-architecture-deepening-audit.md` (add `status: open` to each finding)

- [ ] **Step 1: Add `**Status:**` field to every finding in both audit files**

For each finding (33 total), add a `**Status:**` bullet near the existing severity/mechanism bullets. Initial value: `open` for critical/high/medium/low; `closed-by-absence` for negative findings N1/N2/N3.

Example diff for one finding:

```diff
 #### C1 — Routing injection is suasion, not a gate (`F6.1`)
 - **Layer:** 6 (tool selection)
 - **Mechanism:** ...
 - **Evidence:** ...
 - **Confidence:** 0.98
+- **Status:** open
```

For findings in tables (the Medium and Low summary tables), add a final column `**Status:**` with the value.

- [ ] **Step 2: Write the finalize-gate test**

Create `tests/unit/audit-findings-status.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

const AUDITS = [
  'docs/audit/2026-05-15-agent-architecture-audit.md',
  'docs/audit/2026-05-15-architecture-deepening-audit.md',
];
const OPTIONAL_AUDIT = 'docs/audit/2026-05-15-security-audit.md';

function parseFindings(content) {
  const findings = [];
  // Matches "#### C1 —" / "#### H3 —" / "#### M7 —" / "#### L2 —" / "#### N1 —" style.
  const headingRe = /^####?\s+(?:Finding\s+)?([CHMLN]\d+)\b/gm;
  let match;
  const matches = [];
  while ((match = headingRe.exec(content)) !== null) {
    matches.push({ id: match[1], start: match.index });
  }
  for (let i = 0; i < matches.length; i++) {
    const sectionStart = matches[i].start;
    const sectionEnd = i + 1 < matches.length ? matches[i + 1].start : content.length;
    const section = content.slice(sectionStart, sectionEnd);
    const statusMatch = section.match(/\*\*Status:\*\*\s+([^\n|]+)/);
    findings.push({ id: matches[i].id, status: statusMatch ? statusMatch[1].trim() : null });
  }
  // Also parse table-style findings (Medium and Low tables): rows like "| M5 (`F8.2`) | ... | **Status:** closed (sha) |"
  const tableRowRe = /^\|\s*(M\d+|L\d+)\s*[(\\`]/gm;
  while ((match = tableRowRe.exec(content)) !== null) {
    const id = match[1];
    if (findings.some(f => f.id === id)) continue;
    const lineEnd = content.indexOf('\n', match.index);
    const row = content.slice(match.index, lineEnd === -1 ? undefined : lineEnd);
    const statusMatch = row.match(/\*\*Status:\*\*\s+([^|]+)/);
    findings.push({ id, status: statusMatch ? statusMatch[1].trim() : null });
  }
  return findings;
}

const VALID_STATUS = /^closed \([a-f0-9]{7,40}\)$|^closed-by-absence$/;

test('every finding in agent-architecture audit has a closed status', () => {
  const content = readFileSync(join(REPO_ROOT, AUDITS[0]), 'utf8');
  const findings = parseFindings(content);
  assert.ok(findings.length > 0, 'no findings parsed; check the regex against the audit file');
  for (const f of findings) {
    assert.match(
      f.status || '',
      VALID_STATUS,
      `Finding ${f.id} has status "${f.status}" — expected "closed (<sha>)" or "closed-by-absence"`
    );
  }
});

test('every finding in architecture-deepening audit has a closed status', () => {
  const content = readFileSync(join(REPO_ROOT, AUDITS[1]), 'utf8');
  const findings = parseFindings(content);
  assert.ok(findings.length > 0, 'no findings parsed');
  for (const f of findings) {
    assert.match(
      f.status || '',
      /^closed \([a-f0-9]{7,40}\)$/,
      `Finding ${f.id} has status "${f.status}" — expected "closed (<sha>)"`
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
```

- [ ] **Step 3: Verify test runs and fails red**

Run: `node --test tests/unit/audit-findings-status.test.mjs 2>&1 | tail -20`
Expected: tests FAIL with messages like `Finding C1 has status "open" — expected "closed (<sha>)" or "closed-by-absence"`. The gate fails until all findings close.

- [ ] **Step 4: Commit**

Subject: `test(audit): add finalize-gate test asserting every finding has closed status`

Body:
```
Adds tests/unit/audit-findings-status.test.mjs and seeds every
finding in both audit files with **Status:** open (or closed-by-absence
for N1/N2/N3 negative findings).

Test fails red until all 33 findings reach status: closed (<sha>).
This is the cross-cutting finalize gate per spec section 4.

The test optionally parses docs/audit/2026-05-15-security-audit.md
once iteration 05 creates it; until then that case is a no-op.
```

---

## Task 3: Group A direct commits (iteration-independent)

These six commits do not depend on any iteration's outputs. Land them now to make iteration kickoffs cleaner.

For each direct commit task below, the SHA-back-fill pattern is:

1. Make the change (edit files, change `**Status:** open` to `**Status:** closed (<sha-of-this-commit>)`).
2. Commit with `<sha-of-this-commit>` as a literal placeholder.
3. Capture the actual SHA: `SHA=$(git log -1 --format='%h')`.
4. Replace the placeholder in the audit file: `sed -i.bak "s/<sha-of-this-commit>/$SHA/g" docs/audit/2026-05-15-agent-architecture-audit.md && rm docs/audit/2026-05-15-agent-architecture-audit.md.bak`.
5. Amend the commit: `git add docs/audit/...md && git commit --amend --no-edit`.

Amend is safe BEFORE push (per `.claude/rules/commit-discipline.md`). After push, use a follow-up `chore(audit): update status SHA for <ID>` commit instead.

### Task 3.1: M9 — Dedupe memory facts from dev log

**Closes:** M9 (canonical fact ownership).

- [ ] **Step 1: Edit `docs/development-log.md` Section 3 "Current state" table**

Find the row whose first cell is `**Memory** (Claude Code persistent)`. Replace its second-cell content with:

```
Auto-memory at `~/.claude/projects/.../memory/MEMORY.md` (canonical). See that file for current entries.
```

- [ ] **Step 2: Update M9's Status in `docs/audit/2026-05-15-agent-architecture-audit.md`**

Change `**Status:** open` to `**Status:** closed (<sha-of-this-commit>)` for M9's row.

- [ ] **Step 3: Commit**

Subject: `docs(dev-log): dedupe memory facts; MEMORY.md is canonical`

Body:
```
Removes the duplicated fact list in development-log.md section 3.
The canonical source for current memory entries is the
~/.claude/projects/.../memory/MEMORY.md index file (already loaded
into every Claude Code session).

Closes M9 (audit finding F2.1: same fact in MEMORY.md, dev log,
instincts — no canonical source).
```

- [ ] **Step 4: Back-fill SHA via amend** (pattern at top of Task 3)

### Task 3.2: M10 — Cycle-archive note in orchestrator-process.md

**Closes:** M10 (review-N files persist; can be re-read by mistake).

- [ ] **Step 1: Insert a paragraph into `docs/orchestrator-process.md`**

Insert near the cycle-management discussion:

```markdown
**Cycle artifact archival.** When a cycle's reviewer/adversary completes with a `verdict: fail` or critical findings, the iteration moves to a new cycle (N+1). The prior `review-N.md` / `adversary-N.md` stay in place; they are NOT deleted. The implementer's input set for cycle N+1 is **only** the latest pair (per `sort -V | tail -1` semantics used in `.claude/hooks/block-output-without-signoff.sh:41-42`). Agents reading prior reports for context (per the iteration-02 update to agent specs) read all of them; agents extracting "the previous verdict" read only the latest. The directory should never be cleaned within an iteration; archival happens once when the iteration moves to `04-output/`, at which point intermediate `review-*.md` and `adversary-*.md` files may be moved to a `03-validate/archive/` subdirectory (optional housekeeping).
```

- [ ] **Step 2: Update M10's Status in audit**

- [ ] **Step 3: Commit**

Subject: `docs(process): document cycle-artifact archival expectations`

Body:
```
Adds explicit guidance that within-iteration cycle artifacts
(review-N.md, adversary-N.md) are kept across cycles for cross-cycle
awareness (per the iteration-02 agent spec update). Latest-pair-only
semantics are reserved for verdict extraction.

Closes M10 (audit finding F12.2).
```

- [ ] **Step 4: Back-fill SHA via amend**

### Task 3.3: M11 — Memory-discipline rule

**Closes:** M11 (.serena/memories and MCP memory unconstrained).

- [ ] **Step 1: Write `.claude/rules/memory-discipline.md`**

```markdown
# Rule: Memory discipline

**MCP memory and Serena memory surfaces are stable knowledge stores, not session scratchpads. Writes require justification; reads should verify currency before relying on them.**

**Why:** `.claude/.mcp-memory.json` (the `memory` MCP server's store) and `.serena/memories/*.md` (the Serena LSP's onboarding files) persist across sessions. Without discipline they accumulate stale or wrong information that re-enters future sessions as pseudo-fact. Audit finding M11/F3.2 surfaced that no convention currently constrains either.

**How to apply:**

- **Treat as canonical, not opportunistic.** Information committed to either store should be a true invariant of the project (e.g., "the build command is `npm test`"), not a session-specific observation ("we just ran the test suite").
- **Frontmatter required for Serena memory files.** Each `.serena/memories/*.md` must include `created_by:` (agent or human name), `verified_at:` (ISO date when the content was last checked against current state), and `applies_to:` (scope — repo-wide, a path, a topic).
- **MCP memory writes record provenance.** When an agent writes to `mcp__*_memory__*` tools, the entity name should include a source tag (e.g., `command-shape:test-runner` not just `test-runner`).
- **Reads verify currency.** Before using a memory fact in a recommendation that the user will act on, spot-check against the current code or filesystem. Memory is a snapshot; current state is the source of truth.
- **Stale memories get removed, not patched.** If a memory says X and current state says Y, prefer deleting the memory entry over editing it. The memory record had context that may not survive a patch; clean removal forces a fresh capture.

**Trade-off:** This is procedural, not hook-enforced. A future hook could grep `.serena/memories/*.md` for required frontmatter on write, but the current rule is a contract for agent behavior, not a code gate.
```

- [ ] **Step 2: Update M11's Status in audit**

- [ ] **Step 3: Commit**

Subject: `feat(rules): add memory-discipline rule for MCP and Serena memory`

Body:
```
New rule constrains MCP-memory and Serena-memory writes to canonical
facts with provenance frontmatter, and instructs reads to verify
currency before acting on remembered facts.

Closes M11 (audit finding F3.2).
```

- [ ] **Step 4: Back-fill SHA via amend**

### Task 3.4: L1 — Adversary marker carve-out in code-quality.md

**Closes:** L1.

- [ ] **Step 1: Append a carve-out to `.claude/rules/code-quality.md`**

Find the bullet about debug statements. Replace with:

```
- No leftover `console.log`, `print`, `dbg!`, `byebug`, or equivalent debug statements in committed code. **Exception:** comments matching `# adversary: ...` or `// adversary: ...` are permitted on adversary-authored tests under `tests/` per `.claude/agents/adversary-agent.md`; they mark intentionally-failing edge-case probes for the implementer.
```

- [ ] **Step 2: Update L1's Status in audit**

- [ ] **Step 3: Commit**

Subject: `docs(rules): carve out adversary marker comments from debug-statement rule`

Body:
```
Adversary-authored tests legitimately include # adversary: marker
comments to flag intentional edge-case probes (per
.claude/agents/adversary-agent.md). The debug-statement rule now
excludes them.

Closes L1 (audit finding F1.6).
```

- [ ] **Step 4: Back-fill SHA via amend**

### Task 3.5: L5 — ECC summary note in MCP-SETUP.md

**Closes:** L5.

- [ ] **Step 1: Append a section to `.claude/MCP-SETUP.md`**

Add at the end:

```markdown
## Note: ECC session-summary block

If the ECC plugin is installed and its `session-end.js` hook is registered globally in `~/.claude/settings.json`, sessions in this repo will produce a `<!-- ECC:SUMMARY:START --> ... <!-- ECC:SUMMARY:END -->` block that re-injects into the next session's context. **This repo does NOT register that hook in its own `.claude/settings.json`** — the block originates from the global config.

The mechanism is **lossy by design**: it keeps the last 10 user messages truncated to 200 chars each, plus tool names and modified file paths. It does NOT preserve nuanced state. Treat it as a hint to the next session, not as a substitute for `/save-session` or the `superpowers:handoff` skill (with its 24h decay contract per `.claude/skills/handoff/SKILL.md`).

If you do not want this behavior, comment out the ECC session-end hook in `~/.claude/settings.json` for sessions opened in this repo.
```

- [ ] **Step 2: Update L5's Status in audit**

- [ ] **Step 3: Commit**

Subject: `docs(setup): document ECC session-summary block (lossy, global hook)`

Body:
```
Notes that the ECC:SUMMARY block visible in sessions is produced by
a globally-registered ECC hook (not this repo's settings.json) and
that the summary is lossy (last-10 messages, 200-char truncation).
Treat as a hint, not authoritative state.

Closes L5 (audit finding F10.5).
```

- [ ] **Step 4: Back-fill SHA via amend**

### Task 3.6: Deepening #4 — Unified scraper interface

**Closes:** Deepening candidate #4.

- [ ] **Step 1: Write a failing test asserting unified shape**

Create `tests/unit/scraper-interface.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run; expect FAIL** (current signatures differ)

Run: `node --test tests/unit/scraper-interface.test.mjs 2>&1 | tail -10`
Expected: TypeError / shape-mismatch errors.

- [ ] **Step 3: Refactor each scraper to unified signature**

For each of `scripts/lib/{ecc,harness,native}-scraper.mjs`, change the exported function to accept `({ root, options = {} })` and return `{ records: [...], sha?: string }`. Map the existing parameters into the new shape:
- `scrapeEcc({ root, options })` — `root` is the old `eccPath`.
- `scrapeHarness({ root, options })` — `root` is the old `pluginCacheRoot`; `options` carries `harnessSlugs` etc.
- `scrapeNative({ root, options })` — `root` is the old `repoRoot`.

- [ ] **Step 4: Update `scripts/rebuild-registry.mjs` callers to the new shape**

Every call to `scrapeEcc(path)` becomes `scrapeEcc({ root: path })`. Same pattern for the other two.

- [ ] **Step 5: Update existing scraper tests if signatures changed**

`tests/unit/native-scraper.test.mjs` and `tests/unit/harness-scraper.test.mjs` may need to call the new shape.

- [ ] **Step 6: Run all tests; expect PASS**

Run: `npm test 2>&1 | tail -20`
Expected: all tests pass, including the new `scraper-interface.test.mjs`.

- [ ] **Step 7: Update Deepening #4 Status in `docs/audit/2026-05-15-architecture-deepening-audit.md`**

- [ ] **Step 8: Commit**

Subject: `refactor(scrapers): unify ecc/harness/native scraper interface`

Body:
```
All three scrapers now accept ({ root, options }) and return
{ records, sha? }. This makes rebuild-registry.mjs treat them as
interchangeable adapters at a real seam (per the deepening audit's
LANGUAGE.md framing) and gives future scrapers (e.g.,
superpowers-scraper) an obvious shape to follow.

Closes deepening candidate #4.
```

- [ ] **Step 9: Back-fill SHA via amend**

---

## Task 4: Iteration 01 kickoff — `01-regen-prose-widen`

This task initiates the first build/workflows iteration. The master plan creates the scaffolding and dispatches the planner agent; the planner agent authors `01-spec/SPEC.md`; the implementer/reviewer/adversary cycles run independently of this plan.

**Spec-section lift:** Section 3 (iteration 01 row), Section 4 (Iteration 01 acceptance criteria), Section 5 (sequencing).

- [ ] **Step 1: Create the iteration directory skeleton**

Run:

```bash
mkdir -p build/workflows/01-regen-prose-widen/{01-spec,02-implement,03-validate,04-output}
touch build/workflows/01-regen-prose-widen/04-output/.gitkeep
```

- [ ] **Step 2: Write the planner-input note**

Create `build/workflows/01-regen-prose-widen/01-spec/planner-input.md`:

```markdown
# Planner input — Iteration 01: regen-prose-widen

**Source spec:** `docs/superpowers/specs/2026-05-15-audit-remediation-design.md` (commit e1577dd)

**Lift these sections into SPEC.md:**
- Section 3, iteration 01 row — scope statement and closes list (H3, H5, H6, M3, L2).
- Section 4, "Iteration 01 (`regen-prose-widen`)" — per-iteration acceptance criteria.

**Acceptance criteria for SPEC.md (verbatim, edited only for SPEC formatting):**

1. `npm run regen-routing-docs` produces byte-identical output for `.claude/routing/*.md`, the Step-1 region of `ROUTING.md`, all three per-IDE preambles (`AGENTS.md`, `.cursorrules`, `GEMINI.md`), and counts in `CLAUDE.md`/`CONTEXT.md`/`START-HERE.md`.
2. A drift test (extension of `tests/unit/routing-docs-in-sync.test.mjs`) fails red when any source-of-truth diverges from rendered output; green when synced.
3. After landing: `TASK_RULES` keywords and `ROUTING.md` Step 1 table fully agree (drift test passes).
4. Every regenerated `.claude/routing/*.md` file contains a comment block explaining names resolve via `.claude/registry/*.json` (closes H6).
5. Performance: informational single-sample check noted in `02-implement/notes-N.md`.

**Decisions inherited from design spec Section 12 (do not re-litigate):**
- Extend `scripts/regen-routing-docs.mjs` as one growing script; do NOT create a sibling.
- `regen-routing-docs.mjs` reads `TASK_RULES` (already exported from `route.mjs`) for the Step-1 table.
- The per-IDE preambles share a template body with per-IDE wrapper text.
- Counts come from filesystem inspection (e.g., count files under `.claude/hooks/`, dir entries under `.claude/skills/`, etc.).

**Files in scope:**
- `scripts/regen-routing-docs.mjs` (extend)
- `tests/unit/routing-docs-in-sync.test.mjs` (extend)
- `ROUTING.md`, `AGENTS.md`, `.cursorrules`, `GEMINI.md`, `CLAUDE.md`, `CONTEXT.md`, `START-HERE.md` (regenerated content lands here)

**Findings to close:** H3, H5, H6, M3, L2. The implementer's final commit body MUST update `**Status:** closed (<sha>)` for each in `docs/audit/2026-05-15-agent-architecture-audit.md`.

**Cycle expectations:** likely 1 cycle (extension of established pattern). May reach 2 if the drift test surfaces edge cases.

**Rules to honor:** all `.claude/rules/*.md`. Especially `testing-discipline.md` (TDD mandatory) and `commit-discipline.md` (Conventional Commits, no `--no-verify`).
```

- [ ] **Step 3: Commit the iteration scaffolding**

Subject: `chore(build): scaffold iteration 01 regen-prose-widen`

Body:
```
Creates the directory structure and planner-input note for the
first build/workflows iteration. Planner agent dispatch is the
next step.
```

- [ ] **Step 4: Dispatch the planner agent**

Use the Agent tool with `subagent_type: planner` and prompt:

```
You are authoring the SPEC.md for iteration 01 of the audit remediation pass.

Inputs:
- build/workflows/01-regen-prose-widen/01-spec/planner-input.md
- docs/superpowers/specs/2026-05-15-audit-remediation-design.md (this is the source spec)
- .claude/rules/ (every rule applies)

Output:
- build/workflows/01-regen-prose-widen/01-spec/SPEC.md following the structure in .claude/agents/planner-agent.md

Lift the acceptance criteria verbatim from the planner-input.md. Add the "Risks" section per planner-agent.md guidance — what could go wrong with this iteration that the implementer should anticipate.

Exit after writing SPEC.md.
```

- [ ] **Step 5: Review the planner's SPEC.md**

Read `build/workflows/01-regen-prose-widen/01-spec/SPEC.md`. Verify:
- All 5 acceptance criteria present
- Risks section exists and is non-trivial
- File-in-scope list matches the planner-input

If revisions needed, dispatch the planner agent again with feedback. If SPEC.md is ready, proceed.

- [ ] **Step 6: Run the iteration to completion**

The implementer/reviewer/adversary cycles are handled by the four-agent loop per `docs/orchestrator-process.md`. The master plan does not enumerate them. The iteration completes when:
- A cycle has `verdict: pass` AND `findings: none|minor`
- `04-output/` is populated
- The merge commit lands on `main` with all closed findings' SHAs in audit `Status:` rows
- `tests/unit/audit-findings-status.test.mjs` shows 5 fewer failures than before iteration 01

- [ ] **Step 7: Capture informational perf check**

After iteration 01 lands, run:

```bash
# Single-sample informational checks (full strict gate is iteration 05)
printf '%s' '{"prompt":"add a feature"}' | bash .claude/hooks/route-inject.sh > /dev/null
# Note timing approximately. Compare informally against docs/baselines/2026-05-15-perf.json p50.
time npm test > /dev/null 2>&1
```

Record results in the last cycle's `02-implement/notes-N.md`.

---

## Task 5: Iteration 02 kickoff — `02-hook-scaffolding`

**Spec-section lift:** Section 3 (iteration 02 row), Section 4 (Iteration 02 acceptance criteria).

This is the meaty iteration. May organically need 2-4 cycles. H1 fix verified by fixture test (independent of cycle count).

- [ ] **Step 1: Create the iteration directory skeleton**

```bash
mkdir -p build/workflows/02-hook-scaffolding/{01-spec,02-implement,03-validate,04-output}
touch build/workflows/02-hook-scaffolding/04-output/.gitkeep
```

- [ ] **Step 2: Write the planner-input note**

Create `build/workflows/02-hook-scaffolding/01-spec/planner-input.md`:

```markdown
# Planner input — Iteration 02: hook-scaffolding

**Source spec:** `docs/superpowers/specs/2026-05-15-audit-remediation-design.md` (commit e1577dd)

**Lift sections:** Section 3 iteration 02 row; Section 4 iteration 02 acceptance criteria.

**Decisions inherited (do not re-litigate):**
- Hook scaffold language: bash. Pure-bash shared-include file, sourced by each hook. See design spec Section 12.
- Truncation marker for `route-inject`: `[INJECTION TRUNCATED]` appended when over 6000-char budget.
- Error logging path: `.claude/routing/.last-error.log`.

**Acceptance criteria:**

1. All 5 hooks invoke the shared bash include for preamble (profile-gate, JSON parse, tool-name matcher, target extract). Each hook file ≤25 lines after refactor.
2. Integration test simulating `Bash(echo "x" > /tmp/wb-test/build/workflows/X/04-output/foo.md)` asserts the write is blocked by `block-output-without-signoff.sh`. Use a fixture path (`/tmp/wb-test/`), NOT real `build/workflows/`.
3. Integration test simulating `git -C /tmp/wb-test commit -m foo` with code-without-tests staged asserts `pre-commit-tdd.sh` blocks it.
4. Unit test for the new scaffold's error-logging asserts that when the inner check throws, `.claude/routing/.last-error.log` gets one line with timestamp + hook name + error.
5. The 6 existing `route-inject` integration tests pass against the new Node version (no regression).
6. **H1 fixture test:** `tests/integration/h1-cross-cycle-awareness.test.mjs` creates a fake `build/workflows/test-h1/` with seeded `review-1.md` + `adversary-1.md`, simulates dispatching cycle-2 adversary per new spec, asserts prior reports appear in adversary's input.
7. **M7 truncation test:** unit test asserts new route-inject emits `[INJECTION TRUNCATED]` marker when route output exceeds 6000 chars.
8. Performance: informational single-sample check.

**Findings to close:** C2, H2, H1, M4, M7, M8, L3 (7 findings).

**Cycle expectations:** 2-4 cycles. The fixture test for H1 is independent of cycle count.

**Files in scope:**
- All 5 `.claude/hooks/*.sh`
- New shared bash include (path TBD by planner — suggest `.claude/hooks/lib/scaffold.sh` or `.claude/hooks/_scaffold.sh`)
- New `tests/integration/h1-cross-cycle-awareness.test.mjs`
- New unit/integration tests per criteria 2-4, 7
- `.claude/agents/adversary-agent.md`, `.claude/agents/reviewer-agent.md` (add prior-cycle inputs to Inputs section)

**Rules:** all. Critical here: `testing-discipline.md`, `commit-discipline.md`.
```

- [ ] **Step 3: Commit scaffolding**

Subject: `chore(build): scaffold iteration 02 hook-scaffolding`

- [ ] **Step 4: Dispatch planner agent** (same pattern as Task 4.4 but pointing at iteration 02's planner-input)

- [ ] **Step 5: Run iteration to completion**

Cycles 1..N per the four-agent loop. Findings close: C2, H2, H1, M4, M7, M8, L3.

- [ ] **Step 6: Informational perf check** (same pattern as Task 4.7)

---

## Task 6: Group B direct commits (post-iteration-02)

These touch files iteration 02 also modifies. Landing AFTER iteration 02 avoids merge conflicts.

### Task 6.1: M1 — Reviewer-vs-tests reconciliation

**Closes:** M1.

- [ ] **Step 1: Edit `.claude/agents/reviewer-agent.md`**

Find the bullet that says "You don't run the test suite." Replace with:

```
- **You don't run the full test suite from scratch; you trust the implementer's recorded test-run state.** The implementer's `02-implement/notes-<cycle>.md` MUST include a "Tests run" section quoting the most recent `npm test` (or equivalent) output and the commit SHA at which it was run. You verify the quoted output matches `verdict: pass` (zero failures); if missing or stale (older than the latest implementer commit), the verdict is `verdict: fail` with `verdict-reason: implementer test-run state missing or stale`. You still verify that tests EXIST for each acceptance criterion.
```

- [ ] **Step 2: Update M1's Status in audit**

- [ ] **Step 3: Commit**

Subject: `docs(agents): reviewer trusts implementer's recorded test-run state`

Body:
```
Reconciles the contradiction between "verdict: pass means EVERY
criterion met" and "don't run tests" — reviewer now verifies the
implementer's notes contain a Tests run section with output and SHA.
Stale or missing test state means verdict: fail.

Closes M1 (audit finding F1.3).
```

- [ ] **Step 4: Back-fill SHA via amend**

### Task 6.2: M2 — Filename convention sync

**Closes:** M2 (inconsistent `review-N.md` filename refs).

- [ ] **Step 1: Per-file edits**

- `.claude/agents/implementer-agent.md`: `review-<latest>.md` → `review-{N-1}.md` (with explanation: N is current cycle, N-1 is prior).
- `.claude/agents/reviewer-agent.md`: `review-<cycle>.md` → `review-{N}.md` and any `review-<latest>.md` → `review-{N-1}.md` per context.
- `.claude/rules/review-discipline.md`: keep `review-N.md` (already matches).
- `docs/orchestrator-process.md`: `review-(N-1).md` → `review-{N-1}.md`.

- [ ] **Step 2: Update M2's Status in audit**

- [ ] **Step 3: Commit**

Subject: `docs(agents): sync review-N.md filename convention across four files`

Body:
```
Implements review-{N}.md / review-{N-1}.md consistently across
implementer-agent.md, reviewer-agent.md, review-discipline.md, and
orchestrator-process.md. The four files previously used four
different conventions; agents following them literally could fail
or glob unpredictably.

Closes M2 (audit finding F1.4).
```

- [ ] **Step 4: Back-fill SHA via amend**

---

## Task 7: Iteration 03 kickoff — `03-route-cli-extract-and-gate`

**Spec-section lift:** Section 3 (iteration 03 row), Section 4 (Iteration 03 acceptance criteria).

- [ ] **Step 1: Create the iteration directory skeleton**

```bash
mkdir -p build/workflows/03-route-cli-extract-and-gate/{01-spec,02-implement,03-validate,04-output}
touch build/workflows/03-route-cli-extract-and-gate/04-output/.gitkeep
```

- [ ] **Step 2: Write the planner-input note**

Create `build/workflows/03-route-cli-extract-and-gate/01-spec/planner-input.md`:

```markdown
# Planner input — Iteration 03: route-cli-extract-and-gate

**Source spec:** `docs/superpowers/specs/2026-05-15-audit-remediation-design.md` (commit e1577dd)

**Lift sections:** Section 3 iteration 03 row; Section 4 iteration 03 acceptance criteria.

**Decisions inherited:**
- New hooks use the bash scaffold from iteration 02 (mandatory dependency).
- `PreToolUse(Skill)` recorder cache cleared on session start AND on `detectTransition()` (existing transition phrases). Reuses `scripts/route.mjs:295-304` logic. See design spec Section 12.
- Cache file remains `.claude/routing/.current.json`; new field is `invoked_skills: [...]`.

**Acceptance criteria:**

1. Node test `import { route } from '../../scripts/route.mjs'` asserts no `console.log` called, no `.claude/routing/.current.json` modified, no registry filesystem reads during import.
2. Integration test launches a simulated Claude session (stub-based): invokes `Task` without first invoking the iteration's mandatory `Skill`s; asserts the new `block-task-without-mandatories.sh` hook refuses dispatch.
3. Integration test asserts `enforce-portability.sh` blocks BEFORE the file lands on disk (verified by `stat` showing no write at target path).
4. Existing routing-snapshots tests still pass.
5. Performance: informational single-sample check.

**Findings to close:** C1, C3, M6/F7.3 (3 findings).

**Cycle expectations:** 1-2 cycles.

**Files in scope:**
- Modify: `scripts/route.mjs` (extract CLI block from lines 326-381)
- Create: `scripts/route-cli.mjs`
- Create: `.claude/hooks/record-skill-invocation.sh` (uses iteration 02 scaffold)
- Create: `.claude/hooks/block-task-without-mandatories.sh` (uses iteration 02 scaffold)
- Modify: `.claude/hooks/enforce-portability.sh` (PostToolUse → PreToolUse; content extraction)
- Modify: `.claude/settings.json` (new matchers; portability move)
- New tests per criteria 1-3

**Rules:** all.
```

- [ ] **Step 3: Commit scaffolding** (`chore(build): scaffold iteration 03 route-cli-extract-and-gate`)

- [ ] **Step 4: Dispatch planner agent** (same pattern as Task 4.4)

- [ ] **Step 5: Run iteration to completion** — Findings close: C1, C3, M6.

- [ ] **Step 6: Informational perf check** — New hooks add per-prompt overhead; informational only.

---

## Task 8: Group C direct commits (post-iteration-03)

### Task 8.1: L4 — Hook ordering comment in settings.json

**Closes:** L4.

- [ ] **Step 1: Add a comment-equivalent key to `.claude/settings.json`**

JSON has no comments. Use the existing `_disablingHooks` convention (key prefixed with `_`):

```json
"_hookOrdering": "PreToolUse hooks on the same matcher run in array order. The block-* hooks have disjoint path filters (cycle-overrun matches build/workflows/*/03-validate/; signoff matches build/workflows/*/04-output/; portability matches .claude/rules/ or .claude/skills/), so they never both fire on the same file. Order is documentation, not enforcement.",
```

- [ ] **Step 2: Update L4's Status in audit**

- [ ] **Step 3: Commit**

Subject: `docs(settings): document hook ordering on overlapping matchers`

Body:
```
Adds _hookOrdering note explaining that block-* hooks share an
Edit|Write matcher but have disjoint path filters, so order is
documentation rather than enforcement.

Closes L4 (audit finding F10.3).
```

- [ ] **Step 4: Back-fill SHA via amend**

### Task 8.2: Deepening #5 — Hook-registration invariant test

**Closes:** Deepening candidate #5.

- [ ] **Step 1: Add a test to `tests/unit/source-of-truth.test.mjs`**

Inside the file's existing test set, add:

```javascript
test('every .claude/hooks/*.sh file is registered in settings.json', () => {
  const settings = JSON.parse(readFileSync(join(REPO_ROOT, '.claude/settings.json'), 'utf8'));
  const hookFiles = readdirSync(join(REPO_ROOT, '.claude/hooks'))
    .filter(f => f.endsWith('.sh'))
    .map(f => f.replace(/\.sh$/, ''));
  const registered = new Set();
  const allHookGroups = [
    ...(settings.hooks?.UserPromptSubmit || []),
    ...(settings.hooks?.PreToolUse || []),
    ...(settings.hooks?.PostToolUse || []),
    ...(settings.hooks?.Stop || []),
  ];
  for (const group of allHookGroups) {
    for (const h of (group.hooks || [])) {
      const m = (h.command || '').match(/\.claude\/hooks\/([^\s'"]+)\.sh/);
      if (m) registered.add(m[1]);
    }
  }
  for (const f of hookFiles) {
    if (f.startsWith('_') || f.includes('/lib/')) continue; // shared includes
    assert.ok(registered.has(f), `Hook script ${f}.sh exists on disk but is not registered in settings.json`);
  }
  for (const r of registered) {
    assert.ok(hookFiles.includes(r), `settings.json references ${r}.sh but no such file exists on disk`);
  }
});
```

- [ ] **Step 2: Run; expect PASS** (guards future drift, no current regression).

- [ ] **Step 3: Update Deepening #5's Status in deepening audit**

- [ ] **Step 4: Commit**

Subject: `test(hooks): assert every .claude/hooks/*.sh is registered in settings.json`

Body:
```
Prevents two failure modes: a new hook script added to disk but
forgotten in settings.json (silently doesn't run), and a stale
registration whose script no longer exists. Excludes _-prefixed
and lib/ paths (shared includes).

Closes deepening candidate #5.
```

- [ ] **Step 5: Back-fill SHA via amend**

---

## Task 9: Iteration 04 kickoff — `04-instinct-gate-registry-tighten`

**Spec-section lift:** Section 3 (iteration 04 row), Section 4 (Iteration 04 acceptance criteria).

- [ ] **Step 1: Create the iteration directory skeleton**

```bash
mkdir -p build/workflows/04-instinct-gate-registry-tighten/{01-spec,02-implement,03-validate,04-output}
touch build/workflows/04-instinct-gate-registry-tighten/04-output/.gitkeep
```

- [ ] **Step 2: Write the planner-input note**

Create `build/workflows/04-instinct-gate-registry-tighten/01-spec/planner-input.md`:

```markdown
# Planner input — Iteration 04: instinct-gate-registry-tighten

**Source spec:** `docs/superpowers/specs/2026-05-15-audit-remediation-design.md` (commit e1577dd)

**Lift sections:** Section 3 iteration 04 row; Section 4 iteration 04 acceptance criteria.

**Decisions inherited:**
- Default `BLUEPRINT_INSTINCTS=off`.
- Trigger-aware filter checks `inst.trigger` substring against current prompt AND `files_in_scope`.
- Confidence decay: halve confidence per 30 days of `last_seen` idle time.
- Handoff skill gets `created:` + `applies_to:` frontmatter requirement; 24h decay rule documented (closes H7).
- Registry overlap: `rebuild-registry.mjs` fails when same name in both `ecc-skills.json` and `harness-skills.json` without an explicit `prefer:` entry in `.claude/registry/ecc-config.json`.

**Acceptance criteria:**

1. With `BLUEPRINT_INSTINCTS` unset, `formatOutput(route(...))` contains zero `[project ...]` instinct lines (unit test).
2. With `BLUEPRINT_INSTINCTS=on` AND matching `trigger`, instinct injects (unit test with fixture instincts).
3. Unit test: instinct with `last_seen` 60 days ago has confidence halved twice; falls below 0.7 floor.
4. `.claude/skills/handoff/SKILL.md` requires `created:` and `applies_to:` frontmatter; skill text instructs consumers to ignore handoff content older than 24h (H7 fix; verified by inspection).
5. `npm run rebuild-registry` exits non-zero when a fixture registry pair shares a name without `prefer:` (integration test with temp registry dirs).
6. Performance: informational single-sample check.

**Findings to close:** C4, H7, H8, M5, H4 (5 findings).

**Cycle expectations:** 1-2 cycles.

**Files in scope:**
- `scripts/lib/instinct-reader.mjs` (gate, trigger filter, decay)
- `scripts/route.mjs` (consume env flag; pass prompt + files into reader)
- `scripts/rebuild-registry.mjs` (overlap detection)
- `.claude/registry/ecc-config.json` (add `prefer:` schema support)
- `.claude/skills/handoff/SKILL.md` (frontmatter requirements; 24h decay text)
- `.claude/MCP-SETUP.md` (document `BLUEPRINT_INSTINCTS`)
- New tests per criteria 1-3, 5

**Rules:** all.
```

- [ ] **Step 3: Commit scaffolding** (`chore(build): scaffold iteration 04 instinct-gate-registry-tighten`)

- [ ] **Step 4: Dispatch planner agent**

- [ ] **Step 5: Run iteration to completion** — Findings close: C4, H7, H8, M5, H4.

- [ ] **Step 6: Informational perf check**

---

## Task 10: Iteration 05 kickoff — `05-perf-security-hardening`

**Spec-section lift:** Section 3 (iteration 05 row), Section 4 (Iteration 05 acceptance criteria), Section 6 (hardened rollback).

This is the final iteration. It runs both security tools, audits hooks for shell-injection, runs the final benchmark vs. baselines, and adds the perf-guard test.

- [ ] **Step 1: Create the iteration directory skeleton**

```bash
mkdir -p build/workflows/05-perf-security-hardening/{01-spec,02-implement,03-validate,04-output}
touch build/workflows/05-perf-security-hardening/04-output/.gitkeep
```

- [ ] **Step 2: Write the planner-input note**

Create `build/workflows/05-perf-security-hardening/01-spec/planner-input.md`:

```markdown
# Planner input — Iteration 05: perf-security-hardening

**Source spec:** `docs/superpowers/specs/2026-05-15-audit-remediation-design.md` (commit e1577dd)

**Lift sections:** Section 3 iteration 05 row; Section 4 iteration 05 acceptance criteria; Section 6 rollback table (hardened policy).

**This iteration creates a new audit file:** `docs/audit/2026-05-15-security-audit.md` with the same `status:` mechanism as the existing audits. Any findings from the security tools become rows there.

**Acceptance criteria:**

1. `/ecc:security-scan` (AgentShield) runs cleanly. Findings recorded in `docs/audit/2026-05-15-security-audit.md` with `**Status:**` frontmatter (initially `open`; closed during this iteration or in follow-up direct commits).
2. `/ecc:security-review` (OWASP-broad) runs cleanly. Findings same file.
3. Manual checks documented in `02-implement/notes-<cycle>.md`:
   - Shell-injection audit of `.claude/hooks/*.sh` (`jq -r '.tool_input.*'` extractions confirmed safe — none `eval`'d, none used in command construction).
   - `route-inject.mjs` argument parsing confirmed safe (Node-based after iteration 02).
   - MCP scope audit: the 7 MCPs in `settings.json` each justified.
   - `permissions.deny` completeness vs. OWASP-relevant patterns.
   - Secret scan (`gitleaks detect` or equivalent) returns zero findings across working tree + git history.
4. Final benchmark vs. `docs/baselines/2026-05-15-perf.json`: all metrics within **5% median-to-median tolerance**.
5. `tests/perf/baseline-guard.test.mjs` exists and runs as part of `npm test` in CI environment (gated by `CI=true` env var).
6. All security findings from this iteration `**Status:** closed (<sha>)` by end of iteration.

**Hardened rollback (from spec Section 6):** any ≥5% regression on a metric auto-reverts unless (a) implementer's notes cite the audit finding ID that necessitated the regression AND (b) reviewer concurs with explicit "perf cost acknowledged" line + `verdict: pass`.

**Findings to close:** new security audit's findings + the perf gate establishment.

**Cycle expectations:** 1-3 cycles (security findings drive cycle count).

**Files in scope:**
- `tests/perf/baseline-guard.test.mjs` (new)
- `docs/audit/2026-05-15-security-audit.md` (new; populated)
- `02-implement/notes-<cycle>.md` (manual-check documentation)
- Any hardening edits to hooks/scripts based on security findings

**Rules:** all.

**Reference for `tests/perf/baseline-guard.test.mjs` skeleton:** Use `spawnSync` with array args (not `execSync` with shell interpolation). Mirror the pattern from `scripts/bench.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const BASELINE = join(REPO_ROOT, 'docs/baselines/2026-05-15-perf.json');
const TOLERANCE = 0.05;
const RUN_PERF = process.env.CI === 'true' || process.env.FORCE_PERF === 'true';

test('hook route-inject p50 within 5% of baseline', { skip: !RUN_PERF }, () => {
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
  // Take n=10 samples using spawnSync (no shell interpolation), compute p50.
  // Compare against baseline.metrics.hook_route_inject.p50_ms.
  // assert.ok(currentP50 <= baseline.metrics.hook_route_inject.p50_ms * (1 + TOLERANCE), ...);
});

// Similar tests for npm_test_duration and rebuild_registry.
```

The planner agent expands the skeleton into full tests during cycle 1.
```

- [ ] **Step 3: Commit scaffolding** (`chore(build): scaffold iteration 05 perf-security-hardening`)

- [ ] **Step 4: Dispatch planner agent**

- [ ] **Step 5: Run iteration to completion**

This iteration also creates and CLOSES findings in `docs/audit/2026-05-15-security-audit.md`. The finalize-gate test from Task 2 already supports this file (via the optional-audit branch).

---

## Task 11: Finalize gate verification + close-out

After all five iterations and all direct commits land, verify the finalize gate passes.

- [ ] **Step 1: Run the full test suite**

Run: `npm test 2>&1 | tail -20`
Expected: ALL tests pass, including:
- `tests/unit/audit-findings-status.test.mjs` (every finding `**Status:** closed (<sha>)` or `closed-by-absence`)
- All existing tests

- [ ] **Step 2: Verify in CI**

Push the branch and watch CI for `tests/perf/baseline-guard.test.mjs` — the strict gate runs only in CI per its `RUN_PERF` env check.

- [ ] **Step 3: Tag the finalize point**

Once CI is green:

```bash
git tag -a v0.2.0-finalize -m "Finalize: audit remediation complete. 33 findings closed; perf gate green in CI."
```

- [ ] **Step 4: Update development log**

Add an entry to `docs/development-log.md` Section 2 marking the finalize milestone. Cite this plan's path. Update Section 3 "Current state" table where relevant.

- [ ] **Step 5: Commit and tag-push (only if user approves push)**

Per the project's `feedback_no_prs_in_this_project` memory, commit-direct-to-main is the established pattern. Push when user gives explicit approval for this milestone push.

---

## Self-review

### Spec coverage

| Spec section | Plan task(s) | Covered |
|---|---|---|
| §1 Goal/framing | Plan header + intent throughout | ✓ |
| §2 Approach (deepening-first cascade) | Task ordering | ✓ |
| §3 Iteration map (5 iterations, 10 direct commits, baseline) | Tasks 1–10 | ✓ |
| §4 Success criteria | Each iteration kickoff lifts the per-iteration criteria into planner-input | ✓ |
| §5 Sequencing | Task ordering matches Section 5's hard constraints | ✓ |
| §6 Rollback (hardened) | Lifted into iteration 05 planner-input | ✓ |
| §7 Commit hygiene | Each task uses Conventional Commits | ✓ |
| §8 Work estimate | Implicit; not enumerated per task | ✓ (informational) |
| §9 Files created/modified | File-structure table at top of plan | ✓ |
| §10 Out of scope | Not enumerated per task (correctly — these are non-actions) | ✓ |
| §11 What gets handed to writing-plans | This document IS that handoff | ✓ |
| §12 Decisions resolved | Lifted into each relevant planner-input as "decisions inherited" | ✓ |

### Placeholder scan

- No `TBD`, `TODO`, or "implement later" in the plan body except:
  - `<sha-of-this-commit>` placeholders in commit message templates — intentional; the operator fills via the documented amend pattern.
  - `<cycle>` in iteration-kickoff text — refers to the actual cycle number when the implementer runs; not a placeholder in the implementation-plan sense.
- All code blocks contain real code.
- All test code is concrete.

### Type consistency

- `route()` signature: `route({ prompt, files_in_scope, registry, instincts })` consistent throughout.
- `scrapeEcc/scrapeHarness/scrapeNative` unified signature: `scrape*({ root, options }) → { records, sha? }` consistent in Task 3.6 and file-structure table.
- `BLUEPRINT_INSTINCTS` env-flag name consistent.
- `.current.json` field name `invoked_skills` consistent.
- Cache lifecycle reuse of `detectTransition()` consistent.

### Security pattern note

**All `child_process` invocations in this plan use `spawnSync` with array args, not `execSync` with shell-interpolated strings.** This was caught by the ECC security_reminder_hook during plan authoring; the safer pattern is now the documented default and is referenced in iteration 05's planner-input as well.

### Notes on per-iteration depth

The per-iteration internals (implementer cycles, individual test code, file diffs at the line level) are NOT enumerated in this master plan. They are the output of each iteration's planner agent, who lifts the relevant section of this plan into a `01-spec/SPEC.md` and then the implementer/reviewer/adversary loop produces the actual diffs. This is per the spec's explicit handoff design (Section 11) and the user's stated intent ("planner agents for each iteration can lift from").

If during execution an iteration's planner agent struggles to elaborate from the planner-input note, that signals the note is too thin — return to this plan and enrich the relevant `planner-input.md` content with more spec context.

---

**End of plan.**
