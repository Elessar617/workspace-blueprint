# SPEC — 01-regen-prose-widen
> Source: [`docs/superpowers/specs/2026-05-15-audit-remediation-design.md`](../../../../docs/superpowers/specs/2026-05-15-audit-remediation-design.md) (commit `e1577dd`), Sections 3 (iteration 01 row) and 4 ("Iteration 01 (`regen-prose-widen`)"). Planner inputs lifted from [`planner-input.md`](./planner-input.md).

## Scope

Widen the existing regen pattern so a single command — `npm run regen-routing-docs` — renders every derived prose surface from a single source of truth. Concretely: extend `scripts/regen-routing-docs.mjs` (no sibling script) to render the Step-1 region of `ROUTING.md`, the procedure body of all three per-IDE preambles (`AGENTS.md`, `.cursorrules`, `GEMINI.md`), and the filesystem-derived counts in `CLAUDE.md`, `CONTEXT.md`, and `START-HERE.md`. Extend `tests/unit/routing-docs-in-sync.test.mjs` so it fails red on any drift between source-of-truth (`TASK_RULES` from `scripts/route.mjs` + filesystem inspection) and rendered output. Add an explicit "names resolve via `.claude/registry/*.json`" comment block to each regenerated `.claude/routing/*.md` file so the resolution layer is documented in-place rather than implied from `ROUTING.md`.

This iteration is the first real exercise of the four-agent pipeline in this repo. Cycle expectations: one cycle for the happy path; two if drift assertions surface whitespace edge cases.

## Acceptance criteria

The five criteria below are lifted verbatim from the design spec (Section 4, "Iteration 01"). The reviewer agent uses them to set `verdict: pass`.

1. **Byte-identical regen output.** `npm run regen-routing-docs` produces byte-identical output for `.claude/routing/*.md`, the Step-1 region of `ROUTING.md`, all three per-IDE preambles (`AGENTS.md`, `.cursorrules`, `GEMINI.md`), and counts in `CLAUDE.md`/`CONTEXT.md`/`START-HERE.md`.
2. **Drift test fails red on divergence.** A drift test (extension of `tests/unit/routing-docs-in-sync.test.mjs`) fails red when any source-of-truth diverges from rendered output; green when synced.
3. **`TASK_RULES` ↔ `ROUTING.md` Step 1 agreement.** After landing: `TASK_RULES` keywords and `ROUTING.md` Step 1 table fully agree (drift test passes).
4. **Registry-resolution comment in every routing file.** Every regenerated `.claude/routing/*.md` file contains a comment block explaining that agent/skill/MCP names resolve via `.claude/registry/*.json` (closes H6 by making the resolution layer explicit rather than implicit).
5. **Informational perf check.** Performance: informational single-sample check noted in `02-implement/notes-N.md`.

## File-level plan

Implementer should treat this as the authoritative list of files touched. Anything not on this list is out of scope; deviations require either escalation or a re-planning round.

