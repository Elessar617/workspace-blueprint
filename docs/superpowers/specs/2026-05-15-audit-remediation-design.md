# Audit Remediation — Design Spec

**Date:** 2026-05-15
**Author role:** Planner (per `docs/orchestrator-process.md`)
**Brainstorming skill:** `superpowers:brainstorming` (with `andrej-karpathy-skills:karpathy-guidelines` overlay)
**Status:** Approved by user; awaiting transition to `superpowers:writing-plans`.

**Inputs:**
- [`docs/audit/2026-05-15-agent-architecture-audit.md`](../../audit/2026-05-15-agent-architecture-audit.md) — 12-layer agent-stack audit (4 critical, 8 high, 11 medium, 5 low)
- [`docs/audit/2026-05-15-architecture-deepening-audit.md`](../../audit/2026-05-15-architecture-deepening-audit.md) — module-depth audit (5 deepening candidates)

---

## 1. Goal and framing

**Get workspace-blueprint to a finalized state** such that downstream repos can fork it and trust its invariants. This is the canonical scaffolding source per `CLAUDE.md`; consumers will read the prose claims and trust them. "Finalized" therefore means **the invariants consumers depend on actually hold in code, not just in prose**.

The work is bounded by audit-completeness (strict mode, user-confirmed): close every audit finding plus address performance + security as first-class concerns. Aspirational timeline (user-confirmed) — sequence by combined leverage and intellectual coherence rather than deadline pressure.

### What "finalized" means concretely

Five existing pressures from the audits, plus two added by the user during brainstorming:

1. **Prose-vs-code alignment.** Anything map files claim is enforced must actually be enforced for the surfaces claimed.
2. **Drift guards for derived prose.** Source-of-truth → derived files must be regenerable with a drift test.
3. **No silent failures.** Hooks fail visibly when they go wrong.
4. **The four-agent pipeline works on at least one real task.** Exercises the central deliverable.
5. **Memory/instinct contamination is bounded.** Consumer forks don't inherit prior session monologue.
6. **Performant.** No measurable regression in hook latency, test duration, registry rebuild.
7. **Safe.** Security review of agent/hook/MCP/permission/secret surfaces plus broader OWASP-pattern review.

### What "finalized" does NOT mean

