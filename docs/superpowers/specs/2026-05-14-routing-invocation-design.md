# Routing Invocation — Agent-Side Auto-Selection — Design

**Status:** Draft (awaiting user review)
**Date:** 2026-05-14
**Repo:** `Elessar617/workspace-blueprint`
**Related:**
- [`2026-05-11-ecc-bridge-and-routing-design.md`](2026-05-11-ecc-bridge-and-routing-design.md) — original routing layer this iteration fixes
- [`continuous-learning-v2` SKILL.md](../../../.claude/plugins/cache/ecc/ecc/2.0.0-rc.1/skills/continuous-learning-v2/SKILL.md) — instinct source

---

## 1. Summary

This spec reshapes the routing layer in `scripts/route.mjs` + `.claude/hooks/route-inject.sh` so the agent — not the hook — picks all relevant skills, plugins, and MCP tools for each task, while the hook supplies high-leverage **signals** and a small set of **mandatories** that operationalize existing project rules.

It also fixes the cited P1/P2 findings:

- Hook loses file scope (`route-inject.sh:9` reads only `prompt`, `route.mjs:183` hardcodes `files_in_scope: []`)
- Selector is a hardcoded matrix (`route.mjs:1-78`) that doesn't traverse the registry
- `ROUTING.md` has no review/audit branch (`ROUTING.md:7-14`)
- Markdown branch files and runtime can drift (no enforced sync)
- Continuous-learning instincts inject only at SessionStart (`session-start.js:552`), not on every prompt

The design is intentionally a *minimal-change retrofit*. It preserves the hook contract surface (`UserPromptSubmit` → `additionalContext`), the cache file, and the existing test directory. Memory write-back, dynamic relevance scoring, and instinct-to-mandate promotion are explicitly deferred.

---

## 2. Motivation

The current routing layer aims at "agent invokes the right skills automatically" but operationalizes that as "hook emits an advisory list of skill names." Two facts make this insufficient:

1. **A `UserPromptSubmit` hook cannot call the `Skill` tool.** Only the agent can. So no hook-side enforcement is possible by construction — the hook can only inject context.
2. **Claude Code already injects the full skill catalog** (~400 skill descriptions) and lists all MCP tools as deferred. The current routing system is a *filter on top of* a catalog the agent already sees.

Given (1) and (2), the right shape is **bias the agent's selection, don't replace it**. The hook's job is to:

- Tell the agent what the task is (branch classification)
- Give the agent ground truth about scope (files, language, workspace)
- Surface learned context (active instincts at high confidence)
- Enforce a small set of non-negotiables that trace to existing rules (mandatories)
- Frame the output imperatively so the agent reliably acts on it

The operator's stated goal — "agent selects all/best/most relevant tools for each task without operator input" — becomes achievable when the hook stops competing with Claude Code's native skill catalog and starts feeding it better signals.

---

## 3. Key Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Invocation model | **Authoritative advisory + small mandatories** | Hook cannot invoke Skill. Make injection so authoritative the agent reliably complies; enforce only non-negotiables. |
| 2 | Selector authority | **Agent picks from Claude Code's native catalog** | The catalog is already in the prompt. Hook biases it; doesn't duplicate it. |
| 3 | Mandatory provenance | **Each mandatory traces to an existing rule** | Mandates aren't invented in routing; they wire skills to rules already in `.claude/rules/`. Routing stays mechanical. |
| 4 | File scope detection | **Prompt regex + `git status --porcelain` + `git diff --name-only HEAD~3..HEAD`** | Three cheap, deterministic sources; combined; capped at 20. |
| 5 | Instinct freshness | **Re-read on every `UserPromptSubmit`** | Background observer can write mid-session. SessionStart-only is stale by design. |
| 6 | Drift prevention | **`route.mjs` is source of truth; `.md` files regenerated** | Mirrors how `.claude/rules/` work (humans read; hooks enforce mechanically). Unit test fails on drift. |
| 7 | Review branch | **New `review` branch + new row in `ROUTING.md` Step 1** | Closes the fallback-trap for prompts like "act as reviewer and adversary." |
| 8 | Failure handling | **Fail-open everywhere except mandatories** | Mandated-but-unavailable items emit `[unavailable: <name>]` so the agent knows; everything else is non-fatal. |
| 9 | Instinct count | **Scales by branch complexity (3 / 6 / 10)** | Build/refactor get more biasing room; spike/spec-author/fallback stay lean to keep exploratory branches open. |
| 10 | Token budget | **≤ 750 tokens per injection** | ~3.5x today's ~200; accommodates max instinct count + larger file scope without crossing any reasonable ceiling. |

