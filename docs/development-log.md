# Development Log

> Running log of where `workspace-blueprint` is, what it's trying to be, and how it got from A to B. Update at each meaningful milestone. Source-of-truth for "what's the state of the project?" without having to read the whole git log.
>
> **Last updated:** 2026-05-12.

---

## 1. Project goal

`workspace-blueprint` is **an agent-native scaffold for software development with Claude Code (and Codex / Cursor / Gemini CLI / OpenCode via per-IDE preambles).** It serves two roles simultaneously:

1. **A portable scaffolding source.** Clone it from GitHub onto any PC, run `./scripts/bootstrap.sh`, and have a working Claude Code stack — opinionated workspaces, a four-agent build loop, enforcement hooks, and an auto-routing layer that narrows the inventory per task. The directory layout, the markdown templates, the `.claude/` rules and skills are all designed to be domain-agnostic so they survive being copied into other repos.
2. **A working harness for its own infrastructure development.** The scaffold's own scripts, routing logic, and tests live in this repo and evolve through the same discipline the scaffold imposes on consumers.

The repo is the canonical source — `.claude/reference/*` files stay as placeholders here because each downstream consumer fills them in. Project-specific content (audits, decision logs, this dev log) lives only in `docs/`, which the portability hook excludes.

The "one sentence" goal: **clone-to-any-PC and the Claude Code stack works**.

---

## 2. Journey (how we got here)

### Pre-history — the inputs

Three external sources shaped the design before any code was written:

