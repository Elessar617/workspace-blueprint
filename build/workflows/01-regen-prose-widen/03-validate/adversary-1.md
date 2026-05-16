---
cycle: 1
findings: minor
findings-summary: 4 robustness gaps confirmed via probe tests; all minor; no SPEC criteria violated
---

# Adversary report — Iteration 01, cycle 1

**Diff under attack:** `git diff 1100d56..cbd8005` (two commits: `7f54be3` content + `cbd8005` audit status)
**Probe test:** `tests/unit/regen-adversary-probe.test.mjs` (11 probes, 7 pass, 4 fail — failures classified below)

## Attack surface considered

Probes A1–A11 covered:

| Probe | Category | Result |
|---|---|---|
| A1 | Hardcoded breakdown arithmetic in CLAUDE.md tree | ✅ pass — generator emits matching breakdown |
| A2 | `countHooks()` doesn't skip dotfiles / swap files | ❌ fail — minor robustness gap |
| A3 | `replaceMarkedRegion` doesn't validate marker-free inner content | ❌ fail — self-healing on next run |
| A4 | CONTEXT.md regex on duplicate-pattern input | ✅ pass — throws `matched twice` loudly |
| A5 | Every TASK_RULES branch has BRANCH_TO_WORKSPACE entry | ✅ pass — all 8 branches covered |
| A6 | Empty content / degenerate state | ✅ pass — throws clear marker errors |
| A7 | Prefix-line failure (CLAUDE.md tree-line) | ✅ pass — throws "prefix not found" |
| A8 | Scope gap — counts in non-regenerated files | ✅ pass (informational) |
| A9 | CRLF line-ending handling | ❌ fail — mixes CRLF and LF |
| A10 | Unknown surface name passthrough | ✅ pass (confirmed silent) — recorded as minor in review |
| A11 | Concurrency guard (no flock) | ❌ fail — minor race window (~250ms) |

## Tests written

- `/Users/gardnerwilson/workspace/github.com/elessar617/workspace-blueprint/tests/unit/regen-adversary-probe.test.mjs` — 11 probe assertions, each documented with the finding it probes and the rationale. Each test header references the adversary-1.md finding ID.

## Critical findings

**None.** No probe revealed a violation of the SPEC's 5 acceptance criteria. The implementer's design choices (loud-failure on prefix mismatch, marker presence validation, deterministic readdirSync, empty-content rejection) are robust against the strong attack vectors.

## Minor findings (deferred)

Recorded for future cleanup; do NOT block promotion to 04-output.

### A2 — `countHooks()` does not skip hidden / backup `.sh` files

**Probe failure:** `tests/unit/regen-adversary-probe.test.mjs:65`
**Mechanism:** `countHooks()` filters `f.endsWith('.sh')` but doesn't exclude `f.startsWith('.')`. A developer-local `.swp.sh` or `.bak.sh` would inflate `counts.hooks`. No current files trigger it.
**Severity:** minor. Recommended follow-up: extend filter to exclude `^\.` entries.

### A3 — `replaceMarkedRegion` doesn't validate marker-free inner content

**Probe failure:** `tests/unit/regen-adversary-probe.test.mjs:95`
**Mechanism:** A future caller that interpolates a marker into the inner content (escape error, nested template) produces a file with duplicate markers. The NEXT regen run blows up loudly via the "duplicate start marker" check. This is a self-healing failure mode (loud failure within one cycle), so minor.
**Severity:** minor. Recommended follow-up: pre-validate that `inner.includes(startMarker)` is false before write.

### A9 — Generator does not normalize CRLF / LF mixing

**Probe failure:** `tests/unit/regen-adversary-probe.test.mjs:282`
**Mechanism:** If a Windows contributor saves CLAUDE.md with CRLF and runs `npm run regen-routing-docs`, the output mixes CRLF (original lines) and LF (regenerated lines). Git treats this as a diff on every line. Drift test would also fail loudly the next run.
**Severity:** minor (no current contributor on Windows; loud failure surfaces it before silent corruption). Recommended follow-up: normalize line endings on read OR document LF-only contract in the generator.

### A11 — No concurrency guard on regen

**Probe failure:** `tests/unit/regen-adversary-probe.test.mjs:338`
**Mechanism:** Two simultaneous `npm run regen-routing-docs` invocations can interleave `readFileSync`+`writeFileSync` and corrupt output. The script completes in ~250ms (per implementer perf check) so the window is small. No filesystem advisory lock.
**Severity:** minor. Recommended follow-up: optional `flock` wrapper at the CLI entry, or document the constraint.

### A10 (recorded but probe passed) — Silent passthrough on unknown surface names

`applyAllRegenSurfaces` accepts unknown surface names and returns the input unchanged. The CLI hard-codes the surface list so the gap doesn't fire in practice. Minor; recommended follow-up to throw on unknown.

### A8 (informational) — Other files contain count statements

`README.md`, `.claude/MCP-SETUP.md`, `docs/development-log.md` (its Skills row) contain count-like prose phrases that this iteration explicitly scoped out. The SPEC carved them out as out-of-scope; H5 is "partially" closed in the sense that the three CORE map files now stay in sync but a couple of peripheral docs may still drift. Not a SPEC violation; recorded for visibility.

## Adversary's understanding of "what's next"

Per `docs/orchestrator-process.md` Phase 2 Step C action table:
- `verdict: pass` + `findings: minor` → **Promote to 04-output**, deferred minors recorded here for follow-up.

End of adversary report.