---

## 4. Architecture Overview

### 4.1 Hook responsibilities (revised)

The `UserPromptSubmit` hook does these things in order:

1. **Read stdin** — parse the CC hook input JSON; extract `prompt` and `cwd`.
2. **Classify branch** — keyword match against `TASK_RULES`. Detect transition phrases for cache invalidation.
3. **Detect file scope** — combine three sources:
   - Prompt regex for path-like tokens
   - `git -C $cwd status --porcelain`
   - `git -C $cwd diff --name-only HEAD~3..HEAD`
   - Dedupe; cap at 20 files
4. **Detect languages** — map file extensions via existing `LANGUAGE_BY_EXT`.
5. **Detect workspace** — match `cwd` and file scope against `{spec, lab, build, ship, src, shared, docs}/`.
6. **Read instincts** — call `bash continuous-learning-v2/scripts/detect-project.sh` to get canonical `PROJECT_DIR`; read project + global instincts; filter `confidence >= 0.7`; dedupe by id (project beats global); top 6 by confidence.
7. **Resolve mandatories** — fixed table per branch (see §5).
8. **Resolve discretionary hints** — signal-derived suggestions (see §5).
9. **Resolve MCPs** — per-branch advisory list, split into project-configured and plugin-available.
10. **Format output** — emit the imperative-framed `additionalContext` block (see §6).
11. **Cache** — write the full result to `.claude/routing/.current.json` for chatter reuse.

### 4.2 Agent responsibilities (unchanged from Claude Code default)

- See native skill catalog (already in system prompt)
- See injected `additionalContext` from the hook
- Invoke `Skill` for any REQUIRED-SKILL
- Survey catalog using SIGNALS + HINTS; invoke any other applicable skill or MCP

---

## 5. Mandatories and Hints

### 5.1 Mandatories per branch

Each mandatory traces to an existing rule or workspace contract.

| Branch | Mandatories | Traces to |
|---|---|---|
| `build` | `tdd-loop` (local), `karpathy-guidelines` (local), `superpowers:verification-before-completion` | `.claude/rules/testing-discipline.md`, common karpathy-guidelines principle, evidence-before-completion |
| `bug` | `bug-investigation` (local), `systematic-debugging` (local), `superpowers:verification-before-completion` | Reproduce-before-fix discipline, root-cause-before-patch, verify the fix |
| `refactor` | `refactor-protocol` (local), `karpathy-guidelines` (local), `superpowers:verification-before-completion` | Blast-radius analysis, surgical changes, behavior-equivalence proof |
| `spike` | `spike-protocol` (local) | `lab/CONTEXT.md` — output is *learning*, not code |
| `spec-author` | `brainstorming` (local), `spec-authoring` (local), `writing-plans` (local) | `spec/CONTEXT.md` + `development-workflow.md` (Plan First) |
| `ship` | `superpowers:verification-before-completion`, `superpowers:finishing-a-development-branch` | Evidence + structured ship flow |
| `review` (new) | `karpathy-guidelines` (local), `superpowers:requesting-code-review` | `.claude/rules/review-discipline.md` |
| `fallback` | *(none)* | Don't over-mandate when intent is unclear; let the agent ask |

**Rule for choosing local vs plugin:** prefer the local copy (vendored copies refresh via `npm run refresh-vendored`); fall back to plugin name only when no local copy exists.

### 5.2 Discretionary hints (signal-derived)

These are surfaced under `HINTS` in the output. The agent decides whether to invoke.

