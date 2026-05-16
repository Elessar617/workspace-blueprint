// adversary: cycle 1 probes for `01-regen-prose-widen`
// These tests deliberately probe edge cases NOT covered by the SPEC.
// Each test header references the adversary-1.md finding it corresponds to.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

// ---------------------------------------------------------------------------
// adversary: finding A1 — CLAUDE.md tree hardcodes "6 project + 5 integrations
// + 4 routing-vendored" breakdown. Generator emits this string regardless of
// counts.skills. If a new skill is added, the leading "N skills" updates but
// the breakdown lies (N != 6+5+4).
// SPEC criterion 1 says "byte-identical regen output" and counts derived from
// filesystem inspection. The tree-line breakdown is NOT derived; it is a
// constant in scripts/regen-routing-docs.mjs:339. The drift test passes
// because it asserts the count number only, not arithmetic consistency.
// ---------------------------------------------------------------------------
test('adversary: CLAUDE.md tree breakdown arithmetic matches counts.skills', () => {
  const claude = readFileSync(join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
  const counts = computeCounts();

  // Extract the tree line "(N skills: a project + b integrations + c routing-vendored)"
  const m = claude.match(/on-demand procedures \((\d+) skills: (\d+) project \+ (\d+) integrations \+ (\d+) routing-vendored\)/);
  assert.ok(m, 'tree-line skill breakdown pattern not found in CLAUDE.md');
  const N = Number(m[1]);
  const a = Number(m[2]);
  const b = Number(m[3]);
  const c = Number(m[4]);
  assert.equal(N, counts.skills, 'leading skill count must equal filesystem count');
  assert.equal(a + b + c, N,
    `tree breakdown ${a}+${b}+${c}=${a+b+c} must equal stated total ${N}. ` +
    `Generator emits a HARDCODED breakdown string at scripts/regen-routing-docs.mjs:339; ` +
    `if a new skill is added (counts.skills=16), the breakdown line still says "6+5+4" ` +
    `which sums to 15. Drift test silently passes.`);
});

// ---------------------------------------------------------------------------
// adversary: finding A2 — countHooks() counts ALL .sh files in .claude/hooks/
// without excluding hidden files, swap files, backups, or symlinks. A vim
// .block-output-without-signoff.sh.swp or a stray .DS_Store.sh would not
// match, but a vim `.swp` of a NON-.sh file wouldn't either — so this is
// narrower than the SPEC implies. Real risk: someone adds a `.bak.sh` or a
// developer-local `_test.sh` file, the count inflates silently.
// SPEC's silence: criterion 1 says "counts.hooks" but doesn't specify what
// "is a hook." The convention "one .sh = one hook" is implementer-doc'd
// in scripts/regen-routing-docs.mjs:171, never spec'd.
// This is more of a documentation gap than a critical break; recording as
// minor.
// ---------------------------------------------------------------------------
test('adversary: countHooks gracefully handles a hidden .sh file (e.g. swap file)', () => {
  // We can't mutate the live filesystem in a test, so verify the contract by
  // simulating: a `.foo.swp.sh` file (vim swap with .sh extension) WOULD be
  // counted by countHooks because the filter only checks .endsWith('.sh').
  // The generator does not skip dotfiles. Confirming the implementation has
  // this gap (not necessarily a failure — informational).
  const code = readFileSync(join(REPO_ROOT, 'scripts', 'regen-routing-docs.mjs'), 'utf8');
  // countHooks signature inspection
  const m = code.match(/function countHooks\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(m, 'countHooks function source not found');
  const fn = m[0];
  // Adversary probe: does the function skip dotfiles?
  const skipsDotfiles = fn.includes('startsWith(\'.\')') || fn.includes('.startsWith(".")');
  assert.ok(
    skipsDotfiles,
    'countHooks() does NOT skip hidden/dot-prefixed .sh files. A `.swp` or `.bak.sh` ' +
    'would inflate counts.hooks. Recording as a minor gap (no current files trigger it).'
  );
});

// ---------------------------------------------------------------------------
// adversary: finding A3 — replaceMarkedRegion does NOT validate that the
// supplied `inner` lacks the markers themselves. If a future contributor or
// a future regen function inadvertently includes "<!-- regen:start NAME -->"
// in the inner content (e.g., via nested templating, escape error, or
// renderRoutingStep1Table copied verbatim into a docstring example), the
// generator silently produces a file with duplicated markers — which the
// NEXT regen run rejects loudly via the "duplicate start marker" check.
// This is a self-healing failure mode (next run blows up loudly), so minor.
// ---------------------------------------------------------------------------
test('adversary: replaceMarkedRegion rejects inner content containing the marker', () => {
  // The generator should refuse to emit a marker inside marker-bounded
  // content. Today it does not; we verify by re-reading regen-routing-docs
  // source.
  const code = readFileSync(join(REPO_ROOT, 'scripts', 'regen-routing-docs.mjs'), 'utf8');
  const m = code.match(/function replaceMarkedRegion\(content, name, inner\)\s*\{[\s\S]*?\n\}/);
  assert.ok(m, 'replaceMarkedRegion source not found');
  const fn = m[0];
  // Adversary probe: does the function validate that `inner` is marker-free?
  const validatesInner = /inner\.includes\(startMarker\)|inner\.includes\(endMarker\)|inner\.indexOf\(startMarker\)|inner\.indexOf\(endMarker\)/.test(fn);
  assert.ok(
    validatesInner,
    'replaceMarkedRegion does NOT validate that `inner` content lacks the marker. ' +
    'A future caller that interpolates a marker into `inner` (escape error, nested template) ' +
    'will silently produce a file with duplicate markers — next regen run blows up loudly. ' +
    'Self-healing failure mode, recording as minor.'
  );
});

// ---------------------------------------------------------------------------
// adversary: finding A4 — CONTEXT.md regex pattern is greedy and brittle.
// The regex `/(.*`\.claude\/rules\/` \(all )(\d+)(\)[^|]*\|.*)/` uses `.*`
// at the start which is greedy and could match unexpected content if the
// line has multiple table cells. Verify behavior.
// ---------------------------------------------------------------------------
test('adversary: CONTEXT.md regex handles edge case where pattern appears in a non-target line', () => {
  // Construct a synthetic CONTEXT.md fragment with the pattern appearing
  // twice (once in target, once in unrelated comment). The generator should
  // either (a) fail loudly via "matched twice", or (b) match only the table
  // row. Verify which.
  const synthetic = [
    '| junk | `.claude/rules/` (all 99) blah |', // unrelated row matching the same pattern
    '| Foo | `.claude/rules/` (all 8) — eight constraints | other |',
  ].join('\n');
  // We can't import the private applyContextMdCounts directly. Instead, use
  // applyAllRegenSurfaces with our synthetic surface name 'CONTEXT.md'.
  let threw = null;
  try {
    applyAllRegenSurfaces({ 'CONTEXT.md': synthetic });
  } catch (e) {
    threw = e;
  }
  assert.ok(
    threw && /matched twice/.test(threw.message),
    'CONTEXT.md regex did NOT detect the duplicate-pattern case. ' +
    'Expected: throws "matched twice". ' +
    `Got: ${threw ? threw.message : 'no error, silently rewrote one'}`
  );
});

// ---------------------------------------------------------------------------
// adversary: finding A5 — BRANCH_TO_WORKSPACE map is defined in the generator
// but NOT validated against TASK_RULES branches. If a new branch is added to
// scripts/route.mjs's TASK_RULES but the generator's BRANCH_TO_WORKSPACE map
// is not updated, the rendered table emits "_(?)_" silently.
// SPEC criterion 3 says "TASK_RULES ↔ ROUTING.md Step 1 agreement" — the
// silent "_(?)_" fallback would PASS the drift test (because both committed
// ROUTING.md and renderRoutingStep1Table() emit it). This is the SOURCE of
// truth becoming the GENERATOR rather than route.mjs.
// CRITICAL: this directly violates SPEC risk #5 ("source-of-truth confusion").
// ---------------------------------------------------------------------------
test('adversary: every TASK_RULES branch has a BRANCH_TO_WORKSPACE entry', () => {
  const code = readFileSync(join(REPO_ROOT, 'scripts', 'regen-routing-docs.mjs'), 'utf8');
  const m = code.match(/const BRANCH_TO_WORKSPACE = \{([\s\S]*?)\};/);
  assert.ok(m, 'BRANCH_TO_WORKSPACE map not found');
  const mapBody = m[1];
  // Extract keys from the map body.
  const keys = Array.from(mapBody.matchAll(/['"]?([\w-]+)['"]?\s*:/g)).map(x => x[1]);

  const routeCode = readFileSync(join(REPO_ROOT, 'scripts', 'route.mjs'), 'utf8');
  const branches = Array.from(routeCode.matchAll(/\{\s*branch:\s*['"]([\w-]+)['"]/g)).map(x => x[1]);

  for (const b of branches) {
    assert.ok(
      keys.includes(b),
      `TASK_RULES branch "${b}" has no entry in BRANCH_TO_WORKSPACE. ` +
      `Rendered Step-1 table will emit "_(?)_" for that row. Drift test will pass silently ` +
      `because committed ROUTING.md and generator both emit the same placeholder. ` +
      `Violates SPEC risk #5 (source-of-truth confusion).`
    );
  }
});

// ---------------------------------------------------------------------------
// adversary: finding A6 — countHooks/countSkills/countRules/countAgents call
// readdirSync which on some filesystems returns entries in non-deterministic
// order (although on most modern Linux/macOS the order is stable for a given
// fs state). The COUNTS themselves are order-independent, so this is not a
// determinism risk for counts. BUT renderBranchDoc uses the order of
// MANDATORIES_BY_BRANCH and AGENTS_BY_BRANCH from route.mjs which is
// declaration order (deterministic in JS). Good. SPEC risk #1 noted this;
// confirming no further determinism risk in counts.
// ---------------------------------------------------------------------------
test('adversary: applyAllRegenSurfaces on EMPTY content throws clear errors (degenerate state)', () => {
  // If a routing surface file is wiped to empty content, the generator should
  // fail loudly rather than silently emit an empty file. SPEC risk #6 talks
  // about marker collision; SPEC is SILENT on what happens when a target
  // surface file is empty or missing its markers.
  const empty = '';
  for (const surface of ['ROUTING.md', 'AGENTS.md', '.cursorrules', 'GEMINI.md']) {
    let threw = null;
    try {
      applyAllRegenSurfaces({ [surface]: empty });
    } catch (e) {
      threw = e;
    }
    assert.ok(
      threw && /marker region/.test(threw.message),
      `applyAllRegenSurfaces on empty ${surface} did not throw a clear marker error. ` +
      `Got: ${threw ? threw.message : 'no error, silently rewrote'}`
    );
  }
});

// ---------------------------------------------------------------------------
// adversary: finding A7 — CLAUDE.md tree-line prefix is "│  ├─ skills/   ← "
// (with literal box-drawing characters). If a future contributor uses a
// different editor that swaps box-drawing for ASCII art, or applies
// auto-formatting to the markdown that strips trailing whitespace, the
// replacePrefixedLine() call fails LOUDLY (which is correct). Verify the
// behavior is loud, not silent.
// ---------------------------------------------------------------------------
test('adversary: replacePrefixedLine fails loudly when prefix is absent', () => {
  // Inject a CLAUDE.md surface where the tree-diagram line has been ASCII-fied.
  const synthetic = readFileSync(join(REPO_ROOT, 'CLAUDE.md'), 'utf8')
    .replace('│  ├─ skills/            ← ', '|  +- skills/            <- ');
  let threw = null;
  try {
    applyAllRegenSurfaces({ 'CLAUDE.md': synthetic });
  } catch (e) {
    threw = e;
  }
  assert.ok(
    threw && /prefix .* not found/.test(threw.message),
    'replacePrefixedLine did not fail loudly on missing prefix. ' +
    `Got: ${threw ? threw.message : 'no error, silently passed through'}`
  );
});

// ---------------------------------------------------------------------------
// adversary: finding A8 — README.md, .claude/MCP-SETUP.md, and dozens of other
// docs in the repo also contain count statements (e.g., "5 hooks", "8 rules")
// that are NOT regenerated by this iteration. SPEC explicitly scopes only the
// three map files (CLAUDE.md, CONTEXT.md, START-HERE.md). Verify that out-of-
// scope files exist with count-like statements that could drift.
// This is a MINOR scope-completeness finding — SPEC explicitly carves these
// out as out-of-scope, but the audit's H5 finding is only PARTIALLY closed
// because counts in README.md, .claude/MCP-SETUP.md, etc. still drift.
// ---------------------------------------------------------------------------
test('adversary: scope-gap: other always-loaded files contain non-regenerated counts', () => {
  // Search for count-bearing phrases in files OTHER than the three map files.
  const fs = readFileSync;
  const join_ = join;
  const targets = [
    'README.md',
    '.claude/MCP-SETUP.md',
    'docs/development-log.md',
  ];
  const found = [];
  for (const t of targets) {
    let content;
    try {
      content = fs(join_(REPO_ROOT, t), 'utf8');
    } catch { continue; }
    // Heuristic: digit followed by " hook"/" rule"/" skill"/" agent" (singular or plural).
    const matches = content.match(/\b(\d+) (hooks?|rules?|skills?|agents?)\b/gi) || [];
    for (const match of matches) found.push(`${t}: "${match}"`);
  }
  // The expectation here is INFORMATIONAL — list the drift surface so the
  // adversary report can call it out as a minor gap. We do NOT block.
  if (found.length > 0) {
    // Print so the test output shows the gap, but don't fail (recorded as
    // minor finding in adversary-1.md).
    console.log('[adversary minor A8] count-bearing phrases in non-regenerated files:');
    for (const f of found) console.log('  ' + f);
  }
  // Pass: this test is informational.
  assert.ok(true);
});

// ---------------------------------------------------------------------------
// adversary: finding A9 — line endings / BOM. SPEC risk #1 explicitly says
// "LF only" — but the generator does NOT actively normalize CRLF or BOM. If
// a Windows contributor saves CLAUDE.md with CRLF, the markers and prefixes
// still match (Node's String.includes is byte-comparing), but the rewrite
// emits LF-only content, mixing line endings.
// ---------------------------------------------------------------------------
test('adversary: generator preserves CRLF if input has CRLF (mixed-LF risk)', () => {
  // Synthesize a CRLF version of CLAUDE.md's tree line.
  const original = readFileSync(join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
  const crlf = original.replace(/\n/g, '\r\n');
  // Apply transform.
  let result;
  try {
    result = applyAllRegenSurfaces({ 'CLAUDE.md': crlf })['CLAUDE.md'];
  } catch (e) {
    // Generator may legitimately fail because '\r' in the prefix line breaks
    // .startsWith() match.
    assert.fail(`generator threw on CRLF input: ${e.message}`);
  }
  // Check: did the result preserve CRLF, mix LF and CRLF, or normalize to LF?
  const hasCRLF = /\r\n/.test(result);
  const hasBareLF = /[^\r]\n/.test(result);
  assert.ok(
    !(hasCRLF && hasBareLF),
    'Generator mixed CRLF and LF in output for CRLF input. ' +
    'A Windows developer who edits CLAUDE.md with CRLF and runs `npm run regen-routing-docs` ' +
    'produces a file with mixed line endings — git treats this as a diff on every line.'
  );
});

// ---------------------------------------------------------------------------
// adversary: finding A10 — applyAllRegenSurfaces accepts unknown surface
// names and passes them through unchanged. A caller who typos a surface name
// (e.g., "CLAUDE.MD" with caps, or "claude.md") gets a silent no-op rather
// than a clear error. Confirmed by reading the `default:` arm in
// applyOneSurface (regen-routing-docs.mjs:457-461).
// ---------------------------------------------------------------------------
test('adversary: applyAllRegenSurfaces silently passes through unknown surface names', () => {
  const unknown = { 'NOT-A-REAL-FILE.md': 'arbitrary content' };
  let result;
  try {
    result = applyAllRegenSurfaces(unknown);
  } catch (e) {
    assert.fail(`generator threw on unknown surface, expected silent passthrough but got: ${e.message}`);
  }
  assert.equal(result['NOT-A-REAL-FILE.md'], 'arbitrary content',
    'unknown surface should pass through unchanged (current behavior — confirming this is the behavior)');
  // The PROBE: this is fine for the CLI (which only passes known surfaces),
  // but it means typos go undetected. Recording as minor.
});

// ---------------------------------------------------------------------------
// adversary: finding A11 — concurrent regen invocation. SPEC is silent on
// what happens if two `npm run regen-routing-docs` processes run at the same
// time (e.g., file-watcher race, two terminals). The script does sequential
// readFileSync + writeFileSync per surface with no advisory lock. If two
// processes interleave on the same file, partial writes can corrupt the
// content.
// This is a race-condition risk; in practice, the script completes in
// ~250ms (per implementer notes), so the window is small. Recording as
// minor.
// ---------------------------------------------------------------------------
test('adversary: regen-routing-docs has no concurrency guard', () => {
  const code = readFileSync(join(REPO_ROOT, 'scripts', 'regen-routing-docs.mjs'), 'utf8');
  // Adversary probe: search for lock/mutex/flock patterns.
  const hasLock = /flock|lockfile|lock-file|advisory.lock|mutex/i.test(code);
  assert.ok(
    hasLock,
    'regen-routing-docs.mjs has no concurrency guard. Two simultaneous invocations can ' +
    'interleave readFileSync+writeFileSync and corrupt the on-disk content. ' +
    'In practice, the script is ~250ms so the window is small. Recording as minor.'
  );
});
