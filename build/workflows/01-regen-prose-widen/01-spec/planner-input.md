# Planner input — Iteration 01: regen-prose-widen

**Source spec:** `docs/superpowers/specs/2026-05-15-audit-remediation-design.md` (commit `e1577dd`)
**Plan reference:** `docs/superpowers/plans/2026-05-15-audit-remediation.md` Task 4 (iteration 01)

**Lift these sections into `SPEC.md`:**
- Design spec Section 3, iteration 01 row — scope statement and closes list (H3, H5, H6, M3, L2).
- Design spec Section 4, "Iteration 01 (`regen-prose-widen`)" — per-iteration acceptance criteria.

## Acceptance criteria (verbatim, for SPEC.md)

1. `npm run regen-routing-docs` produces byte-identical output for `.claude/routing/*.md`, the Step-1 region of `ROUTING.md`, all three per-IDE preambles (`AGENTS.md`, `.cursorrules`, `GEMINI.md`), and counts in `CLAUDE.md`/`CONTEXT.md`/`START-HERE.md`.
2. A drift test (extension of `tests/unit/routing-docs-in-sync.test.mjs`) fails red when any source-of-truth diverges from rendered output; green when synced.
3. After landing: `TASK_RULES` keywords and `ROUTING.md` Step 1 table fully agree (drift test passes).
4. Every regenerated `.claude/routing/*.md` file contains a comment block explaining names resolve via `.claude/registry/*.json` (closes H6 by making the resolution layer explicit rather than implicit).
5. Performance: informational single-sample check noted in `02-implement/notes-N.md`.

## Decisions inherited (do NOT re-litigate)

Per design spec Section 12 (user-decided):

- **Extend `scripts/regen-routing-docs.mjs`** as one growing script. Do NOT create a sibling like `regen-blueprint-prose.mjs`. Rationale: cohesive rendering, one drift test extends in lockstep.
- The per-IDE preambles differ in tone but their procedure-body content is identical. Use a template with per-IDE wrapper text.
- Counts in `CLAUDE.md`, `CONTEXT.md`, `START-HERE.md` come from filesystem inspection (count files under `.claude/hooks/`, dir entries under `.claude/skills/`, lines in `.claude/rules/`, etc.).
- `regen-routing-docs.mjs` reads `TASK_RULES` (already exported from `route.mjs`) for the Step-1 keyword table.

## Files in scope (likely to be modified)

- `scripts/regen-routing-docs.mjs` — extended with new generators
- `tests/unit/routing-docs-in-sync.test.mjs` — extended drift assertions
- `ROUTING.md` — Step-1 table regenerated content
- `AGENTS.md`, `.cursorrules`, `GEMINI.md` — procedure body regenerated; wrapper kept
- `CLAUDE.md`, `CONTEXT.md`, `START-HERE.md` — count fields synced
- Each `.claude/routing/*.md` file — gains a "names resolve via registry" comment block
- `docs/audit/2026-05-15-agent-architecture-audit.md` — H3, H5, H6, M3, L2 rows updated to `**Status:** closed (<sha>)`

## Findings to close

H3, H5, H6, M3, L2. The final commit body MUST update `**Status:** closed (<sha>)` for each in `docs/audit/2026-05-15-agent-architecture-audit.md` (with `<sha>` back-filled via the SHA-amend pattern, OR — preferable — split into a content commit and a `chore(audit):` status commit per the handoff note's recommendation).

## Cycle expectations

Likely 1 cycle (extension of an established pattern). May reach 2 if the drift test surfaces edge cases (e.g., regenerated content not matching exactly due to whitespace).

## Rules to honor

All `.claude/rules/*.md`. Especially:
- `testing-discipline.md` — TDD mandatory (drift test FIRST, fails red; then implementation; then green).
- `commit-discipline.md` — Conventional Commits, no `--no-verify`, no force-push.
- `code-quality.md` — no debug statements; surgical changes per karpathy guidelines also referenced in `.claude/skills/karpathy-guidelines/`.
- `portability-discipline.md` — anything written to `.claude/rules/` or `.claude/skills/` must be domain-agnostic. The regen logic itself lives in `scripts/` so this rule is unlikely to bind, but be aware.

## Notes for the planner agent

This iteration is the FIRST real exercise of the four-agent pipeline in this repo. The planner should produce a clean SPEC.md that the implementer can lift acceptance criteria from. Per `.claude/agents/planner-agent.md`, the SPEC.md should include a **Risks** section anticipating what could go wrong.

Risk candidates worth listing in SPEC.md:
- Byte-identity is strict: a regenerated file with a different trailing newline or whitespace will fail the drift test. The generator must be deterministic.
- `CLAUDE.md` is "always loaded" — accidentally breaking its structure breaks every future session. Land the count changes WITHIN the existing dimension table; do not restructure the file.
- Per-IDE preambles are user-facing entry points (AGENTS.md for Codex, .cursorrules for Cursor, GEMINI.md for Gemini). Each IDE has slightly different cache/fallback semantics. Preserve the wrapper text differences; regenerate only the procedure body.
- The regen pattern, once widened, becomes harder to opt out of. Any future file that wants to drift intentionally needs explicit carve-outs.