| Signal | Hint |
|---|---|
| `language=go` | `golang-patterns`, `go-reviewer` agent, `go-build-resolver` |
| `language=python` | `python-patterns`, `python-reviewer` agent |
| `language=typescript` | `typescript-reviewer` agent |
| `language=rust` | `rust-patterns`, `rust-reviewer` agent |
| `language=kotlin` | `kotlin-reviewer`, `kotlin-build-resolver` |
| `workspace=lab/` | `data-analysis`, `Explore` agent, `code-explorer` agent |
| `workspace=spec/` | `architecture-audit` (if refactor-shaped) |
| Prompt contains "docs", "API", "library X" | `context7` MCP |
| Prompt contains "find", "where is", "explore the codebase" | `zoom-out`, `serena` MCP |
| Prompt contains "search the web", "research", "look up" | `exa` MCP, `brave-search` MCP, `firecrawl-search` |
| File scope crosses ≥ 5 files | `superpowers:dispatching-parallel-agents` |

### 5.3 MCPs (advisory)

Split into project-configured (always available per `.claude/settings.json`) and plugin-available (discretionary).

| Branch | Project-configured | Plugin-available (discretionary) |
|---|---|---|
| `build` | `filesystem`, `git` | `serena`, `context7`, `sequential-thinking`, `memory` |
| `bug` | `filesystem`, `git` | `serena`, `sequential-thinking`, `memory` |
| `refactor` | `filesystem`, `git` | `serena`, `context7`, `memory` |
| `spike` | `filesystem`, `fetch` | `exa`, `context7`, `brave-search`, `firecrawl`, `mempalace` |
| `spec-author` | `filesystem`, `fetch` | `exa`, `context7`, `brave-search`, `mempalace` |
| `ship` | `filesystem`, `git`, `github` | `sentry`, `puppeteer` |
| `review` (new) | `filesystem`, `git`, `github` | `sequential-thinking`, `serena` |
| `fallback` | `filesystem` | *(none)* |

---

## 6. Output Format

The hook emits `additionalContext` matching this shape:

```text
ROUTING (authoritative). You MUST invoke each REQUIRED skill via the Skill tool
before responding. Then survey your skill catalog and MCP tools using the
SIGNALS and HINTS below; invoke whichever apply.

branch: <branch>   workspace: <workspace>   profile: <hook_profile>
REQUIRED-SKILLS: <name>, <name>, ...
REQUIRED-AGENTS: <name>, <name>, ...
MCPs (project-configured): <name>, <name>, ...
MCPs (plugin-available): <name>, <name>, ...

SIGNALS:
  files: <path>, <path>, ...
  languages: <lang>, <lang>, ...
  recent-edits: <path> (last commit), ...
  workspace: <name>
  active-instincts:
    - [<scope> <confidence>] <action first line>
    - ...
  active-rules: <all|named>, ...

HINTS (consider invoking if relevant):
  - <name> (signaled by <reason>)
  - ...
```

### Invariants

- `REQUIRED-SKILLS` is always present, even empty (`REQUIRED-SKILLS: (none)`)
- `SIGNALS.languages` shows `(none)` when no files detected — useful signal for the agent
- `active-instincts` shows up to the per-branch cap (3 / 6 / 10) by `confidence DESC`, `confidence >= 0.7`, project-scope preferred
- Token budget: ≤ 750 tokens worst case (build/refactor with full instinct cap + large file scope)
- Plain-text Unix-philosophy contract — greppable, diffable, pipe-friendly (per `.claude/rules/unix-philosophy.md`)

---

## 7. File Scope Detection

Three sources, combined and deduped, capped at 20:

1. **Prompt regex** —
   - Workspace-rooted paths: `(src|lab|build|spec|ship|docs|shared|scripts|tests)/[\w./-]+`
   - Extension-bearing tokens: `[\w./-]+\.(py|go|ts|tsx|js|jsx|java|kt|kts|rs|cpp|cc|h|hpp|cs|dart|rb|php|swift|md|json|yaml|yml|toml|sh|mjs|cjs)`
2. **`git -C $cwd status --porcelain`** — staged + unstaged
3. **`git -C $cwd diff --name-only HEAD~3..HEAD`** — last 3 commits

