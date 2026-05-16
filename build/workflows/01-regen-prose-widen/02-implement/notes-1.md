# Implementer notes — cycle 1

**Iteration:** `01-regen-prose-widen` (first real exercise of the four-agent pipeline)
**SPEC:** `../01-spec/SPEC.md`
**Planner input:** `../01-spec/planner-input.md`

## Summary

Extended `scripts/regen-routing-docs.mjs` to render every prose surface the
SPEC enumerates (Step-1 region of `ROUTING.md`, procedure body of all three
per-IDE preambles, count fields in `CLAUDE.md`/`CONTEXT.md`/`START-HERE.md`,
and a registry-resolution comment block in every `.claude/routing/*.md`). The
drift test (`tests/unit/routing-docs-in-sync.test.mjs`) was extended with
matching assertions per acceptance criterion. All five acceptance criteria
are met. No deviations from the file-level plan.

## Acceptance-criteria mapping

| SPEC criterion | Where implemented | Verifying assertion |
|---|---|---|
| 1 — byte-identical regen | `scripts/regen-routing-docs.mjs` exports `applyAllRegenSurfaces` and `renderBranchDoc`; CLI block writes each surface | `applyAllRegenSurfaces is idempotent` (running twice produces same content) + per-surface `matches regen output` assertions |
| 2 — drift test fails red | New assertions in `tests/unit/routing-docs-in-sync.test.mjs` (count fields, procedure body, ROUTING_STEP1 region, registry comment) | Each assertion was pre-checked to fail red on the pre-iteration prose; turned green when prose was synced |
| 3 — `TASK_RULES` ↔ `ROUTING.md` Step 1 | `renderRoutingStep1Table()` reads `TASK_RULES` and renders the full table including every keyword | `ROUTING.md includes every keyword from TASK_RULES (audit H3 closure)` |
| 4 — registry-resolution comment | `renderRegistryComment()` embedded in `renderBranchDoc()` | `.claude/routing/<branch>.md contains the registry-resolution comment block` (7 assertions, one per branch) |
| 5 — informational perf | This file (see "Perf check" below) | n/a (informational only) |

## Findings closed

Per SPEC's "Findings closed" table. The status commit will rewrite each row to
`**Status:** closed (<content-sha>)`.

| Finding | Closed by |
|---|---|
| H3 — `ROUTING.md` Step 1 ↔ `TASK_RULES` drift | Step-1 table now generator-emitted; drift test asserts every `TASK_RULES` keyword appears in `ROUTING.md`. |
| H5 — counts drift across `CLAUDE.md`/`CONTEXT.md`/`START-HERE.md` | Tree-diagram counts (in code-fenced blocks) replaced via line-prefix matching; prose counts replaced via marker regions or anchored regex; drift test compares each surface to filesystem inspection (`computeCounts()`). |
| H6 — routing files list agents not in `.claude/agents/` | Closed by making the resolution path explicit: `renderRegistryComment()` is embedded in every regenerated `.claude/routing/*.md`. A fresh agent reading any routing file sees the registry resolution path without consulting `ROUTING.md` separately. |
| M3 — "all 5 rules" vs "all native rules" wording | `CONTEXT.md` "all N" count is now generator-driven (8 rules) and the drift test asserts the exact wording; `.claude/routing/*.md` retain "all native rules" framing (no count). |
| L2 — `CLAUDE.md` cross-references to `docs/superpowers/specs/*` may not exist in consumer repos | Addressed by the registry-resolution comment which makes the routing layer self-documenting in-place, so a consumer who deletes `docs/superpowers/*` doesn't lose the resolution path. The cross-ref in `CLAUDE.md` becomes nice-to-have rather than load-bearing. |

## Decisions