| Path | Action | Notes |
|---|---|---|
| `scripts/regen-routing-docs.mjs` | modify | Add generator helpers for: `ROUTING.md` Step-1 region, per-IDE preamble bodies, count fields in three map files, and the new "names resolve via registry" comment block in each `.claude/routing/*.md`. Single script per Section 12 decision; internal modularization via helper functions. Driver reads `TASK_RULES` from `scripts/route.mjs` (already exported) and inspects the filesystem for counts. |
| `tests/unit/routing-docs-in-sync.test.mjs` | modify | Extend with assertions covering each new output target. Each assertion must fail red on intentional drift, green on synced state. TDD order: drift assertions for new surfaces land RED before the generator code that turns them green. |
| `ROUTING.md` | modify | Step-1 region (the keyword table currently around lines 7–15) becomes generated. The rest of the file remains hand-authored. The generated region is bounded by stable comment markers (start/end) so the generator only rewrites between them. |
| `AGENTS.md` | modify | Procedure-body region regenerated; IDE-specific wrapper text (the Codex-facing framing) is preserved as a hand-authored prefix/suffix. Generated region bounded by markers. |
| `.cursorrules` | modify | Same pattern as `AGENTS.md`: Cursor-facing wrapper preserved, procedure body generated. |
| `GEMINI.md` | modify | Same pattern: Gemini-facing wrapper preserved, procedure body generated. |
| `CLAUDE.md` | modify | Count fields synced to filesystem inspection (skills count, hooks count, rules count). Generator MUST land changes within the existing dimension table; structural changes to `CLAUDE.md` are out of scope and would be a load-bearing regression (always-loaded file). |
| `CONTEXT.md` | modify | Count fields synced. Same in-place constraint. |
| `START-HERE.md` | modify | Count fields synced. Same in-place constraint. |
| `.claude/routing/bug.md` | modify | Add registry-resolution comment block. Generated. |
| `.claude/routing/build.md` | modify | Add registry-resolution comment block. Generated. |
| `.claude/routing/refactor.md` | modify | Add registry-resolution comment block. Generated. |
| `.claude/routing/review.md` | modify | Add registry-resolution comment block. Generated. |
| `.claude/routing/ship.md` | modify | Add registry-resolution comment block. Generated. |
| `.claude/routing/spec-author.md` | modify | Add registry-resolution comment block. Generated. |
| `.claude/routing/spike.md` | modify | Add registry-resolution comment block. Generated. |
| `docs/audit/2026-05-15-agent-architecture-audit.md` | modify | Update H3, H5, H6, M3, L2 rows to `**Status:** closed (<sha>)`. SHA filled via SHA-amend pattern OR (preferred per planner-input) split into a content commit and a `chore(audit):` status commit. |
| `02-implement/notes-N.md` | create | Implementer-authored. MUST contain the informational single-sample performance number for the new regen run (criterion 5) plus the standard TDD narrative. |
| `03-validate/review-N.md` | create | Reviewer-authored. |
| `03-validate/adversary-N.md` | create | Adversary-authored. |
| `04-output/` | populate at the end | Sign-off artifacts. Gated by `block-output-without-signoff.sh`. |

**Files NOT modified by this iteration** (explicit guardrails for the implementer):