- **Acme DevRel template** — the original 3-layer routing pattern (`CLAUDE.md` → `CONTEXT.md` → workspace `CONTEXT.md`). Preserved at `docs/maintainer-notes/legacy-devrel-example/` for reference.
- **[`adam-s/alphadidactic`](https://github.com/adam-s/alphadidactic)** — donated the multi-agent loop, the numbered-iterations pattern, and the `.claude/` instruction-set shape.
- **[private-notes Notes Skills Field Manual](docs/maintainer-notes/private-notes-notes/skills_field_manual.pdf)** — supplied the §4.1 decision-sequence pattern in `CONTEXT.md` and the 60/30/10 mental model for splitting always-loaded vs. on-demand vs. lookup content.

### Day 1 — 2026-05-11 — the big build (49 commits)

Initial commit (`1c28eaa`) imported the scaffold structure and immediately followed by two foundation docs: **the ECC-bridge design spec** (`docs/superpowers/specs/2026-05-11-ecc-bridge-and-routing-design.md`) and **the implementation plan** (`docs/superpowers/plans/2026-05-11-ecc-bridge-and-routing-plan.md`). These two artifacts framed everything else that landed that day.

What shipped in a single day, roughly in build order:

1. **The 3-layer chassis** — `CLAUDE.md` (always-loaded map), `CONTEXT.md` (top-level router), and four workspace `CONTEXT.md` files for `spec/`, `lab/`, `build/`, `ship/`. Plus stage-level routing in `build/workflows/CONTEXT.md` for the four-stage pipeline.
2. **The four-agent specs** — `planner`, `implementer`, `reviewer`, `adversary` under `.claude/agents/`. Each agent's role, inputs, outputs, and cycle semantics are documented; the orchestrator process (`docs/orchestrator-process.md`) wires them together.
3. **Rules** — started at 5 native rules (TDD, commit discipline, review gates, code quality, portability) and grew to **7** later that day with `feat(rules): add Unix philosophy and NASA Power of 10` (`f3ac393`) — both with explicit applicability guidance so they apply where they help and skip where they'd be over-engineering.
4. **Hooks** — four bash hooks under `.claude/hooks/` (`pre-commit-tdd.sh`, `block-cycle-overrun.sh`, `block-output-without-signoff.sh`, `enforce-portability.sh`). Each enforces a corresponding rule by construction. A `BLUEPRINT_HOOK_PROFILE` env-var gate was added to every hook in four separate commits, allowing operator-controlled strictness (`minimal` no-ops everything; `standard` and `strict` run the hook).
5. **Skills** — 10 total: 6 project-specific (`tdd-loop`, `bug-investigation`, `refactor-protocol`, `spike-protocol`, `spec-authoring`, `data-analysis`) plus 4 office skills vendored from `anthropics/skills` (`docx`, `pptx`, `xlsx`, `pdf`).
6. **The ECC bridge** — the day's headline feature. Added `external/ecc/` as a git submodule pinned at SHA `7fa1e5b6` (`affaan-m/everything-claude-code` upstream). Built `scripts/lib/{ecc-scraper,harness-scraper,frontmatter,validate}.mjs` to scrape three sources (ECC, harness, native) into JSON registries under `.claude/registry/`. Wrote `scripts/route.mjs` as the deterministic routing module, then `.claude/hooks/route-inject.sh` to call it from Claude Code's `UserPromptSubmit` hook.
7. **The parallel routing layer** — `ROUTING.md` at repo root as the entry-level decision tree, plus six branch files under `.claude/routing/`: `build`, `bug`, `refactor`, `spike`, `spec-author`, `ship`. Each branch declares its always-load inventory + language matrix.
8. **Per-IDE preambles** — `AGENTS.md` (Codex / OpenCode), `.cursorrules` (Cursor), `GEMINI.md` (Gemini CLI). All four (including `CLAUDE.md` itself) point at the same `ROUTING.md` so cross-IDE routing converges on one source of truth.
9. **Lifecycle scripts** — `scripts/{bootstrap,update-ecc,refresh-harness}.sh` for new-machine setup, ECC submodule bumps, and harness re-scrapes.
10. **Cache mechanism** — `.claude/routing/.current.json` (gitignored), with transition-phrase invalidation in `route.mjs`.
11. **Tests** — `tests/run.mjs` orchestrator drives three tiers: `tests/unit/*.test.mjs` (Node `--test`), `tests/hook/*.test.sh`, `tests/integration/*.sh`. Includes routing-cases snapshots, hook happy/error paths, and a bootstrap idempotency integration test.
12. **The merge** — `1e7c03a Merge branch 'feat/ecc-bridge' into main` consolidated all the above onto main. Followed by docs additions (`limitations-and-deferred.md`) and a `.serena/` gitignore tweak.

The discipline that day was unusually clean: every commit followed Conventional Commits format, every commit was atomic (one logical change), and the hook profile gates were added in **four separate commits** rather than batched. The commit history reads like a written-out implementation plan.

### Day 2 — 2026-05-12 — audit, cleanup, F3, validation

Most of what happened on day 2 was *correctness work* — closing gaps the day-1 build had left.

1. **Post-merge audit hardening** (`1bbb3b3`, originally `4c43dc1` before the rebase-onto-main). 31 files, +762/-729. The single largest commit on the project; addresses 14 distinct findings now permanently recorded in [`docs/audit/2026-05-11-ecc-bridge.md`](audit/2026-05-11-ecc-bridge.md). Highlights:
   - **Validator goes strict** — dangling references in `ROUTING.md` now hard-fail the rebuild instead of logging warnings.
   - **Native inventory becomes a first-class source** — new `.claude/registry/native-inventory.json` (25 items) so the validator can resolve `planner`, `implementer`, `tdd-loop`, etc. without depending on coincidental ECC overlap.
   - **Registry becomes a true lockfile** — removed `indexed_at` timestamps so `rebuild-registry` produces byte-identical output on identical input. This is what makes "clone + bootstrap → committed state" deterministic.
   - **Plugin paths become portable** — relative to the plugin cache, not absolute under `/local-path/.../`.
   - **Multi-settings.json MCP scan** — the repo's own `.claude/settings.json` MCPs (`filesystem`, `git`, `fetch`, `github`) are now inventoried alongside `~/.claude/settings.json` ones.
   - **Routing UX fixes** — mid-task chatter ("yes", "ok") no longer clobbers cached routing; `mergeWithCache` precedence inverted so fresh routing wins by default; `ship/` auto-adds office skills when output files are in scope.
   - 6 more findings (built-ins inventoried, codex `.agents/` ignored, etc.) — see audit doc for the full table.
2. **Settings schema URL fix** (`860a203`) — `/doctor` flagged the previous `raw.githubusercontent.com` `$schema` URL; switched to the schemastore canonical.
3. **Workspace structural cleanup** (`58e53df`) — the four `.gitkeep`-only directories at `build/workflows/` root contradicted the documented layout (stages live INSIDE `NN-<slug>/` iterations, not at the workflows root). Removed.
4. **Local-vs-origin divergence resolved** — a force-push to `origin/main` at some earlier point left local main with same-content-different-SHA commits. Reconciled via backup-then-reset (`backup/local-main-before-reset` retained for safety).
5. **F3 shipped** (`80fc73f` + `2519b59`) — `scripts/with-profile.sh <profile> <command>` closes the one operationally-felt v1 gap. The auto-router had been recommending hook profiles but the operator still had to `export BLUEPRINT_HOOK_PROFILE=...` by hand. Now `./scripts/with-profile.sh minimal claude` is a one-liner. 8 integration tests cover usage gates, profile validation, env-var flow for all three profiles, exit-code propagation, and arg pass-through.
6. **Cleanroom bootstrap validation** — first end-to-end proof of the "clone to any PC and it works" promise. Cloned the local repo to `/tmp/wb-cleanroom` *without* `--recursive` (the harsh test), ran `./scripts/bootstrap.sh`, verified the submodule self-initialized from upstream at the pinned SHA, `npm install` succeeded, all 11 registries built cleanly, the strict validator resolved all 7 routing files with zero dangling references, and `npm test` (41 unit + hook + bootstrap + 8 new with-profile tests) passed with 0 failures. A second `rebuild-registry` produced no git diff — the lockfile property held.

---

## 3. Current state (as of 2026-05-12)

| Dimension | Status |
|-----------|--------|
| **3-layer chassis** (`CLAUDE.md` → `CONTEXT.md` → workspace `CONTEXT.md`) | Intact and unmodified by the ECC bridge. Five workspace CONTEXT.md files present. |
| **ECC bridge** (parallel routing layer) | `ROUTING.md` + 6 branch files + 11 registries + 4 per-IDE preambles + Claude Code hook + lifecycle scripts — all present, audit-hardened. |
| **Submodule** | `external/ecc/` pinned at `7fa1e5b6` (`v1.7.0-1126-g7fa1e5b6`) from `affaan-m/everything-claude-code`. |
| **Registries** | 47 ECC agents + 246 skills + 68 commands + 1 MCP + 89 lang-rules + 3 hook-profiles + 27 harness skills + 4 harness MCPs + 3 built-ins + 25 native records. Byte-stable across rebuilds (lockfile property holds). |
| **Tests** | 41 unit + 2 hook + 1 bootstrap-idempotency + 8 with-profile integration tests. 0 failures. |
| **Rules** | 7 native, all generic (portability hook excludes nothing under `.claude/rules/`). |
| **Hooks** | 4 enforcement hooks, each gated by `BLUEPRINT_HOOK_PROFILE`. |
| **Skills** | 10 native (6 project + 4 vendored office). |
| **Bootstrap path** | Verified end-to-end via cleanroom test on 2026-05-12 (clone without `--recursive` → bootstrap self-recovers → all green). |
| **Iteration workspaces** | `spec/`, `lab/`, `build/workflows/`, `ship/` exist but contain only templates and `.gitkeep`s — **by design**. The scaffold is the deliverable, not the iterations. |
| **CI** | None configured. Tests run locally via `npm test`. |
| **Linter / formatter** | None configured. Project is plain Node 18+ ESM (`.mjs`) plus bash; the existing codebase style is consistent without formal enforcement. |
| **Memory** (Claude Code persistent) | `feedback-no-prs-in-this-project` (solo project, commit-direct-to-main) and `feedback-scaffold-invariants` (never fill `.claude/reference/*` placeholders) saved at `~/.claude/projects/.../memory/`. |

---

## 4. What's deferred (v1 limitations)

See [`docs/limitations-and-deferred.md`](limitations-and-deferred.md) for the full record. Summary:

| ID | Item | Status | Trigger to revisit |
|----|------|--------|--------------------|
| F1 | Periodic cross-IDE alignment CI check | Deferred | Observing non-CC routing drift |
| F2 | Custom MCP routing server (Option B) | Deferred — YAGNI for v1 | If LLM compliance with preamble proves unreliable |
| F3 | `BLUEPRINT_HOOK_PROFILE` auto-activation wrapper | **Shipped 2026-05-12** as `scripts/with-profile.sh` | — |
| F4 | `/refresh-routing` slash command | Deferred — UX nice-to-have | If cache staleness shows up in real use |
| F5 | Multi-repo support (additional submodules) | Deferred | When bringing in `obra/superpowers` or similar as a second source |

Operational gaps that aren't strictly "F items":

- **ECC submodule has one parse-skipped file.** `gray-matter` rejects its frontmatter; logged at rebuild time. Not blocking. Worth a future spot-check.
- **Cross-IDE compliance is trust-based.** The 3 non-Claude-Code preambles tell agents to consult `ROUTING.md`, but no test verifies they actually do. F1 above would close this; no urgency until friction observed.

---

## 5. Honest tensions worth knowing

These aren't bugs — they're places where the design and the reality don't fully reinforce each other.

- **CLAUDE.md says "active lab + canonical scaffolding source"** but no iterations have run in `spec/lab/build/ship`. The scaffold *is* the deliverable; calling itself an "active lab" may be aspirational rather than descriptive. Worth softening if the framing ever causes confusion in a fresh clone.
- **The four-agent loop is unproven on a real task in this repo.** It's tested in isolation (snapshot tests, hook tests) but no full `01-spec → 02-implement → 03-validate → 04-output` cycle has been driven end-to-end here. Downstream consumers running the loop on their own projects will be the first real exercise. F3's `with-profile.sh` itself was small enough that running it through the four-agent loop would have been more ceremony than value — flagged here for visibility, not as a defect.
- **Bootstrap-cleanroom test in `tests/integration/` only tests idempotency in-place.** The fresh-clone validation on 2026-05-12 was manual. If we want it permanent, a CI job that does the same thing nightly would catch breakage.

---

## 6. Maintenance

This log captures milestones, not micro-changes. Update it when:

- A new phase of work starts (e.g., a future F1 CI integration would warrant its own subsection in §2).
- A deferred item moves to "shipped" or "no longer relevant."
- A new external dependency or design constraint shapes the project.
- The "honest tensions" list grows or shrinks.

Per-commit detail lives in `git log`. Per-iteration detail lives in `build/workflows/NN-<slug>/` (when there are iterations). Audit-style records of substantive changes live in `docs/audit/`. Design history lives in `docs/superpowers/{specs,plans}/`.