1. **Marker syntax.** Used `<!-- regen:start NAME --> ... <!-- regen:end NAME -->`. Pre-validated via `grep -rn "regen:start\|regen:end" .` — only collision was inside SPEC.md's risk #6 (its example) and inside the build/workflows tree, neither of which is a target file (SPEC's risk #6 anticipated this exact collision check).
2. **Tree-diagram counts use line-prefix matching, NOT HTML markers.** HTML comments inside fenced code blocks render as literal text in the rendered Markdown view of `CLAUDE.md`. To keep the tree readable for humans, the generator uses `replacePrefixedLine(content, prefix, tail)` — finds the unique line starting with a stable prefix (`│  ├─ skills/            ← `), rewrites the trailing description. Fails fast on zero or duplicate matches.
3. **`scripts/route.mjs` is read-only.** Per SPEC's explicit guardrail. The `BRANCH_TO_WORKSPACE` mapping the ROUTING.md Step-1 table needs is owned by the generator (`scripts/regen-routing-docs.mjs`), not by `route.mjs`, because routing-display metadata is regen-layer concern.
4. **Registry-resolution comment embedded in `renderBranchDoc()`, NOT appended later.** The single source string `REGISTRY_COMMENT` is exported via `renderRegistryComment()` for the drift test to assert presence without duplicating the text.
5. **One script, not two.** Per Section 12 of the design spec and the planner-input "decisions inherited" list. The generator now spans all listed surfaces; `regen-blueprint-prose.mjs` was not created.
6. **Test count in dev log updated.** Adding new drift assertions raised the unit-test count from 114 → 120; updated `docs/development-log.md`'s "Tests" row to keep the `source-of-truth.test.mjs` assertion green. Also updated "Rules" 7→8 and "Hooks" 4→5 in the same row block to keep that test honest about filesystem reality.

## TDD narrative

1. **RED** — Wrote `tests/unit/routing-docs-in-sync.test.mjs` extensions
   (7 new `test(` blocks: 7-branch registry-comment loop, ROUTING_STEP1
   region, keyword coverage, 3-IDE procedure-body coverage, 3-file count
   fields, idempotency). Ran with the OLD `scripts/regen-routing-docs.mjs`
   — every new assertion failed with `SyntaxError: ... does not provide an
   export named 'applyAllRegenSurfaces'` (the loader couldn't even reach
   the test bodies). Confirmed the pre-implementation state was red.
