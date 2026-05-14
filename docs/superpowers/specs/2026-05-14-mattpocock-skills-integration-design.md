# Mattpocock Skills Integration — Design

**Status:** Implemented (2026-05-14)
**Date:** 2026-05-14
**Repo:** `Elessar617/workspace-blueprint` (private)
**Upstream:** [`mattpocock/skills`](https://github.com/mattpocock/skills) — MIT — pinned at commit `e74f0061bb67222181640effa98c675bdb2fdaa7` (2026-05-13)
**Related:** [`2026-05-11-ecc-bridge-and-routing-design.md`](2026-05-11-ecc-bridge-and-routing-design.md) (the routing/registry chassis this design plugs into)

---

## 1. Summary

This spec adds five new skills to `workspace-blueprint`'s `.claude/skills/` from `mattpocock/skills`, plus three in-place enhancements ("hybrid edits") to existing native skills (`tdd-loop`, `bug-investigation`, `spike-protocol`). All adopted material stays domain-agnostic per the `portability-discipline` rule. The five new skills are `caveman`, `handoff`, `zoom-out`, `write-a-skill`, and `architecture-audit` (the last adapted from upstream's `improve-codebase-architecture` to drop CONTEXT.md/ADR conventions that clash with this repo's `CONTEXT.md` semantics).

The integration mechanism is **project skills with attribution**: copy upstream `SKILL.md` files into `.claude/skills/<name>/` with `vendored_from: github.com/mattpocock/skills@<sha>` frontmatter and a new `mattpocock-skills` section in `THIRD_PARTY_LICENSES.md`. The existing `refresh-vendored.mjs` script — which reads from the local plugin cache — will simply report `upstream-not-found` for these entries and skip them, which is harmless. A future enhancement could extend the script to handle GitHub-source skills; that is explicitly out of scope here.

Routing impact is intentionally small: `architecture-audit` auto-routes only for refactors, and `caveman` is always included in every routing branch (and fallback) as the token-discipline skill. The other three (`handoff`, `zoom-out`, `write-a-skill`) are explicit-invocation-only and intentionally not wired into any routing branch.

---

## 2. Motivation

`mattpocock/skills` is a curated set of MIT-licensed engineering skills built from Matt Pocock's daily Claude Code use, aimed at "real engineering, not vibe coding." Several of its 18 skills are either genuinely additive to this repo (no native equivalent) or contain phrasings/structures that strictly improve native skills with the same purpose. The goal is to **selectively augment** the blueprint without violating its portability discipline, without replacing skills that work, and without creating routing ambiguity by having two skills compete for the same trigger.

The eight changes were chosen via per-skill head-to-head review of all 18 upstream skills against the 10 native skills. The decision matrix is captured in section 4. Skills explicitly *not* adopted (10 of them) are listed in section 4.3 with reasoning.

---

## 3. Key Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Integration mechanism | **Project skills with attribution** | Permits hybridization. Manual refresh only (acceptable — upstream rarely changes). |
| 2 | Auto-refresh | **Out of scope** (handled manually) | `refresh-vendored.mjs` expects plugin-cache paths; GitHub-source support deferred. Frontmatter still carries `vendored_from` for traceability. |
| 3 | Verbatim vs adapted | **Adapted where portability or naming requires** | `architecture-audit` renamed + CONTEXT.md/ADR refs dropped. `zoom-out` strips `disable-model-invocation: true` (skill loader doesn't honor it). Others copy verbatim. |
| 4 | Hybrid vs replace | **Hybrid for `tdd-loop` / `bug-investigation` / `spike-protocol`; do not replace** | Our versions integrate with `build/` pipeline, hooks, and `01-spec/SPEC.md` shape; upstream versions integrate with CONTEXT.md/ADR/issue-tracker. Hybridizing lifts upstream's strongest ideas while preserving native integrations. |
| 5 | Auto-routing | **`architecture-audit` joins refactor routing; `caveman` joins every base route** | `architecture-audit` is only useful during structural review. `caveman` is intentionally always available for token discipline. `handoff`/`zoom-out`/`write-a-skill` remain explicit-invocation-only. |
| 6 | License posture | **MIT preserved via `THIRD_PARTY_LICENSES.md`** | Matches the existing pattern for `obra/superpowers` and `andrej-karpathy-skills` vendored content. Full license text included. |

---

## 4. Per-skill decisions

### 4.1 Skills adopted as new files (5)

| Skill | Adaptation | Auto-route? | Portability concerns |
|---|---|---|---|
| `caveman` | Verbatim copy | **Yes** — always included in every routing branch and fallback | None |
| `handoff` | Verbatim copy | No | None — references `mktemp` only |
| `zoom-out` | Drop `disable-model-invocation: true` frontmatter (skill loader doesn't honor it); content unchanged | No | None — references "project's domain glossary" generically |
| `write-a-skill` | Verbatim copy. Description frontmatter appended with one sentence: `For spec-shaped artifacts (RFC, ADR, brief) use 'spec-authoring' instead.` (so the skill loader can disambiguate when the user wants a spec, not a skill). | No | None |
| `architecture-audit` | Renamed from `improve-codebase-architecture`. Inline upstream's `LANGUAGE.md` glossary as `architecture-audit/LANGUAGE.md` (terms are domain-agnostic). Drop CONTEXT.md and ADR references from the `SKILL.md`. Add cross-link to `refactor-protocol` for execution. | **Yes** — added to `.claude/routing/refactor.md` alongside `refactor-protocol` and `karpathy-guidelines`. | Surgery: remove `CONTEXT.md` mentions (his CONTEXT.md = domain glossary; ours = workspace router). Remove ADR-create offers (we have a different ADR workflow in `spec-authoring`). |

### 4.2 Skills hybridized in-place (3)

| Skill | What gets added from upstream | What stays unchanged |
|---|---|---|
| `tdd-loop` | A new section naming the "vertical vs horizontal slicing" anti-pattern with the upstream ASCII illustration, plus the "test behavior through public interfaces" principle. ~12 added lines. Attribution as an "Adapted from" footnote at the file end. | The red→green→refactor cycle definition, per-stage discipline (`test passes immediately → test is wrong`), build/-pipeline integration, hook-enforcement reference, existing anti-patterns. |
| `bug-investigation` | Restructured around upstream's 6-phase shape: (1) build-a-feedback-loop (with 10 tactic categories: failing test, curl/HTTP script, CLI invocation, headless browser, replay trace, throwaway harness, property/fuzz, bisection harness, differential, HITL bash script), (2) reproduce, (3) hypothesise (3-5 ranked, falsifiable predictions), (4) instrument (with `[DEBUG-xxxx]` tagged logs for grep-cleanup), (5) fix + regression test, (6) cleanup + post-mortem. Roughly doubles the file (~80 lines total). | The `01-spec/SPEC.md` diagnosis format (Trigger / Symptom / Root cause / Why prior tests missed it) gets folded into Phase 5 + 6. The build/ pipeline framing and the regression-test-is-permanent rule remain explicit. |
| `spike-protocol` | A new supporting file `.claude/skills/spike-protocol/PROTOTYPE-SHAPES.md` covering upstream's logic-vs-UI prototype branches (terminal-app for state/logic questions; multiple route-variants for UI questions) and the "rules that apply to both" (throwaway from day one, one command to run, no persistence, surface state, delete when done). The main `SKILL.md` gets one new sentence linking to it in the `prototype/` phase. | The four-artifact shape (PREFLIGHT.md → prototype/ → VERIFY.md → REPORT.md), the timebox discipline, the abandoned-spikes-are-valuable rule, the `docs/explorations/` outcome capture. |

### 4.3 Skills explicitly NOT adopted

#### 4.3a Covered by hybridization or adaptation in 4.1 / 4.2 (4 skills)

The upstream verbatim versions of these are not adopted, but their ideas are folded into native skills:

| Skill | Where its ideas land |
|---|---|
| `tdd` | Hybridized into native `tdd-loop` (4.2). |
| `diagnose` | Hybridized into native `bug-investigation` (4.2). |
| `prototype` | Tactics absorbed into `spike-protocol/PROTOTYPE-SHAPES.md` (4.2). |
| `improve-codebase-architecture` | Adapted as `architecture-audit` (4.1). |

#### 4.3b Truly skipped (10 skills)

| Skill | Reason for skip |
|---|---|
| `triage` | Solo project, no formal issue tracker. Carries heavy issue-tracker assumptions. |
| `to-issues` | Same — needs issue tracker, contradicts solo-project workflow. |
| `to-prd` | Assumes `/setup-matt-pocock-skills` bootstrap and issue-tracker publication. Native `spec-authoring` (RFCs/ADRs/briefs) covers the scope we need. |
| `grill-me` | 4 lines of effective content; subsumed by native `brainstorming` (vendored from `obra/superpowers`). |
| `grill-with-docs` | Maintains a domain-glossary CONTEXT.md that conflicts with this repo's workspace-router CONTEXT.md. Adapting would require renaming the artifact and rewiring trigger semantics — high cost, low marginal gain. |
| `setup-matt-pocock-skills` | His bootstrap script. We have our own `scripts/bootstrap.sh` and per-repo conventions. |
| `misc/git-guardrails-claude-code` | Overlaps with native `commit-discipline` rule + our bash-hook layer. |
| `misc/migrate-to-shoehorn` | TS-tool-specific migration; not relevant. |
| `misc/scaffold-exercises` | Exercise harness for onboarding; not a development workflow tool. |
| `misc/setup-pre-commit` | Husky-specific; our hook layer is plain bash. |

---

## 5. Architecture / Files changed

### 5.1 New files (8)

```
.claude/skills/caveman/SKILL.md
.claude/skills/handoff/SKILL.md
.claude/skills/zoom-out/SKILL.md
.claude/skills/write-a-skill/SKILL.md
.claude/skills/architecture-audit/SKILL.md
.claude/skills/architecture-audit/LANGUAGE.md
.claude/skills/spike-protocol/PROTOTYPE-SHAPES.md
docs/superpowers/specs/2026-05-14-mattpocock-skills-integration-design.md   ← this file
```

### 5.2 Edited files (5)

```
.claude/skills/tdd-loop/SKILL.md             ← +section on vertical slicing + interface testing
.claude/skills/bug-investigation/SKILL.md    ← rewritten around 6 phases + feedback-loop primacy
.claude/skills/spike-protocol/SKILL.md       ← link to new PROTOTYPE-SHAPES.md
.claude/skills/THIRD_PARTY_LICENSES.md       ← +mattpocock-skills section
SKILLS.md                                    ← 5 new orientation entries + note for hybrids
```

### 5.3 Routing & registry (1 edit; registry auto-regenerates)

```
.claude/routing/*.md                         ← +caveman in every always-load skill list
.claude/routing/refactor.md                  ← +architecture-audit entry
.claude/registry/native-inventory.json       ← AUTO-REGENERATED by `npm run rebuild-registry` after the new SKILL.md files exist (do not hand-edit)
```

The native-skills registry is produced by `scripts/lib/native-scraper.mjs` walking `.claude/skills/<name>/SKILL.md`. Adding new directories under `.claude/skills/` is the only input needed; running `npm run rebuild-registry` rewrites `native-inventory.json` to include them. `harness-skills.json` is for harness-installed plugin skills only — irrelevant here.

---

## 6. Attribution & licensing

### 6.1 `THIRD_PARTY_LICENSES.md` additions

Append a new section:

````markdown
## mattpocock-skills — Matt Pocock

- **Upstream:** https://github.com/mattpocock/skills
- **Commit pinned:** e74f0061bb67222181640effa98c675bdb2fdaa7 (2026-05-13)
- **Skills imported as new files:** `caveman`, `handoff`, `zoom-out`, `write-a-skill`, `architecture-audit` (adapted from `improve-codebase-architecture`)
- **Partial adoption (hybridized into existing native skills):** ideas lifted from upstream `tdd` into `tdd-loop`, upstream `diagnose` into `bug-investigation`, upstream `prototype` into `spike-protocol/PROTOTYPE-SHAPES.md`

```
MIT License

Copyright (c) 2026 Matt Pocock

[full license text]
```
````

### 6.2 Per-skill frontmatter

Each adopted-as-new skill gets:

```yaml
vendored_from: github.com/mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7
license: MIT
```

`refresh-vendored.mjs` will return `upstream-not-found` for these (it only looks at the local plugin cache); this is silent-skip behavior, not an error. Acceptable.

### 6.3 Hybridized files and supporting files

For **hybridized `SKILL.md` files** (`tdd-loop`, `bug-investigation`, `spike-protocol`): a short `> Adapted in part from mattpocock/skills@<sha>` footnote at the end, plus inclusion in the partial-adoption list in `THIRD_PARTY_LICENSES.md`. No frontmatter `vendored_from` field (since they remain primarily native works with lifted ideas, not vendored copies).

For the **new supporting file `spike-protocol/PROTOTYPE-SHAPES.md`** (whose content is substantially derived from upstream's `prototype` skill): include a top-of-file comment `<!-- Adapted from github.com/mattpocock/skills/skills/engineering/prototype/SKILL.md @ <sha> -->` (Markdown comments are invisible when rendered but visible in source). This is sufficient since the content is also covered by the `mattpocock-skills` block in `THIRD_PARTY_LICENSES.md`.

For `architecture-audit/LANGUAGE.md` (a supporting file whose vocabulary is lifted verbatim from upstream's `improve-codebase-architecture/LANGUAGE.md`): same Markdown-comment attribution pattern, plus coverage under the licenses file.

---

## 7. Routing & registry integration

### 7.1 `.claude/routing/*.md`

Add `caveman` to every always-load skill list. This keeps the token-compression instruction available regardless of task type, while the skill's own persistence rules still require explicit activation for caveman-mode responses.

### 7.2 `.claude/routing/refactor.md`

Add `architecture-audit` to the always-load skill list alongside `tdd-loop` and `karpathy-guidelines`. Keep the same shape as existing entries.

### 7.3 `scripts/route.mjs`

Keep `BRANCH_BASE` aligned with the branch files: add `caveman` to every base route and `architecture-audit` to the refactor route. Route tests should compare branch-file always-load entries against executable route output.

### 7.4 `.claude/registry/native-inventory.json`

Do not hand-edit. `scripts/rebuild-registry.mjs` walks `.claude/skills/<name>/SKILL.md` via `scrapeNative()` and rewrites this file from disk. After creating the 5 new skill directories, `npm run rebuild-registry` adds them automatically. `harness-skills.json` is for plugin-installed skills (e.g., from `~/.claude/plugins/`) and is not touched.

### 7.5 Validation gate

`npm run rebuild-registry` is the validation gate for all routing↔registry consistency. Implementation must conclude with a successful run.

---

## 8. Out of scope

- Adopting any of the 10 skills listed in 4.3.
- Extending `refresh-vendored.mjs` to handle GitHub-source skills (could be a future iteration).
- Adopting `disable-model-invocation: true` semantics in the skill loader (currently stripped from `zoom-out`; could be a future routing enhancement).
- Adding `mattpocock-skills` to the Claude plugin marketplace as an alternative install path (the project-skills-with-attribution mechanism is already chosen).
- Migrating native `bug-investigation` / `tdd-loop` / `spike-protocol` to verbatim upstream copies (we chose hybrid; verbatim is explicitly rejected).
- Any change to native `brainstorming`, `spec-authoring`, `refactor-protocol`, `data-analysis`, or vendored skills (`systematic-debugging`, `writing-plans`, `karpathy-guidelines`).
- New skills targeting issue-tracker workflows (`triage`, `to-issues`, `to-prd`) until/unless the repo gains a formal issue-tracker workflow.

---

## 9. Acceptance criteria

- [ ] All 8 new files exist at the paths listed in 5.1 with valid frontmatter.
- [ ] All 5 edited files reflect the changes described in 4.1 / 4.2 / 5.2 / 6.1.
- [ ] `.claude/skills/THIRD_PARTY_LICENSES.md` contains a complete `mattpocock-skills` section with pinned commit SHA and full MIT license text.
- [ ] `.claude/routing/*.md` includes `caveman` in every always-load skill list, and `scripts/route.mjs` returns it for every branch and fallback.
- [ ] `.claude/routing/refactor.md` and `scripts/route.mjs` include `architecture-audit` for refactor routing.
- [ ] `.claude/registry/native-inventory.json` (regenerated by `npm run rebuild-registry`) contains entries for all 5 new skills.
- [ ] `npm run rebuild-registry` passes with zero errors.
- [ ] `npm test` (existing suite) passes.
- [ ] `enforce-portability.sh` hook does not flag any new content (no denied terms in `.claude/rules/` or `.claude/skills/`).
- [ ] Each new skill loads cleanly when invoked explicitly via the `Skill` tool (smoke-tested manually for at least `caveman`, `handoff`, `zoom-out`, `write-a-skill`, `architecture-audit`).
- [ ] `SKILLS.md` lists the 5 new entries and notes the hybridization of the 3 existing skills (for human orientation only — not load-bearing).

---

## 10. References

- Upstream repo: https://github.com/mattpocock/skills @ `e74f0061bb67222181640effa98c675bdb2fdaa7`
- Upstream README: https://github.com/mattpocock/skills/blob/main/README.md
- Existing routing chassis: [`2026-05-11-ecc-bridge-and-routing-design.md`](2026-05-11-ecc-bridge-and-routing-design.md)
- Existing vendored-skills pattern: `.claude/skills/THIRD_PARTY_LICENSES.md`, `scripts/refresh-vendored.mjs`
- Project rules engaged: `portability-discipline`, `commit-discipline`, `code-quality`, `testing-discipline`