Languages derived via the existing `LANGUAGE_BY_EXT` map at `route.mjs:10`.

---

## 8. Always-On Instinct Integration

### 8.1 Where instincts live

Per `continuous-learning-v2`:

- Project-scoped: `${XDG_DATA_HOME:-$HOME/.local/share}/ecc-homunculus/projects/<hash>/instincts/{personal,inherited}/*.{yaml,md}`
- Global: `${XDG_DATA_HOME:-$HOME/.local/share}/ecc-homunculus/instincts/{personal,inherited}/*.{yaml,md}`

### 8.2 Reading mechanism

- `route-inject.sh` shells out to `bash continuous-learning-v2/scripts/detect-project.sh` to compute the canonical `PROJECT_DIR` — this guarantees the same hash as the observer agent uses; no DIY hashing.
- `route.mjs` (or a small JS helper invoked by it) reads the four directories above. Parses frontmatter using the same logic as `session-start.js:260-307`.
- Filter: `confidence >= 0.7`, dedupe by `id` (project beats global), sort by `confidence DESC`.
- **Cap the count by branch (scales with branch size):**
  | Branch | Max instincts shown |
  |---|---|
  | `build`, `refactor` | 10 |
  | `bug`, `ship`, `review` | 6 |
  | `spike`, `spec-author`, `fallback` | 3 |
- Inject as `active-instincts:` block.

### 8.3 Why every prompt, not just SessionStart

- Background observer can write new instincts mid-session (per `config.json` `run_interval_minutes: 5`)
- Confidence values update as observations accumulate
- The user's stated goal: routing reflects live instinct state, not a session-start snapshot

### 8.4 Cost

~10-30ms of disk I/O per prompt. Comfortably within hook latency budget.

---

## 9. Drift Prevention

**Decision:** `scripts/route.mjs` is the runtime source of truth. The `.md` files under `.claude/routing/` are regenerated.

- New script `scripts/regen-routing-docs.mjs` reads the data in `route.mjs`, emits regenerated `.md` files.
- New unit test `tests/unit/routing-docs-in-sync.test.mjs` verifies committed `.md` matches regen output. CI fails on drift.
- New `npm run regen-routing-docs` wraps the script.
- Adding/changing a branch = change `route.mjs` data, run regen, commit both.

This mirrors how `.claude/rules/` already work — humans read; hooks enforce mechanically.

---

## 10. Review/Audit Branch

Four changes:

1. **`scripts/route.mjs`** — add to `TASK_RULES`:
   ```js
   { branch: 'review', keywords: ['review', 'audit', 'evaluate', 'critique', 'act as reviewer'], profile: 'standard' },
   ```
2. **`scripts/route.mjs`** — add to `BRANCH_BASE`:
   ```js
   review: {
     agents: ['reviewer', 'adversary'],
     skills: ['karpathy-guidelines', 'superpowers:requesting-code-review'],
     rules: ['all'],
     mcps: ['filesystem', 'git', 'github'],
   },
   ```
3. **`ROUTING.md`** — add row to the Step 1 table:
   ```
   | "review", "audit", "evaluate", "critique" | `build/`  | `.claude/routing/review.md`    |
   ```
4. **`.claude/routing/review.md`** — generated by `regen-routing-docs.mjs`.

---

## 11. Testing Strategy

### 11.1 Unit tests (`tests/unit/route.test.mjs`)

- `detectTaskType("act as reviewer and adversary")` → `'review'`
- `route({prompt: "add rate limiter", files_in_scope: ["src/gateway/x.go"]})` → `languages_detected: ['go']`, mandatories include `tdd-loop`, hints include `golang-patterns`
- `route({prompt: "fix the login crash"})` → `branch: 'bug'`, mandatories include `bug-investigation` + `systematic-debugging`
- `formatOutput(routeResult)` produces the exact expected string format (snapshot test)
- `parseInstincts(yamlContent)` returns filtered + sorted list
- `extractFileScope(prompt, gitStatus, gitDiff)` returns deduped capped list

### 11.2 Integration tests (`tests/integration/hook-route-inject.test.mjs`)