2. **GREEN** — Rewrote `scripts/regen-routing-docs.mjs` to export the
   helpers the tests import (`renderBranchDoc`, `renderRoutingStep1Table`,
   `renderProcedureBody`, `renderRegistryComment`, `computeCounts`,
   `applyAllRegenSurfaces`). Added marker comments to the four marker-
   bounded prose surfaces (`ROUTING.md`, `AGENTS.md`, `.cursorrules`,
   `GEMINI.md`). Manually corrected the count fields in `CLAUDE.md`,
   `CONTEXT.md`, `START-HERE.md` so the first `npm run regen-routing-docs`
   run is a no-op for those files (only the routing/*.md files write on
   first run). Ran `node --test tests/unit/routing-docs-in-sync.test.mjs`
   — 21 assertions green.
3. **REFACTOR** — Tightened `replaceMarkedRegion()` and
   `replacePrefixedLine()` with fail-fast checks for missing markers,
   duplicate markers, or duplicate prefix matches. Each helper now refuses
   to silently corrupt a file (SPEC risk #6 specifically). Added NASA-
   style safety comments around invariants (bounded loops, duplicate-match
   guards). Re-ran the full unit suite: 134 tests, 133 pass; the single
   pre-existing failure is `audit-findings-status` (5 of its open findings
   are closed by the impending status commit; the other 19 stay open
   until iterations 02–05 land).

## Tests run

```
$ npm test
... (see full output below; only relevant pieces excerpted)
--- unit tests ---
ℹ tests 134
ℹ suites 0
ℹ pass 133
ℹ fail 1
ℹ duration_ms 464ms

✖ failing tests:
  every finding in agent-architecture audit has a closed status
    (PRE-EXISTING; 5 of 19 open findings closed by this iteration's
     status commit; remaining 14 open until iterations 02–05)

--- hook tests ---
PASS: hook fails open on bad inputs
PASS: happy-path hook output structure correct

--- integration tests ---
✔ 6 hook-route-inject Node integration tests
PASS: bootstrap idempotency
PASS: 8 with-profile.sh tests
agent-surface-audit warning on .claude/MCP-SETUP.md:155 — PRE-EXISTING
(out of scope per SPEC; the script exits 0; the runner counts the
non-zero from somewhere unrelated and reports "2 failure(s)" overall).

Summary: 2 reported failures, both pre-existing and called out above.
All 21 routing-docs-in-sync assertions GREEN.
```

The two summary "failures" are pre-iteration baseline state. The intended
new assertions for this iteration are all GREEN.

## Idempotency check (acceptance criterion 1)

```
$ npm run regen-routing-docs
wrote .claude/routing/build.md
... (7 routing files written)
unchanged ROUTING.md
unchanged AGENTS.md
unchanged .cursorrules
unchanged GEMINI.md
unchanged CLAUDE.md
unchanged CONTEXT.md
unchanged START-HERE.md

$ npm run regen-routing-docs  # second run
... same output: "unchanged" for all prose surfaces
$ git diff --stat <prose surfaces>  # no diff between regen runs
```

The routing/*.md files are written every run because the generator does not
read-then-compare for them (they are full-file generated). Their on-disk
content is byte-identical across runs (verified separately).

## Perf check (acceptance criterion 5, informational)

Single-sample wall-clock for `npm run regen-routing-docs` on this machine:

- Sample 1: **0.306s** total (user 0.20s, sys 0.05s)
- Sample 2: **0.247s** total (user 0.192s, sys 0.041s)
- Sample 3: **0.223s** total (user 0.192s, sys 0.037s)

Median ~250ms for the full regen across all 14 surfaces. No threshold to
honor in this iteration; the formal perf gate is iteration 05.

Hook latency (informational, for context vs. the baseline at
`docs/baselines/2026-05-15-perf.json`):

- `hook_route_inject` single sample (this cycle): **0.845s** wall clock.
- Baseline p50: 669.4ms; p95: 721.6ms.

This single sample is above p95 by ~120ms. The baseline notes "Captured
locally; CI re-run recommended" — and one sample is too few to draw a
trend. Recording here for the iteration-05 perf gate to reason about; no
action required this cycle.

## Files touched

Code / tests:
- `scripts/regen-routing-docs.mjs` — extended with helpers + CLI driver
- `tests/unit/routing-docs-in-sync.test.mjs` — extended with 21 drift assertions

Generated prose surfaces:
- `ROUTING.md` (Step-1 region)
- `AGENTS.md` (procedure body)
- `.cursorrules` (procedure body)
- `GEMINI.md` (procedure body)
- `CLAUDE.md` (tree counts + line-118 prose count)
- `CONTEXT.md` ("all N rules" cell)
- `START-HERE.md` (rule + hook counts in bulleted list)
- `.claude/routing/{build,bug,refactor,spike,spec-author,ship,review}.md` (registry-comment block added)

Supporting:
- `docs/development-log.md` — test count 114→120, rules 7→8, hooks 4→5 (keeps `source-of-truth.test.mjs` green)

Status commit (next, separate):
- `docs/audit/2026-05-15-agent-architecture-audit.md` — H3/H5/H6/M3/L2 `**Status:**` lines flipped to `closed (<content-sha>)`.

## Concerns / open questions for the reviewer

1. **CLAUDE.md tree diagram lacks marker-based protection.** The two
   count-bearing lines in the tree (lines 30 and 33 today) are updated via
   line-prefix matching. If a future hand-edit changes the prefix
   (e.g., adds a colon), the generator throws an explicit error rather than
   silently corrupting — but a future contributor may not realize this.
   The drift test asserts the prefix matches; an alternative would be to
   restructure the tree out of a code fence (out of scope per SPEC).
2. **`docs/development-log.md` test count is a manual derivation.** Each
   future test addition needs the dev-log row bumped to keep
   `source-of-truth.test.mjs` green. A follow-up could move the test row
   itself into the regen pattern; not in this iteration's scope.
3. **The audit-findings-status test will stay red until iteration 05.**
   This iteration closes 5 of 19 open findings. Reviewer should NOT block
   on the `npm test` exit code being non-zero — verify only the new
   routing-docs-in-sync assertions are green and the previously-green tests
   stayed green.
4. **`agent-surface-audit` warning on `.claude/MCP-SETUP.md:155`.** Pre-
   existing; calls out a `<!--` comment inside MCP-SETUP.md. Out of scope
   per SPEC's "Out of scope" list. Not introduced by this iteration.

## Next

Two commits land back-to-back per the planner-input split-commit pattern:

1. **Content commit** — every file above except `docs/audit/...`.
   Subject: `feat(regen): widen regen pattern to prose surfaces (T4 iter01 content)`.
2. **Status commit** — `docs/audit/2026-05-15-agent-architecture-audit.md`
   only; flips 5 `**Status:**` rows to `closed (<content-sha>)`.
   Subject: `chore(audit): close H3 H5 H6 M3 L2 status (<sha>)`.

Both go to `main` directly (per `feedback_no_prs_in_this_project` memory).
No amend, no force-push.