- `scripts/route.mjs` — the source of truth. `TASK_RULES` is read but never rewritten by the generator. Editing the source-of-truth to match a generator bug is a category error; if drift surfaces, the generator is wrong.
- Any `.claude/skills/*` content — out of scope; closing H5/H6 does not require skill edits.
- Any `.claude/agents/*` content — out of scope for this iteration (the agent prior-cycle-input fix is iteration 02).
- `.claude/hooks/*` — out of scope.
- The IDE-specific wrapper text in `AGENTS.md`, `.cursorrules`, `GEMINI.md` outside the generator-marker block — that text differs by IDE on purpose (cache/fallback semantics per planner-input risk #3).

## Test strategy

Each acceptance criterion is verified by an assertion (or set of assertions) added to `tests/unit/routing-docs-in-sync.test.mjs`. Per `.claude/rules/testing-discipline.md`, all drift assertions land RED before the matching generator code lands GREEN. The reviewer agent checks this mapping is 1:1.

| Criterion | Verification |
|---|---|
| 1 — byte-identical regen | For each generated target (every `.claude/routing/*.md`, the Step-1 region of `ROUTING.md`, each per-IDE preamble body, each count field in the three map files), the test reads the on-disk content, computes the expected content via the same generator function the script uses, and asserts byte-for-byte equality. Idempotency: running the generator twice on already-regenerated files produces zero diff (a second run must be a no-op). |
| 2 — drift test fails red on divergence | The existing drift assertion pattern in `routing-docs-in-sync.test.mjs` already exercises this for `.claude/routing/*.md`. New assertions extend the same pattern to every new target. Reviewer agent verifies: each new assertion would actually fail under a deliberate, minimal perturbation of either source-of-truth or rendered output (e.g., a single missing keyword in `TASK_RULES`, a stale count in `CLAUDE.md`). |
| 3 — `TASK_RULES` ↔ `ROUTING.md` Step 1 | A targeted assertion compares the rendered Step-1 region of `ROUTING.md` against the table generator's output computed from `TASK_RULES`. Covers the exact drift the audit found (missing keywords: `'act as reviewer'`, `'prototype'`, `'propose'`, `'publish'`, `'cut a v'`, `'cleanup'`, `'restructure'`). |
| 4 — registry-resolution comment | An assertion iterates every file under `.claude/routing/` and verifies each contains the canonical comment block emitted by the generator. Block content is fixed (single source string in the generator), so the test compares for exact presence, not pattern match. Adversary should attempt: a file missing the block, or with mutated text. |
| 5 — informational perf | Not a unit test. Implementer records a single-sample wall-clock duration for `npm run regen-routing-docs` in `02-implement/notes-N.md`. Reviewer checks the entry exists and is plausibly numeric. No threshold; the formal perf gate is iteration 05. |

Existing tests that MUST continue to pass unmodified: all 16 unit test files listed under `tests/unit/`. The implementer runs the full suite (`npm test`) before declaring `02-implement/` done. Any regression in an unrelated test is by definition out of scope (per `.claude/rules/code-quality.md` and the karpathy "surgical changes" guideline) and the implementer reverts the offending change before continuing.

## Findings closed

This iteration closes five findings from `docs/audit/2026-05-15-agent-architecture-audit.md`. Each row's `**Status:**` line MUST be updated to `closed (<sha>)` as part of the iteration's commit chain.

| Finding | One-line summary | How this iteration closes it |
|---|---|---|
| **H3** | `ROUTING.md` Step 1 table drifts silently from `TASK_RULES`. | Step-1 region becomes generated from `TASK_RULES`; drift test fails red on divergence. |
| **H5** | Counts drift across `CLAUDE.md`, `CONTEXT.md`, `START-HERE.md`. | Count fields become generated from filesystem inspection; drift test fails red on divergence. |
| **H6** | Routing files list agents that don't exist in `.claude/agents/`. | Closed *not* by editing the lists (those names resolve via plugin registries, which is correct) but by making the resolution layer explicit: every routing file gains a comment block stating that names resolve via `.claude/registry/*.json`. A fresh agent reading any routing file sees the resolution path without having to consult `ROUTING.md` separately. |
| **M3** | Per-IDE preambles drift from the canonical procedure body. | All three preamble bodies become generated from a shared template; per-IDE wrappers preserved. |
| **L2** | (Audit's L2 row.) | Closed by the regen widening. |

The commit body for the iteration's merge MUST cite each finding ID and the verifying assertion name.

## Risks

The adversary agent reads this list and tries to extend it. Honest entries only.

1. **Byte-identity is strict.** A regenerated file with a different trailing newline, BOM, line ending, or trailing whitespace will fail the drift test. The generator must be deterministic: stable ordering (e.g., `TASK_RULES` iterated in declaration order, not by `Object.keys`), stable whitespace (single trailing newline at file end, LF only), and stable string interpolation. Any non-determinism (timestamps, current-time stamps, `Date.now()`, locale-sensitive number formatting) leaks into the rendered output and the drift test goes red intermittently.
2. **`CLAUDE.md` is "always loaded."** Accidentally breaking its structure breaks every future Claude Code session for this repo and for any downstream consumer who has already forked. The count changes MUST land within the existing dimension table; structural rewrites (adding a section, moving the table, changing heading levels) are out of scope. The marker-based generator pattern (rewrite only between explicit start/end markers) is mandatory for `CLAUDE.md`, `CONTEXT.md`, and `START-HERE.md`.
3. **Per-IDE preambles are user-facing entry points.** `AGENTS.md` (Codex), `.cursorrules` (Cursor), `GEMINI.md` (Gemini) each have IDE-specific cache and fallback semantics. The wrapper text differs on purpose (per Section 12 decisions). The generator regenerates the procedure-body region only; wrapper text is preserved. If the markers are wrong, the generator overwrites IDE-specific framing and breaks Codex/Cursor/Gemini sessions.
4. **The regen pattern, once widened, becomes harder to opt out of.** Any future file that wants to drift intentionally from the source-of-truth (e.g., a hand-authored variation in `AGENTS.md` that's narrower than `ROUTING.md`) needs an explicit carve-out (a marker that excludes a region from regen, or a separate test exception). Future contributors will need to know the regen contract or risk silently losing edits on the next `npm run regen-routing-docs`.
5. **Source-of-truth confusion under failure.** If the drift test goes red, the implementer (or a future contributor) may be tempted to "fix" `route.mjs`'s `TASK_RULES` to match a stale rendered file. That direction is wrong: `route.mjs` is the source of truth (per the existing `tests/unit/routing-docs-in-sync.test.mjs` discipline and the commit history). The fix is always to regenerate the rendered files. The generator's CLI output and the test failure messages should make this unambiguous; an implementer who flips the direction is committing a category error.
6. **Marker collision.** If the chosen start/end comment markers (e.g., `<!-- regen:start --> ... <!-- regen:end -->`) clash with existing content in any of the eight modified prose files, the generator's region-rewrite logic silently corrupts the file. The implementer must pick markers that are not already present anywhere in the touched files (verify with `grep -rn` across the file set before settling on syntax).
7. **`02-implement/notes-N.md` perf entry as a stub.** Criterion 5 is informational. Risk: implementer writes "perf: fine" with no number, the reviewer rubber-stamps. Reviewer agent MUST verify the entry contains an actual numeric wall-clock value (e.g., milliseconds or seconds) for the `npm run regen-routing-docs` run; "fine" or "fast" is not acceptance-criterion-satisfying.
8. **Audit-finding status update commit hygiene.** The finding-status update touches `docs/audit/2026-05-15-agent-architecture-audit.md` with a `<sha>` that doesn't exist until after the content commit lands. Per planner-input, the preferred pattern is split commits: one content commit (the regen + tests), one `chore(audit):` commit updating the five `**Status:**` rows with the content-commit's SHA. The risk of the SHA-amend pattern is a force-push to an already-pushed branch — explicitly forbidden by `.claude/rules/commit-discipline.md`. The implementer follows the split-commit pattern.

## Out of scope

Per karpathy guideline #2 ("Simplicity First — no features beyond what was asked") and `.claude/agents/planner-agent.md`'s "Stay under the spec" discipline.

- **`scripts/route.mjs` itself.** It is the source of truth, not a regen target. Even if the drift test reveals that `TASK_RULES` is missing a keyword the rendered files have, the fix is to regenerate the rendered files OR to add the keyword to `TASK_RULES` as a separate, deliberate change in a follow-up commit — not as a sneaky edit inside this iteration. The audit (H3 evidence) lists the specific missing keywords; if those keywords belong in `TASK_RULES`, that's a `feat(routing):` commit on its own, not part of this iteration.
- **Sibling script `regen-blueprint-prose.mjs`.** Section 12 decided: one script, not two. Creating a sibling is an explicit deviation from the design.
- **Modifying the IDE-specific wrapper text** in `AGENTS.md`, `.cursorrules`, `GEMINI.md`. Tone and framing differ on purpose; only the procedure body is generated.
- **Structural rewrites of `CLAUDE.md`, `CONTEXT.md`, `START-HERE.md`.** Count fields only.
- **Hook changes.** Iteration 02 (`02-hook-scaffolding`) addresses the hook layer; this iteration must not preemptively touch `.claude/hooks/*` or `.claude/settings.json`.
- **Agent-spec changes.** Iteration 02 addresses adversary/reviewer prior-cycle inputs (H1). This iteration does not edit `.claude/agents/*`.
- **Skill changes.** No `.claude/skills/*` edits.
- **The other audit findings** (C1, C2, C3, C4, H1, H2, H4, H7, H8, every M except M3, every L except L2). Those are owned by subsequent iterations and direct commits; touching them here violates the iteration boundary.
- **The "names resolve via registry" comment block does not become a generator for the routing files' agent/skill lists.** The lists themselves stay hand-authored in this iteration (they're correct per the resolution path; the audit's confusion was about visibility, not correctness). A future iteration could choose to generate the lists from registries, but that is not in scope here.
- **Performance regression gating.** Iteration 05 (`05-perf-security-hardening`) owns the formal baseline-guard test. Criterion 5 here is informational only.
