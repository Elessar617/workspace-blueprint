# Architecture Deepening Audit — workspace-blueprint (pass 2)

**Date:** 2026-05-15
**Skill:** `.claude/skills/architecture-audit` (project-local; mattpocock-adapted)
**Lens:** Module depth, seams, locality. Distinct from the prior 12-layer agent-stack audit; same codebase.
**Roles:** Reviewer (cite the rule) + Adversary (probe edge cases not in the spec). Both lenses fold into each candidate below.
**Prior audit:** [`2026-05-15-agent-architecture-audit.md`](2026-05-15-agent-architecture-audit.md). Combined-view section at bottom.

> Vocabulary: **module / interface / implementation / depth / seam / adapter / leverage / locality** are used per `.claude/skills/architecture-audit/LANGUAGE.md`. Do not substitute "component", "service", "API", or "boundary".

---

## Candidates — deepening opportunities

### 1. Five bash hooks share an identical preamble — extract a shared scaffold

- **Files:** `.claude/hooks/block-cycle-overrun.sh`, `.claude/hooks/block-output-without-signoff.sh`, `.claude/hooks/enforce-portability.sh`, `.claude/hooks/pre-commit-tdd.sh`, partial in `.claude/hooks/route-inject.sh`.

- **Problem.** Each of the four `Edit`-matching hooks opens with the same ~12-line preamble: profile-check exit, `input=$(cat)`, `tool_name=$(jq …)`, `case "$tool_name" in Edit|Write|MultiEdit) ;; *) exit 0 ;; esac`, `target=$(jq …)`, empty-path early exit. The hooks are **shallow** — each one is ~50 lines total of which ~12 are this scaffold and the last ~15–35 are the actual *check*. The implementation-to-interface ratio is bad: each hook re-implements input parsing and tool-name filtering, and any change to the JSON shape (e.g., supporting a `Bash`-matched variant per the prior audit's C2) requires editing all four files identically.

  - Reviewer angle: violates `.claude/rules/unix-philosophy.md` ("Make each program do one thing well … push optionality to the caller") and the DRY principle in `.claude/rules/ecc/common/coding-style.md`. Each hook does its own ad-hoc input parsing instead of consuming a pipeline-friendly representation.
  - Adversary angle: divergent parsing across hooks is a real risk. `route-inject.sh` uses `node -e` to parse JSON; the four others use `jq`. If a future input shape edge case (multiline command, unusual escape) causes `jq` to fail differently from `node`, one hook will misbehave silently while the others appear fine. The bug surface is the *count* of parsers, not the *complexity* of each.

- **Solution (plain English).** Lift the preamble into a shared scaffolding library (a single bash include file, or a small Node helper invoked by all hooks) that does: profile-gate, parse JSON input, filter by tool name + matcher, extract `target` / `command`, and pass a normalized struct to a `check_*` function each hook defines. Each hook becomes the *check* plus a registration. The CLI shape stays the same — Claude Code still sees N hooks in `settings.json` — but each hook file shrinks to ~15 lines.

- **Benefits.**
  - Leverage: callers (hook authors) learn one parsing convention; can write a new hook in 10 lines.
  - Locality: a parser bug is fixed once. A new matcher pattern (e.g., "Bash with `>` redirection") is added once and adopted by every hook that wants it (closes prior audit C2).
  - Tests: each hook's pure *check* function becomes unit-testable from Node (no more bash hook tests that shell out to `jq` + the script). The two test files `tests/hook/*.test.sh` shrink dramatically.

- **Deletion test.** Strong — if you delete the four `Edit`-matching hooks but keep the scaffold, the shape of "what a hook is" is preserved. If you delete the scaffold and keep the hooks, the four hooks each re-grow the same 12 lines. The scaffold concentrates complexity.

---

### 2. `ROUTING.md` Step-1 table and per-IDE preambles are hand-maintained — extend the regen pattern

- **Files:** `ROUTING.md`, `AGENTS.md`, `.cursorrules`, `GEMINI.md`. Source of truth: `scripts/route.mjs` (`TASK_RULES` keywords). Existing positive template: `scripts/regen-routing-docs.mjs`.

- **Problem.** `regen-routing-docs.mjs` already implements the deepening pattern for `.claude/routing/*.md` — it reads `AGENTS_BY_BRANCH`, `MANDATORIES_BY_BRANCH`, `MCPS_BY_BRANCH`, `BRANCH_TO_PROFILE` from `route.mjs`, writes the markdown files, and a drift test (`tests/unit/routing-docs-in-sync.test.mjs`) fails when they diverge. **The same pattern is not applied to `ROUTING.md` Step 1 keyword table or to the three per-IDE preambles.** These four files therefore drift silently from `TASK_RULES`. Prior audit confirmed: `ROUTING.md` Step 1 omits keywords from `TASK_RULES` (`'act as reviewer'`, `'prototype'`, `'propose'`, `'publish'`, `'cleanup'`, `'restructure'`). The three preambles repeat the same 5-step routing procedure with cosmetic wording variation.

  - Reviewer angle: `.claude/rules/code-quality.md` ("dead code … gets removed") and Unix philosophy ("composition over completeness") — hand-curated derived data is a maintenance burden that's already been solved for adjacent files.
  - Adversary angle: each preamble has a slightly different fallback story (compare AGENTS.md's "fall back to CONTEXT.md … 10 skills" with the actual current count of 14). Adding a new IDE preamble (Aider, Continue, OpenCode) doubles the count of files that must learn the same procedure. The shape doesn't scale.

- **Solution (plain English).** Extend `regen-routing-docs.mjs` (or add a sibling `regen-router-prose.mjs`) to also emit `ROUTING.md` Step 1, `AGENTS.md`, `.cursorrules`, and `GEMINI.md`. The per-IDE preambles differ in tone but their *content* is identical; a template per IDE with the routing procedure injected from a single source. Add a sister drift-test that fails if any of these files diverge from regenerated output. The hand-edited parts (preamble-level tone, IDE-specific cache notes) become small template stubs; the procedure body is generated.

- **Benefits.**
  - Leverage: one change to `TASK_RULES` updates four user-facing surfaces.
  - Locality: drift bugs concentrate in one place. The existing drift-test pattern already shows what this looks like — the drift never landed in `.claude/routing/*.md` because the test catches it. The same protection extended to the surfaces consumers actually read.
  - Tests: the existing `routing-docs-in-sync.test.mjs` is the template. Adding `ROUTING.md` + 3 preambles to the same test is mechanical.

- **Deletion test.** Strong — if you delete `regen-routing-docs.mjs`, drift reappears across N files. The script is earning its keep at N=7; widening it to N=11 is the same pattern at higher leverage.

- **Combines with prior audit:** closes H3 (ROUTING.md drift from `TASK_RULES`) and H5 (count drift across map files — if counts come from filesystem inspection in the same regen pass).

---

### 3. `route.mjs` mixes the routing brain with CLI plumbing — extract the entry point

- **Files:** `scripts/route.mjs` (382 lines). Lines 1–293 are the pure functions (`route()`, `detectTaskType`, `buildResolution`, etc.); lines 326–381 are the CLI entry block (arg parse, registry load from disk, instinct read, cache merge, format output, write cache). The CLI block is 55 lines, ~14% of the file.

- **Problem.** The pure routing brain (`route({ prompt, files_in_scope, registry, instincts })`) is already a deep module — small interface, lots of behavior. But the file *also* contains side-effect machinery: filesystem reads of 6 registry JSONs, instinct-system bootstrapping, cache file IO, stdout writes. To unit-test the routing brain you must currently import `route.mjs` and accept that the import side-effects are tolerable (they're not — the CLI block runs only under `import.meta.url === \`file://${process.argv[1]}\``, but the imports at top of file still load). A reader looking for "what does routing do?" must skip past 50 lines of plumbing to find the answer. **The interface of `route.mjs` is unclear: is it a function (`route()`), a CLI, or both?**

  - Reviewer angle: `.claude/rules/unix-philosophy.md` — "One responsibility per unit. A script, module, or function should have one reason to exist." This module has two: route, and run-the-router-as-a-shell-command. `.claude/rules/nasa-power-of-10.md` rule #4 (functions ≤ ~60 lines) — `route()` is ~67 lines, borderline; would shrink if registry assembly moved out.
  - Adversary angle: the CLI block at lines 348–353 hard-codes which registries feed which kind (e.g., `agents: [...safe('ecc-agents.json'), ...safe('harness-builtins.json'), ...safe('native-inventory.json')]`). When a new registry source is added (e.g., a future plugin), this list must be updated in two places (the CLI here AND `rebuild-registry.mjs`). Source-of-truth split.

- **Solution (plain English).** Move the CLI block into its own file (`scripts/route-cli.mjs` or `scripts/lib/route-runner.mjs`). It imports `route()` from `route.mjs` and owns the *runtime* concerns: registry assembly, instinct read, cache management, output formatting, argv parsing. `route.mjs` becomes the pure module — exports + the `route()` function — and is import-safe with zero side effects. The shell hook (`route-inject.sh`) and `npm run` scripts call the CLI file directly.

- **Benefits.**
  - Leverage: unit tests of routing can `import { route } from '../../scripts/route.mjs'` without worrying about side effects. New consumers (e.g., a future GUI router) call the same `route()` function — no need to reimplement registry assembly.
  - Locality: the registry-source list lives in one place (the CLI file). Change it once.
  - Tests: `tests/unit/route.test.mjs` already imports the function — the move makes that import truly side-effect-free, eliminating any future "import order matters" surprises.

- **Deletion test.** Medium — if you delete the CLI block, you lose the shell entry point but the routing brain keeps working from JS. The brain is the deep module; the CLI is the adapter. Splitting them clarifies what each does. Not as load-bearing as candidates 1 or 2, but cheap and clean.

---

### 4. Three scrapers (ecc / harness / native) sit at a real seam but expose different interfaces

- **Files:** `scripts/lib/ecc-scraper.mjs`, `scripts/lib/harness-scraper.mjs`, `scripts/lib/native-scraper.mjs`, plus their shared parent `scripts/lib/frontmatter.mjs`.

- **Problem.** Three modules satisfy roughly the same role — *scrape markdown files at a known location into JSON registry records*. They use the shared `frontmatter.mjs` (parse + normalize), so the internal parsing is already a deep module. But the **seam between scrapers and their callers** has three different shapes:
  - `ecc-scraper`: exports `getEccSha(eccPath)` and `scrapeEcc(eccPath)` — two functions, one a path
  - `harness-scraper`: exports `scrapeHarness({ pluginCacheRoot, harnessSlugs, ... })` — one function, options object
  - `native-scraper`: exports `scrapeNative(repoRoot)` — one function, one path

  The callers (`rebuild-registry.mjs`) must remember three slightly different shapes. Each module knows about its own naming convention, its own root, its own file walk; there's no unified contract across the three. Two adapters would be a hypothetical seam (per LANGUAGE.md: "one adapter = hypothetical seam"); **three adapters at the same seam is a real seam**, and a real seam wants a unified interface to be useful.

  - Reviewer angle: not a documented rule violation (no rule on interface uniformity), but the existing `.claude/skills/architecture-audit` LANGUAGE.md explicitly notes "two adapters means a real one" — the project's own deepening vocabulary suggests this is worth a unified contract.
  - Adversary angle: when a fourth scraper appears (e.g., the rumored `superpowers-scraper` for the obra/superpowers plugin), there's no obvious shape to follow. The author copies whichever existing one feels closest and the divergence widens. Eventually `rebuild-registry.mjs` becomes a switch statement of N shapes.

- **Solution (plain English).** Define a single "scraper" contract — same signature shape across all three, same return type, same error convention. The three current scrapers each become an adapter at the seam. The unified interface might be `scrapeSource({ root, options }) → { records: [...], sha?: string }` — but per skill instructions, **the exact interface is for the grilling-loop step, not this step.**

- **Benefits.**
  - Leverage: `rebuild-registry.mjs` learns one shape, calls it three times.
  - Locality: adding a new source is "write one adapter conforming to the seam" rather than "invent a new shape and update the caller."
  - Tests: each adapter is tested against the same contract — a *parameterized* test suite per adapter replaces three bespoke test files.

- **Deletion test.** Medium — if you delete one scraper, that source disappears. If you delete the *shared seam abstraction* you don't yet have, the three current scrapers still work; the test is whether ADDING the fourth feels mechanical. The benefit is most visible when N grows.

---

### 5. Quick-win — `.claude/hooks/*.sh` and `settings.json` registrations have no checked invariant

- **Files:** `.claude/settings.json:53-75`, `.claude/hooks/route-inject.sh` (UserPromptSubmit), the four PreToolUse/PostToolUse hooks.

- **Problem.** Each hook is registered in `.claude/settings.json` by hand. There's no schema-driven check that every `.sh` file in `.claude/hooks/` is either wired in or intentionally excluded. If someone adds a new hook script and forgets to register it, the script silently doesn't run. Conversely, if a registered hook is deleted from disk but its entry stays in `settings.json`, every prompt incurs a "file not found" — bash exits 127 — which (combined with prior audit's M8, `2>/dev/null || true` swallowing) means no observable error.

  - Reviewer angle: combines with prior audit M8 (errors swallowed). Reviewer would flag "hook configured but missing on disk" as a CI catch.
  - Adversary angle: cross-checking is exactly the kind of mechanical guard the project already applies elsewhere (`source-of-truth.test.mjs`, `routing-docs-in-sync.test.mjs`). Its absence here is a localized blind spot.

- **Solution (plain English).** Add a test (or extend `source-of-truth.test.mjs`) that walks `.claude/hooks/*.sh` and verifies every script is registered exactly once in `settings.json`, and every registered hook path exists on disk. Optionally: derive `settings.json` hook entries from a manifest the same way registry items are derived.

- **Benefits.** Locality (hook registration becomes a checked invariant), and prevents one specific failure mode (the dead-hook entry) that's currently silent.

- **Deletion test.** Weak — this is a *guard*, not a refactor. Include as a quick-win because it costs ~10 minutes and removes one undocumented invariant.

---

## Combined view with the prior audit

This audit (deepening lens) and the prior audit (12-layer agent-stack lens) overlap in three places. Combining them surfaces fixes that solve both at once:

| Combined candidate | Pass-2 candidate # | Prior-audit finding(s) | Combined effect |
|---|---|---|---|
| **Mechanical regeneration of derived prose** | 2 (regen for ROUTING.md + preambles) | H3 (`ROUTING.md` drifts from `TASK_RULES`), H5 (counts drift in map files), M3 ("all 5 rules" wording) | One script + one drift test closes three findings simultaneously. The pattern already exists for `.claude/routing/*.md`; widening it is mechanical. |
| **Hook scaffolding library** | 1 (preamble extraction) | C2 (Bash redirection bypasses block hooks), H2 (`pre-commit-tdd.sh` bypassable), M4 (`route-inject.sh` brittle bash), M8 (errors swallowed) | If the scaffold provides a "matcher engine" that takes `tools: ["Edit","Write","Bash:write-redirect"]`, every hook gets the Bash-bypass fix automatically. JS-based scaffold also fixes the brittle bash parsing and adds error logging in one place. |
| **Pure `route.mjs` module + extracted CLI** | 3 (CLI extraction) | C1 + C3 (routing as suasion, not gate) | The pure module makes it possible to add a `PreToolUse(Task)` gate that imports `route()` directly and re-checks the cached mandatories without going through the shell. The CLI extraction is a precondition for that gate's import-safety. |

The two audits are complementary: the prior audit identified **what's wrong**; this audit identifies **structural moves that make multiple wrongs easier to fix in one place**. The strongest combined leverage is candidate 1 (hook scaffolding) because it pairs with three prior-audit criticals (C2/H2/M4). Candidate 2 (regen pattern) is the cheapest because it's a literal extension of code that already works.

---

## What I am NOT recommending

Per skill: avoid listing theoretical refactors with weak deletion-test signals.

- **Unifying the four agent specs** — each describes a meaningfully different role (one-shot planner, iterative implementer, parallel reviewer/adversary). Differences are load-bearing, not cosmetic. The deletion test moves complexity, not concentrates it. **Skip.**
- **Consolidating the 11 registry JSONs into one** — the split reflects real origin differences (ECC vs harness vs native vs config). Source-rank order (`route.mjs:148-152`) depends on the separation. The MEDIUM finding from prior audit (H4, registry overlap silently resolved) is an enforcement gap, not a deepening gap. **Skip.**
- **Refactoring `.claude/skills/*` to share a contract** — skills are markdown contracts adopted from multiple upstream sources (project-local + vendored mattpocock + integrations). Uniformity would conflict with the vendored-skill license attribution pattern. **Skip.**

---

## Skill-required ask

The architecture-audit skill terminates at "here's what to change and why" and hands off to `refactor-protocol` for execution. Per skill: present candidates, do not propose interfaces yet, ask which to explore.

**Candidates ranked by combined leverage (deepening payoff + prior-audit findings closed):**

| Rank | Candidate | Combined leverage | Risk |
|---|---|---|---|
| 1 | **#1 Hook scaffolding library** | High — closes prior audit C2, H2, M4, M8 | Medium — touches all hooks; needs careful migration to avoid behavior drift |
| 2 | **#2 Extend regen pattern to `ROUTING.md` + preambles** | High — closes H3, H5, M3 | Low — literal extension of working code |
| 3 | **#3 Extract `route.mjs` CLI** | Medium — enables future Task-gate hook (C1/C3 follow-up) | Low — purely structural; tests don't change |
| 4 | **#4 Unify scraper interface** | Low–medium — pays off when 4th scraper appears | Low — no behavior change |
| 5 | **#5 Hook-registration invariant test** | Low (quick guard) | Trivial |

Which would you like to explore first? Or any of them as a pair?