- Feature-complete (this is a scaffold; consumers extend it).
- Zero future audits (audits will reveal more as the scaffold matures).
- Frozen API (the scaffold's surfaces will evolve as Claude Code does).

---

## 2. Approach — Deepening-first cascade

User-confirmed choice (Approach A) over criticals-first vertical and parallel tracks. Rationale:

- Deepening candidate #1 (hook scaffolding) alone closes 4 audit findings (C2, H2, M4, M8). Candidate #2 (regen pattern) closes 3 (H3, H5, M3). Candidate #3 (route CLI extract) is preconditional for fixing C1/C3 cleanly.
- Fixing each finding in isolation patches shallow modules N times before later refactoring them — overcomplicated per karpathy guideline #2.
- Deepening-first means every later commit traces directly to one finding cluster; commit history is coherent for consumers.

---

## 3. Iteration map

Five iterations through the standard `build/workflows/NN-<slug>/` pipeline plus ten direct commits and one pre-iteration baseline capture. Every audit finding plus new security findings map to one of these.

### Pre-iteration step

One direct commit to capture performance baselines BEFORE iteration 01 starts.

```
feat(bench): capture pre-finalize performance baselines
```

Adds `scripts/bench.mjs` and writes `docs/baselines/2026-05-15-perf.json`:

```json
{
  "captured_at": "<iso8601>",
  "captured_against_sha": "346431e",
  "captured_in_env": "ci",
  "samples": 10,
  "metrics": {
    "hook_route_inject":      { "p50_ms": "<n>", "p95_ms": "<n>", "p99_ms": "<n>" },
    "npm_test_duration":      { "p50_ms": "<n>", "p95_ms": "<n>", "p99_ms": "<n>" },
    "rebuild_registry":       { "p50_ms": "<n>", "p95_ms": "<n>", "p99_ms": "<n>" },
    "route_mjs_heap_peak_bytes": "<n>"
  },
  "test_counts": {
    "unit": 111, "hook": 2, "integration": 10
  },
  "registry_total_records": 833
}
```

Each metric is n=10 samples; gate compares median-to-median with **5% tolerance**.

### Iterations (full four-agent pipeline)

| # | Slug | Scope | Closes |
|---|---|---|---|
| **01** | `01-regen-prose-widen` | Extend `scripts/regen-routing-docs.mjs` (or sibling) to also generate `ROUTING.md` Step 1 region, `AGENTS.md`, `.cursorrules`, `GEMINI.md`, and filesystem-derived counts in `CLAUDE.md`/`CONTEXT.md`/`START-HERE.md`. Add a sister drift test mirroring `tests/unit/routing-docs-in-sync.test.mjs`. Add an explicit "names resolve via `.claude/registry/*.json`" comment block to each regenerated routing file (closes H6: routing files list agents not in `.claude/agents/`). | H3, H5, H6, M3, L2 (5) |
| **02** | `02-hook-scaffolding` | Extract shared hook preamble (profile-gate, JSON parse, tool-name matcher, target extract) into one helper. Add `Bash`-write-redirect matcher pattern so block hooks gain bash-bypass protection. Replace `route-inject.sh`'s bash + `node -e` chain with a single Node script using the same helper; new script adds `[INJECTION TRUNCATED]` marker when budget exceeded (closes M7). Add error logging to `.claude/routing/.last-error.log`. Update `.claude/agents/{adversary,reviewer}-agent.md` to read prior-cycle findings. Add fixture test `tests/integration/h1-cross-cycle-awareness.test.mjs`. | C2, H2, H1, M4, M7, M8, L3 (7) |
| **03** | `03-route-cli-extract-and-gate` | Move `route.mjs` CLI block (lines 326–381) to `scripts/route-cli.mjs`. Make `route.mjs` import-safe (zero side effects on import). Add `PreToolUse(Skill)` hook recording invocations to `.claude/routing/.current.json`. Add `PreToolUse(Task)` hook refusing dispatch when `cached.mandatories ⊄ invoked_skills`. Move `enforce-portability.sh` to PreToolUse with content extraction. | C1, C3, M6/F7.3 (3) |
| **04** | `04-instinct-gate-registry-tighten` | Gate `readInstincts()` behind `BLUEPRINT_INSTINCTS` env flag (default off). Trigger-aware filtering in `instinct-reader.mjs` (`inst.trigger` substring against prompt + files-in-scope). Confidence decay (halve per 30 days idle). Update `.claude/skills/handoff/SKILL.md` to require `created:` and `applies_to:` frontmatter; document that handoff docs >24h old don't auto-surface (closes H7). Update `rebuild-registry.mjs` to fail when same name appears in both `ecc-skills.json` and `harness-skills.json` without explicit `prefer:` in `ecc-config.json`. Document the gate in `.claude/MCP-SETUP.md`. | C4, H7, H8, M5, H4 (5) |
| **05** | `05-perf-security-hardening` | Run `/ecc:security-scan` (AgentShield) AND `/ecc:security-review` (broader OWASP). Audit hook scripts for shell-injection (`jq -r` extractions, `node -e` chains). Audit `permissions.deny` completeness. Audit MCP server scopes (the 7 in `settings.json`). Secret scan across working tree + git history. Run final benchmark vs. baselines (5% median-to-median). Add `tests/perf/baseline-guard.test.mjs`. Any new security findings recorded in `docs/audit/2026-05-15-security-audit.md` with same `status:` mechanism. | New security findings + perf regression guards |

### Direct commits

Each lands as a single conventional-commits commit. Each closes exactly one audit finding (named in body).

| Commit type | Scope | File(s) | Closes |
|---|---|---|---|
| `docs(agents)` | reviewer-vs-tests reconciliation | `.claude/agents/reviewer-agent.md` | M1 |
| `docs(agents)` | filename convention sync | 4 files referencing `review-N.md` | M2 |
| `docs(dev-log)` | dedupe memory facts | `docs/development-log.md` | M9 |
| `docs(process)` | cycle-archive note | `docs/orchestrator-process.md` | M10 |
| `feat(rules)` | memory-discipline rule | `.claude/rules/memory-discipline.md` (new) | M11 |
| `docs(rules)` | adversary marker carve-out | `.claude/rules/code-quality.md` | L1 |
| `docs(settings)` | hook ordering comment | `.claude/settings.json` | L4 |
| `docs(setup)` | ECC summary note | `.claude/MCP-SETUP.md` | L5 |
| `refactor(scrapers)` | unified scraper interface | `scripts/lib/{ecc,harness,native}-scraper.mjs` | Deepening #4 |
| `test(hooks)` | hook-registration invariant | `tests/unit/source-of-truth.test.mjs` (extend) | Deepening #5 |

### Items that need no work (audit-confirmed absent)

- N1 — no retry/repair loops re-invoking the model
- N2 — no PostToolUse/Stop hooks mutating conversation channel
- N3 — no session history leakage between Claude Code processes

These get `status: closed-by-absence` rather than `status: closed (SHA)`.

---

## 4. Success criteria

Per karpathy guideline #4 ("Goal-Driven Execution"), every change has a verifiable goal. The criteria below double as iteration acceptance criteria — the reviewer agent uses them to set `verdict: pass`.

### Per-iteration acceptance criteria

**Iteration 01 (`regen-prose-widen`)**
- `npm run regen-routing-docs` produces byte-identical output for `.claude/routing/*.md`, the Step-1 region of `ROUTING.md`, all three per-IDE preambles, and counts in `CLAUDE.md`/`CONTEXT.md`/`START-HERE.md`.
- A drift test (extension of `tests/unit/routing-docs-in-sync.test.mjs`) fails red when any source-of-truth diverges from rendered output; green when synced.
- After landing: `TASK_RULES` keywords and `ROUTING.md` Step 1 table fully agree (drift test passes).
- Every regenerated `.claude/routing/*.md` file contains a comment block explaining that agent/skill/MCP names resolve via `.claude/registry/*.json` (closes H6 by making the resolution layer explicit rather than implicit).
- Performance: informational single-sample check noted in `02-implement/notes-N.md`.

**Iteration 02 (`hook-scaffolding`)**
- All 5 hooks invoke a shared scaffold for input parsing + tool-matching. Each hook file shrinks to ≤25 lines after refactor.
- Integration test simulates `Bash(echo "x" > /tmp/wb-test/build/workflows/X/04-output/foo.md)` and asserts it's blocked by `block-output-without-signoff.sh` (fixture path, not real `build/workflows/`).
- Integration test simulates `git -C /tmp/wb-test commit -m foo` with code-without-tests staged and asserts `pre-commit-tdd.sh` blocks it.
- Unit test for new scaffold's error-logging asserts that when inner check throws, `.claude/routing/.last-error.log` gets a single line with timestamp + hook name + error.
- The 6 existing `route-inject` integration tests pass against rewritten Node version (no regression).
- **H1 fixture test**: `tests/integration/h1-cross-cycle-awareness.test.mjs` creates a fake `build/workflows/test-h1/` with seeded `review-1.md` and `adversary-1.md`, simulates dispatching the cycle-2 adversary per new spec, asserts prior reports appear in adversary's input.
- **M7 truncation test**: when route output exceeds the 6000-char budget, the new Node `route-inject` emits a `[INJECTION TRUNCATED]` marker rather than silently chopping mid-content. Verified by unit test with a fixture oversized output.
- Performance: informational single-sample check.

**Iteration 03 (`route-cli-extract-and-gate`)**
- Node test `import { route } from '../../scripts/route.mjs'` asserts no `console.log` called, no `.claude/routing/.current.json` modified, no registry filesystem reads (side-effect freedom verified by spy).
- Integration test launches simulated Claude session: invokes `Task` without first invoking iteration's mandatory `Skill`s; asserts new `block-task-without-mandatories.sh` hook refuses dispatch.
- Integration test asserts `enforce-portability.sh` blocks BEFORE file lands on disk (verified by `stat` showing no write).
- Existing routing-snapshots tests still pass.
- Performance: informational single-sample check.

**Iteration 04 (`instinct-gate-registry-tighten`)**
- With `BLUEPRINT_INSTINCTS` unset, `formatOutput(route(...))` contains zero `[project ...]` instinct lines (unit test).
- With `BLUEPRINT_INSTINCTS=on` AND matching `trigger`, instinct injects (unit test with fixture instincts).
- Unit test: instinct with `last_seen` 60 days ago has confidence halved twice; falls below 0.7 floor.
- `.claude/skills/handoff/SKILL.md` requires `created:` and `applies_to:` frontmatter on emitted handoff docs. The skill text instructs that consuming sessions ignore handoff content older than 24h. (H7 fix; verified by inspection — no automated test required since it's a procedural change to a markdown contract.)
- `npm run rebuild-registry` exits non-zero when fixture registry pair shares a name without `prefer:` (integration test with temp registry dirs).
- Performance: informational single-sample check.

**Iteration 05 (`perf-security-hardening`)**
- `/ecc:security-scan` runs cleanly. Findings recorded in new `docs/audit/2026-05-15-security-audit.md` with `status:` frontmatter.
- `/ecc:security-review` runs cleanly. Findings same file.
- Manual checks documented in `02-implement/notes-N.md`:
  - Shell-injection audit of hooks (`jq -r` extractions confirmed safe, `node -e` chains confirmed safe)
  - MCP scope audit (the 7 in `settings.json` each justified)
  - `permissions.deny` completeness (vs. OWASP-relevant patterns)
  - Secret scan (`gitleaks detect` or equivalent) returns zero findings across working tree + history
- Final benchmark vs. baselines: all metrics within **5% median-to-median tolerance**. Documented in `04-output/`.
- `tests/perf/baseline-guard.test.mjs` exists and runs as part of `npm test` in CI environment.
- All security findings from this iteration `status: closed (SHA)`.

### Direct-commit acceptance criteria

Each direct commit references exactly one audit finding ID in body. Verification = file change closes finding by inspection (audit's "Evidence" line points at diff). Code-changing commits (Deepening #4, #5) include tests.

### Cross-cutting finalize gate

A single test, `tests/unit/audit-findings-status.test.mjs`, asserts:

1. Every finding row in `docs/audit/2026-05-15-agent-architecture-audit.md` has `status: closed (<sha>)` or `status: closed-by-absence`.
2. Every finding row in `docs/audit/2026-05-15-architecture-deepening-audit.md` has `status: closed (<sha>)`.
3. Every finding row in `docs/audit/2026-05-15-security-audit.md` (created by iteration 05) has `status: closed (<sha>)`.
4. `tests/perf/baseline-guard.test.mjs` passes (in CI environment).

`npm test` green = strict-mode achieved + safe + performant. This is the **finalize gate**.

---

## 5. Sequencing and dependencies

### Hard ordering constraints

1. **Baseline before iteration 01** — required for any perf-regression check downstream.
2. **Iteration 02 before iteration 03** — 03's new `PreToolUse(Skill)` and `PreToolUse(Task)` hooks use 02's shared scaffold; adding them as standalone bash hooks first and refactoring later is the duplication Approach A explicitly rejects.
3. **Iteration 05 last** — security and performance findings depend on the final system shape.

### Soft ordering (flexible)

- Iteration 01 can move to after 02 without harm; default is 01 first as the cheapest landable proof of pattern.
- Direct commits can land any time after their target file's iteration completes.
- Deepening #4 (scraper unification) is independent and can land anywhere after iteration 01.

### Dependency graph

```
                pre-iteration baseline capture
                          │
                          ▼
            ┌─ 01 regen-prose-widen ─┐
            │                         │
            ▼                         ▼
       02 hook-scaffolding ◄── direct commits (M1, M2, M9, M10, L1, L4, L5)
            │                  any order; can interleave
            ▼
       03 route-cli-extract-and-gate
            │  (needs 02's scaffold)
            ▼
       04 instinct-gate-registry-tighten
            │
            ▼  + remaining direct commits (M11, Deepening #4, #5)
       05 perf-security-hardening
            │  (final pass)
            ▼
       Finalize-gate test green → done
```

---

## 6. Rollback strategy

Each iteration commits to a feature branch (e.g., `feat/02-hook-scaffolding`). One merge commit per iteration into `main`.

| Failure mode | Response |
|---|---|
| Cycle 1–4 reviewer or adversary blocks | Normal — implementer revises in next cycle. No rollback. |
| Cycle 5 exhausted without `verdict: pass` (`block-cycle-overrun.sh` engages) | Hook ENFORCES the stop. Halt iteration. Re-scope SPEC in a new spec doc; restart as new iteration with adjusted scope. |
| Iteration lands but `tests/perf/baseline-guard.test.mjs` fails (CI) | Two paths: (a) revert the iteration's merge commit and re-iterate; (b) record performance debt in iteration 05's input list with a **named, defensible reason** and continue. Decision criterion (user-confirmed): named reason → continue; otherwise → revert. |
| Iteration lands but breaks an unrelated test | Revert. Per karpathy #3 (surgical changes), unintended breakage is by definition out-of-scope. |

---

## 7. Commit hygiene

Per `.claude/rules/commit-discipline.md`:

- Conventional Commits format throughout.
- **One merge commit per iteration** (user-confirmed cleaner log). Internal commits collapse via `--squash` merge or `--no-ff` with comprehensive merge-commit body citing every closed finding ID by audit-ID and the verifying test name.
- Each direct commit closes one audit finding; body names the finding ID and quotes the `status:` change.
- No `--amend` after push, no `--no-verify`, no force-push to `main`. Bypassing hooks is the failure mode we are remediating; doing it ourselves would be self-parody.

---

## 8. Work estimate

- Pre-iteration baseline: ~30 minutes (one-shot script + run + commit JSON).
- Iteration 01: ~1 cycle; half a day.
- Iteration 02: 2–4 cycles expected (meaty); 1–2 days.
- Iteration 03: 1–2 cycles; half a day to a day.
- Iteration 04: 1–2 cycles; half a day.
- Iteration 05: 1–3 cycles (security findings drive cycle count); 1–2 days.
- Direct commits: 10 commits, ~2 hours total.

**Total:** 4–7 days of focused work for a single developer. Compatible with the aspirational timeline.

---

## 9. Files this design will create or significantly modify

New files:
- `scripts/bench.mjs`
- `docs/baselines/2026-05-15-perf.json`
- `tests/perf/baseline-guard.test.mjs`
- `tests/integration/h1-cross-cycle-awareness.test.mjs`
- `tests/unit/audit-findings-status.test.mjs`
- `scripts/route-cli.mjs` (extracted from `scripts/route.mjs`)
- `.claude/hooks/block-task-without-mandatories.sh` (or scaffold-based equivalent)
- `.claude/hooks/record-skill-invocation.sh` (or scaffold-based equivalent)
- `.claude/rules/memory-discipline.md`
- `docs/audit/2026-05-15-security-audit.md` (populated by iteration 05)
- `build/workflows/01-regen-prose-widen/` through `05-perf-security-hardening/` (five iteration dirs with the standard subdir layout)

Significantly modified files:
- `scripts/route.mjs` (CLI block extracted; remains the pure routing brain)
- `scripts/regen-routing-docs.mjs` (or a sibling) — extended to generate `ROUTING.md`, per-IDE preambles, map-file counts
- All five `.claude/hooks/*.sh` — refactored against shared scaffold
- `.claude/settings.json` — new `PreToolUse(Task)` and `PreToolUse(Skill)` matchers; portability moved to PreToolUse
- `scripts/lib/instinct-reader.mjs` — gate, trigger filter, decay
- `scripts/lib/{ecc,harness,native}-scraper.mjs` — unified interface
- `.claude/agents/{adversary,reviewer}-agent.md` — prior-cycle inputs
- Both audit files — `status:` field added to each finding row
- 8 prose files for direct commits

---

## 10. Out of scope

Per karpathy #2 ("Simplicity First — no features beyond what was asked"):

- **Unifying the four agent specs.** Differences are load-bearing. Deletion-test moves complexity rather than concentrating it. Documented as a skip in the deepening audit.
- **Consolidating 11 registry JSONs.** Split reflects real origin differences; source-rank order depends on it. H4 (overlap silently resolved) is fixed without consolidation.
- **Refactoring `.claude/skills/*` to share a contract.** Conflicts with vendored-skill license attribution.
- **New feature work.** This pass closes audit findings. No new scaffold features.

---

## 11. What gets handed to `writing-plans`

The brainstorming skill terminates by invoking `superpowers:writing-plans` to convert this design into an executable implementation plan. The implementation plan will:

1. Decompose this design into a numbered task list per iteration.
2. For each iteration, define cycle-by-cycle deliverables.
3. For each direct commit, define the exact diff intent (file + finding + verification test).
4. Establish the order of commits and the merge-commit message templates.
5. Identify which existing tests need updating vs. which new tests need creating.

Once the implementation plan is approved, individual iterations begin (planner agent → SPEC.md → implementer → reviewer/adversary cycles → output).

---

## 12. Open questions for the implementation-plan stage

These do not block this design; they get answered during `writing-plans`:

- **Hook scaffold language.** Pure-bash shared include vs. Node helper invoked from thin bash wrapper. Tradeoff: bash is closer to the existing pattern; Node is closer to the routing brain and reuses existing test infrastructure. The implementation plan picks one with a written rationale.
- **Where the regen-counts logic lives.** Extend `regen-routing-docs.mjs` (it'll grow) or create a sibling `regen-blueprint-prose.mjs`. The implementation plan decides based on whether the rendering logic stays cohesive.
- **Cache invalidation for the `PreToolUse(Skill)` recorder.** When does `cached.invoked_skills` reset — per session start, per prompt, per task? The implementation plan defines the lifecycle.

These are surfaced now per karpathy #1 ("If multiple interpretations exist, present them").

---

**End of design.** Approval gate: user reviews this committed spec before `writing-plans` is invoked.