- Send CC-shaped JSON to `route-inject.sh` stdin → assert valid `additionalContext` payload
- Go prompt + working tree containing `*.go` → assert `languages: go` in output
- Instincts dir missing → assert graceful degradation (`active-instincts: (none)`)
- No git → assert `files: (no git scope)`

### 11.3 Source-of-truth tests (`tests/unit/routing-docs-in-sync.test.mjs`)

- Each `.claude/routing/*.md` matches regen output byte-for-byte

### 11.4 Manual verification

- Real session with a Go-flavored prompt and no `/skill` invocation → confirm agent invokes `tdd-loop` + `golang-patterns` without operator prompting
- Confirm `active-instincts` block appears in agent context
- Confirm `review` branch fires on "act as reviewer"

---

## 12. What's Deferred (Explicit Non-Goals)

1. **Memory write-back loop.** A `Stop` or `PostToolUse(Skill)` hook recording "for this signal-set, agent invoked these skills + outcome." Closes the learning loop in routing itself. *Deferred because:* the read-only instinct integration delivers most of the value; the write side is a larger surface.
2. **Dynamic relevance scoring over the full registry.** Keyword/embedding scoring across all 6160+ skills. *Deferred because:* discretionary hints already cover the common cases; full scoring is premature optimization.
3. **Instinct-to-mandate promotion.** High-confidence instincts auto-becoming mandatories. *Deferred because:* mandates trace to rules today; promotion needs governance design first.
4. **Fixing the 2 failing `source-of-truth.test.mjs` tests** (`/Users/gardnerwilson` leak, source-marker check). *Deferred because:* unrelated sanitization concern; tracked separately.
5. **Resolving local `tdd-loop` vs `superpowers:test-driven-development` duplication.** *Deferred because:* style call; routing fix doesn't require it.

---

## 13. Acceptance Criteria

The implementation is complete when:

1. Hook test: prompt `"add rate limiter to gateway"` with `src/gateway/x.go` in working tree → output includes `languages: go` AND `HINTS` mentions `golang-patterns`.
2. Hook test: prompt `"act as reviewer and adversary"` → `branch: review`.
3. Hook test: all `branch: <branch>` outputs include the correct REQUIRED-SKILLS per §5.1.
4. Hook test: hook output includes `active-instincts:` block on every prompt (when instincts exist with confidence ≥ 0.7).
5. Snapshot test: output format matches §6 exactly.
6. Drift test: `npm run regen-routing-docs && git diff --exit-code .claude/routing/` succeeds.
7. Unit test: `route()` no longer references hardcoded `LANGUAGE_ADDITIONS` matrix; language signals are computed from `files_in_scope`.
8. Token measurement: a sample real-session injection is ≤ 600 tokens.
9. Manual: in a real session, Go-flavored prompt triggers `tdd-loop` + `golang-patterns` invocation without operator prompting (visible in session transcript).
10. All existing tests (except the 2 pre-existing failures noted in §12.4) continue to pass.

---

## 14. Open Questions for the Implementation Phase

(These don't block design approval; they're decisions for the `writing-plans` step or the implementer agent.)

- Should the regen-routing-docs script run in a pre-commit hook, or only via `npm run`?
- How to handle the case where `continuous-learning-v2` plugin is absent? (Fallback: skip instinct read; no error.)
- The "transition phrase" cache-invalidation list in `route.mjs:129` — keep, expand, or replace with file-scope-change detection?

---

## 15. References

- `scripts/route.mjs` — current routing source
- `.claude/hooks/route-inject.sh` — current `UserPromptSubmit` hook
- `ROUTING.md` — markdown decision tree
- `.claude/routing/*.md` — branch-specific routing notes
- `.claude/registry/*.json` — generated catalog of agents/skills/commands/MCPs
- `.claude/rules/testing-discipline.md` — origin of `tdd-loop` mandate on build
- `.claude/rules/review-discipline.md` — origin of `karpathy-guidelines` mandate on review
- `continuous-learning-v2/SKILL.md` — instinct system
- `continuous-learning-v2/scripts/detect-project.sh` — canonical project hash
- `session-start.js:260-398` — instinct read + summary logic to mirror
